import { calculateCalibrationMetrics } from "./calibration-engine.js";

export const POLICY_CONTRACT_VERSION = "21.0";

export const POLICY_DEFAULTS = Object.freeze({
  minSamples: 8,
  maxStep: 0.15,
  minImprovement: 0.01,
  multiplierMin: 0.5,
  multiplierMax: 1.5,
  biasFloor: 0.02,
  historyLimit: 24
});

const REVIEW_CODES = new Set([
  "CONTROLLED_RECALIBRATION",
  "REVIEW_FORECAST_ASSUMPTIONS"
]);

const numeric = (value) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};

const clamp = (value, min, max) => {
  const result = numeric(value);
  if (result === null) return null;
  return Math.max(min, Math.min(max, result));
};

const round = (value, places = 6) => {
  const result = numeric(value);
  if (result === null) return null;
  const factor = 10 ** places;
  return Math.round((result + Number.EPSILON) * factor) / factor;
};

const isoTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const stableHash = (value) => {
  const text = String(value);
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
};

export function normalisePolicyConfig(config = {}) {
  const defaults = POLICY_DEFAULTS;
  const minSamples = Math.round(clamp(config.minSamples, 1, 10000) ?? defaults.minSamples);
  const maxStep = clamp(config.maxStep, 0.001, 0.5) ?? defaults.maxStep;
  const minImprovement = clamp(config.minImprovement, 0, 1) ?? defaults.minImprovement;
  const requestedMin = numeric(config.multiplierMin);
  const requestedMax = numeric(config.multiplierMax);
  const multiplierMin = requestedMin === null ? defaults.multiplierMin : requestedMin;
  const multiplierMax = requestedMax === null ? defaults.multiplierMax : requestedMax;
  const ordered = multiplierMin >= 0.05 && multiplierMin <= 1 &&
    multiplierMax >= 1 && multiplierMax <= 3 &&
    multiplierMax >= multiplierMin;

  return {
    minSamples,
    maxStep,
    minImprovement,
    multiplierMin: ordered ? multiplierMin : defaults.multiplierMin,
    multiplierMax: ordered ? multiplierMax : defaults.multiplierMax,
    biasFloor: clamp(config.biasFloor, 0, 1) ?? defaults.biasFloor,
    historyLimit: Math.round(clamp(config.historyLimit, 1, 120) ?? defaults.historyLimit)
  };
}

function normaliseRows(rows = []) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const leadId = String(row?.leadId ?? "").trim();
    const probability = clamp(row?.probability ?? row?.expectedProbability, 0, 1);
    const observedSuccess = numeric(row?.observedSuccess);
    if (!leadId || probability === null || ![0, 1].includes(observedSuccess)) return null;
    return { leadId, probability, observedSuccess };
  }).filter(Boolean);
}

function rawBrier(rows) {
  if (!rows.length) return null;
  const total = rows.reduce((sum, row) => sum + ((row.probability - row.observedSuccess) ** 2), 0);
  return total / rows.length;
}

export function replayProbabilityPolicy(rows = [], multiplier = 1) {
  const safeRows = normaliseRows(rows);
  const factor = clamp(multiplier, 0, 2) ?? 1;
  const adjusted = safeRows.map((row) => ({
    ...row,
    probability: clamp(row.probability * factor, 0, 1)
  }));

  return {
    records: safeRows.length,
    multiplier: round(factor),
    current: calculateCalibrationMetrics(safeRows),
    candidate: calculateCalibrationMetrics(adjusted),
    currentBrier: round(rawBrier(safeRows)),
    candidateBrier: round(rawBrier(adjusted))
  };
}

function materialReview(report) {
  if (!report || typeof report !== "object") return false;
  if (report.severity === "WARNING" || report.severity === "CRITICAL") return true;
  return Array.isArray(report.recommendations) &&
    report.recommendations.some((item) => REVIEW_CODES.has(item?.code));
}

export function buildRecalibrationProposal({
  report = null,
  rows = [],
  datasetFingerprint = null,
  runId = null,
  now = new Date().toISOString(),
  config = {}
} = {}) {
  const options = normalisePolicyConfig(config);
  const generatedAt = isoTime(now) || new Date(0).toISOString();
  const safeRows = normaliseRows(rows);
  const metrics = calculateCalibrationMetrics(safeRows);
  const fingerprint = datasetFingerprint ? String(datasetFingerprint) : null;

  const blocked = (reason) => Object.freeze({
    contractVersion: POLICY_CONTRACT_VERSION,
    proposalId: "V21-" + stableHash(JSON.stringify({
      reason,
      fingerprint,
      runId: runId || null,
      generatedAt,
      records: safeRows.length
    })),
    generatedAt,
    datasetFingerprint: fingerprint,
    runId: runId || null,
    status: "BLOCKED",
    eligible: false,
    reason,
    records: safeRows.length,
    multiplier: 1,
    bias: null,
    improvement: null,
    replay: null,
    configuration: options
  });

  if (!materialReview(report)) return blocked("NO_MATERIAL_DRIFT");
  if (safeRows.length < options.minSamples) return blocked("SAMPLE_INSUFFICIENT");

  const bias = numeric(metrics.calibrationError);
  if (bias === null || Math.abs(bias) < options.biasFloor) return blocked("BIAS_BELOW_FLOOR");

  const step = clamp(bias, -options.maxStep, options.maxStep);
  const multiplier = clamp(1 + step, options.multiplierMin, options.multiplierMax);
  if (multiplier === null || Math.abs(multiplier - 1) < 0.000001) return blocked("NO_ADJUSTMENT");

  const replay = replayProbabilityPolicy(safeRows, multiplier);
  const improvement = round((replay.currentBrier ?? 0) - (replay.candidateBrier ?? 0));
  const eligible = improvement !== null && improvement >= options.minImprovement;

  return Object.freeze({
    contractVersion: POLICY_CONTRACT_VERSION,
    proposalId: "V21-" + stableHash(JSON.stringify({
      fingerprint,
      runId: runId || null,
      generatedAt,
      multiplier: round(multiplier),
      records: safeRows.length,
      bias: round(bias)
    })),
    generatedAt,
    datasetFingerprint: fingerprint,
    runId: runId || null,
    status: eligible ? "ELIGIBLE" : "INELIGIBLE",
    eligible,
    reason: eligible ? "REPLAY_IMPROVED" : "REPLAY_NOT_IMPROVED",
    records: safeRows.length,
    multiplier: round(multiplier),
    bias: round(bias),
    improvement,
    replay,
    configuration: options
  });
}

export function normalisePolicyLedger(ledger = []) {
  if (!Array.isArray(ledger)) return [];

  return ledger.map((event) => {
    const decision = String(event?.decision ?? "");
    const decisionId = String(event?.decisionId ?? "");
    const proposalId = String(event?.proposalId ?? "");
    const decidedAt = isoTime(event?.decidedAt);
    const actor = String(event?.actor ?? "").trim();
    const multiplier = clamp(event?.multiplier, 0.05, 3);

    if (!decisionId || !decidedAt || !actor) return null;
    if (!["APPROVE", "REJECT", "ROLLBACK"].includes(decision)) return null;
    if (decision !== "ROLLBACK" && !proposalId) return null;

    return Object.freeze({
      decisionId,
      proposalId: proposalId || null,
      decision,
      actor,
      decidedAt,
      datasetFingerprint: event?.datasetFingerprint ? String(event.datasetFingerprint) : null,
      multiplier: decision === "APPROVE" ? multiplier : null,
      reason: String(event?.reason || "")
    });
  }).filter(Boolean);
}

export function activePolicy(ledger = [], datasetFingerprint = null) {
  const events = normalisePolicyLedger(ledger).filter((event) =>
    !datasetFingerprint ||
    !event.datasetFingerprint ||
    event.datasetFingerprint === String(datasetFingerprint)
  );
  const stack = [];

  events.forEach((event) => {
    if (event.decision === "APPROVE" && event.multiplier !== null) stack.push(event);
    if (event.decision === "ROLLBACK") stack.pop();
  });

  return stack.at(-1) || null;
}

export function decidePolicy({
  ledger = [],
  proposal = null,
  decision = "",
  actor = "",
  now = new Date().toISOString(),
  datasetFingerprint = null,
  reason = ""
} = {}) {
  const safeDecision = String(decision || "").toUpperCase();
  const safeActor = String(actor || "").trim();
  const decidedAt = isoTime(now);
  const fingerprint = datasetFingerprint ? String(datasetFingerprint) : null;
  const current = normalisePolicyLedger(ledger);

  const reject = (cause) => ({
    accepted: false,
    reason: cause,
    ledger: current,
    active: activePolicy(current, fingerprint)
  });

  if (!safeActor) return reject("MISSING_ACTOR");
  if (!decidedAt) return reject("INVALID_TIME");
  if (!["APPROVE", "REJECT", "ROLLBACK"].includes(safeDecision)) return reject("INVALID_DECISION");

  if (safeDecision === "ROLLBACK") {
    const active = activePolicy(current, fingerprint);
    if (!active) return reject("NO_ACTIVE_POLICY");
    const decisionId = "V21D-" + stableHash(JSON.stringify({
      decision: "ROLLBACK",
      proposalId: active.proposalId,
      decidedAt,
      actor: safeActor
    }));
    if (current.some((event) => event.decisionId === decisionId)) return reject("ALREADY_DECIDED");
    const next = [...current, {
      decisionId,
      proposalId: active.proposalId,
      decision: "ROLLBACK",
      actor: safeActor,
      decidedAt,
      datasetFingerprint: fingerprint,
      multiplier: null,
      reason: reason || "operator rollback"
    }].slice(-POLICY_DEFAULTS.historyLimit);
    return {
      accepted: true,
      reason: "ROLLED_BACK",
      ledger: normalisePolicyLedger(next),
      active: activePolicy(next, fingerprint)
    };
  }

  if (!proposal?.proposalId) return reject("MISSING_PROPOSAL");
  if (fingerprint && proposal.datasetFingerprint && proposal.datasetFingerprint !== fingerprint) {
    return reject("DATASET_MISMATCH");
  }
  if (safeDecision === "APPROVE" && !proposal.eligible) return reject("PROPOSAL_NOT_ELIGIBLE");

  const already = current.find((event) =>
    event.proposalId === proposal.proposalId &&
    (event.decision === "APPROVE" || event.decision === "REJECT")
  );
  if (already) return reject("ALREADY_DECIDED");

  const decisionId = "V21D-" + stableHash(JSON.stringify({
    decision: safeDecision,
    proposalId: proposal.proposalId,
    decidedAt,
    actor: safeActor
  }));

  const next = [...current, {
    decisionId,
    proposalId: proposal.proposalId,
    decision: safeDecision,
    actor: safeActor,
    decidedAt,
    datasetFingerprint: fingerprint || proposal.datasetFingerprint || null,
    multiplier: safeDecision === "APPROVE" ? proposal.multiplier : null,
    reason: reason || proposal.reason || ""
  }].slice(-POLICY_DEFAULTS.historyLimit);

  return {
    accepted: true,
    reason: safeDecision === "APPROVE" ? "APPROVED" : "REJECTED",
    ledger: normalisePolicyLedger(next),
    active: activePolicy(next, fingerprint)
  };
}

export function applyPolicyToAssumptions(assumptions = {}, policy = null) {
  const multiplier = clamp(policy?.multiplier, POLICY_DEFAULTS.multiplierMin, POLICY_DEFAULTS.multiplierMax);
  const base = {
    qualified: numeric(assumptions?.qualified),
    nurture: numeric(assumptions?.nurture),
    new: numeric(assumptions?.new),
    downside: numeric(assumptions?.downside),
    upside: numeric(assumptions?.upside)
  };

  if (multiplier === null || !policy) return { ...assumptions };

  return {
    ...assumptions,
    qualified: base.qualified === null ? assumptions.qualified : round(clamp(base.qualified * multiplier, 0, 1)),
    nurture: base.nurture === null ? assumptions.nurture : round(clamp(base.nurture * multiplier, 0, 1)),
    new: base.new === null ? assumptions.new : round(clamp(base.new * multiplier, 0, 1)),
    downside: assumptions.downside,
    upside: assumptions.upside
  };
}

export function summarisePolicy({ proposal = null, ledger = [], datasetFingerprint = null } = {}) {
  const active = activePolicy(ledger, datasetFingerprint);
  return Object.freeze({
    contractVersion: POLICY_CONTRACT_VERSION,
    proposalId: proposal?.proposalId || null,
    status: proposal?.status || "ABSENT",
    eligible: Boolean(proposal?.eligible),
    reason: proposal?.reason || null,
    multiplier: proposal?.multiplier ?? null,
    improvement: proposal?.improvement ?? null,
    records: proposal?.records ?? 0,
    activePolicyId: active?.decisionId || null,
    activeMultiplier: active?.multiplier ?? null,
    decisions: normalisePolicyLedger(ledger).length
  });
}
