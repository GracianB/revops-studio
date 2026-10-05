import { calculateCalibrationMetrics } from "./calibration-engine.js";

export const POLICY_CONTRACT_VERSION = "23.0";

export const POLICY_DEFAULTS = Object.freeze({
  minSamples: 8,
  maxStep: 0.15,
  minImprovement: 0.01,
  multiplierMin: 0.5,
  multiplierMax: 1.5,
  biasFloor: 0.02,
  historyLimit: 24
});

export const POLICY_HARD_MAX_STEP = 0.15;
export const POLICY_ABSOLUTE_MIN = 1 - POLICY_HARD_MAX_STEP;
export const POLICY_ABSOLUTE_MAX = 1 + POLICY_HARD_MAX_STEP;

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

export function buildRowsFingerprint(rows = []) {
  const safeRows = normaliseRows(rows);
  if (!safeRows.length) return null;
  const canonical = safeRows
    .map((row) => ({
      leadId: row.leadId,
      probability: round(row.probability),
      observedSuccess: Number(row.observedSuccess)
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return "D23-" + stableHash(JSON.stringify(canonical));
}

export function buildReplayFingerprint(replay = null) {
  if (!replay || typeof replay !== "object") return null;
  const canonical = {
    records: Number(replay.records),
    multiplier: round(replay.multiplier),
    currentBrier: round(replay.currentBrier),
    candidateBrier: round(replay.candidateBrier),
    currentCalibrationError: round(replay.current?.calibrationError),
    candidateCalibrationError: round(replay.candidate?.calibrationError)
  };
  if (!Number.isFinite(canonical.records) || canonical.multiplier === null ||
      canonical.currentBrier === null || canonical.candidateBrier === null) return null;
  return "R22-" + stableHash(JSON.stringify(canonical));
}

export function verifyPolicyProposal(proposal = null, { rows = null } = {}) {
  if (!proposal || typeof proposal !== "object") return { valid: false, reason: "MISSING_PROPOSAL" };
  if (proposal.contractVersion !== POLICY_CONTRACT_VERSION) return { valid: false, reason: "PROPOSAL_VERSION_MISMATCH" };

  const replay = proposal.replay;
  const fingerprint = buildReplayFingerprint(replay);
  if (!fingerprint || fingerprint !== proposal.replayFingerprint) return { valid: false, reason: "REPLAY_BINDING_MISMATCH" };

  const records = Number(proposal.records);
  if (!Number.isInteger(records) || records < 0 || records !== Number(replay?.records)) {
    return { valid: false, reason: "REPLAY_RECORDS_MISMATCH" };
  }

  const multiplier = Number(proposal.multiplier);
  if (!Number.isFinite(multiplier) || multiplier < POLICY_ABSOLUTE_MIN || multiplier > POLICY_ABSOLUTE_MAX ||
      round(multiplier) !== round(replay.multiplier)) {
    return { valid: false, reason: "POLICY_BOUNDARY_MISMATCH" };
  }

  const currentBrier = Number(replay.currentBrier);
  const candidateBrier = Number(replay.candidateBrier);
  const expectedImprovement = round(currentBrier - candidateBrier);
  if (!Number.isFinite(currentBrier) || !Number.isFinite(candidateBrier) ||
      round(proposal.improvement) !== expectedImprovement) {
    return { valid: false, reason: "REPLAY_IMPROVEMENT_MISMATCH" };
  }

  if (proposal.baseMultiplier !== undefined && round(proposal.baseMultiplier) !== 1) {
    return { valid: false, reason: "BASE_POLICY_MISMATCH" };
  }

  if (!proposal.rowsFingerprint) return { valid: false, reason: "ROWS_FINGERPRINT_MISSING" };
  if (rows === null) return { valid: true, reason: "STRUCTURAL_ONLY", fingerprint };

  const observedRowsFingerprint = buildRowsFingerprint(rows);
  if (!observedRowsFingerprint) return { valid: false, reason: "ROWS_REQUIRED_FOR_APPROVAL" };
  if (observedRowsFingerprint !== proposal.rowsFingerprint) {
    return { valid: false, reason: "ROWS_FINGERPRINT_MISMATCH" };
  }

  const recomputedReplay = replayProbabilityPolicy(rows, multiplier);
  if (recomputedReplay.records !== records) return { valid: false, reason: "REPLAY_RECORDS_MISMATCH" };

  const recomputedFingerprint = buildReplayFingerprint(recomputedReplay);
  if (recomputedFingerprint !== proposal.replayFingerprint) {
    return { valid: false, reason: "REPLAY_ROWS_MISMATCH" };
  }

  if (round(recomputedReplay.currentBrier) !== round(currentBrier) ||
      round(recomputedReplay.candidateBrier) !== round(candidateBrier)) {
    return { valid: false, reason: "REPLAY_BRIER_MISMATCH" };
  }

  return {
    valid: true,
    reason: "REPLAY_ROWS_VERIFIED",
    fingerprint,
    rowsFingerprint: observedRowsFingerprint
  };
}

export function normalisePolicyConfig(config = {}) {
  const defaults = POLICY_DEFAULTS;
  const minSamples = Math.round(clamp(config.minSamples, 1, 10000) ?? defaults.minSamples);
  const maxStep = clamp(config.maxStep, 0.001, POLICY_HARD_MAX_STEP) ?? defaults.maxStep;
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
  const rowsFingerprint = buildRowsFingerprint(safeRows);

  const blocked = (reason) => Object.freeze({
    contractVersion: POLICY_CONTRACT_VERSION,
    proposalId: "V23-" + stableHash(JSON.stringify({
      reason,
      fingerprint,
      runId: runId || null,
      generatedAt,
      records: safeRows.length,
      rowsFingerprint
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
    replayFingerprint: null,
    rowsFingerprint,
    baseMultiplier: 1,
    configuration: options
  });

  if (!report || report.global?.severity !== "WARNING" && report.global?.severity !== "CRITICAL") {
    return blocked("GLOBAL_DRIFT_REQUIRED");
  }
  if (report.global?.sampleSufficient !== true) return blocked("GLOBAL_SAMPLE_INSUFFICIENT");
  if (safeRows.length < options.minSamples) return blocked("SAMPLE_INSUFFICIENT");

  const bias = numeric(metrics.calibrationError);
  if (bias === null || Math.abs(bias) < options.biasFloor) return blocked("BIAS_BELOW_FLOOR");

  const step = clamp(bias, -options.maxStep, options.maxStep);
  const multiplier = clamp(1 + step, POLICY_ABSOLUTE_MIN, POLICY_ABSOLUTE_MAX);
  if (multiplier === null || multiplier < POLICY_ABSOLUTE_MIN || multiplier > POLICY_ABSOLUTE_MAX || Math.abs(multiplier - 1) < 0.000001) return blocked("NO_ADJUSTMENT");

  const replay = replayProbabilityPolicy(safeRows, multiplier);
  const improvement = round((replay.currentBrier ?? 0) - (replay.candidateBrier ?? 0));
  const eligible = improvement !== null && improvement >= options.minImprovement;

  return Object.freeze({
    contractVersion: POLICY_CONTRACT_VERSION,
    proposalId: "V23-" + stableHash(JSON.stringify({
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
    replayFingerprint: buildReplayFingerprint(replay),
    rowsFingerprint,
    baseMultiplier: 1,
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
    const multiplier = clamp(event?.multiplier, POLICY_ABSOLUTE_MIN, POLICY_ABSOLUTE_MAX);
    const datasetEventFingerprint = event?.datasetFingerprint ? String(event.datasetFingerprint) : null;
    const policyId = event?.policyId ? String(event.policyId) : null;
    const replayFingerprint = event?.replayFingerprint ? String(event.replayFingerprint) : null;

    if (!decisionId || !decidedAt || !actor) return null;
    if (!["APPROVE", "REJECT", "ROLLBACK"].includes(decision)) return null;
    if (decision !== "ROLLBACK" && !proposalId) return null;
    if (decision === "APPROVE" && (!multiplier || !datasetEventFingerprint || !policyId || !replayFingerprint)) return null;

    return Object.freeze({
      decisionId,
      proposalId: proposalId || null,
      decision,
      actor,
      decidedAt,
      datasetFingerprint: datasetEventFingerprint,
      multiplier: decision === "APPROVE" ? multiplier : null,
      policyId,
      replayFingerprint,
      baseMultiplier: numeric(event?.baseMultiplier) === null ? 1 : round(event.baseMultiplier),
      reason: String(event?.reason || "")
    });
  }).filter(Boolean);
}

export function activePolicy(ledger = [], datasetFingerprint = null) {
  if (!datasetFingerprint) return null;
  const events = normalisePolicyLedger(ledger).filter((event) =>
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
  reason = "",
  rows = []
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
  if ((safeDecision === "APPROVE" || safeDecision === "ROLLBACK") && !fingerprint) {
    return reject("DATASET_FINGERPRINT_REQUIRED");
  }

  if (safeDecision === "ROLLBACK") {
    const active = activePolicy(current, fingerprint);
    if (!active) return reject("NO_ACTIVE_POLICY");
    const decisionId = "V23D-" + stableHash(JSON.stringify({
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
      policyId: "V23P-" + stableHash(JSON.stringify({
        rollbackOf: active.policyId || active.decisionId,
        decidedAt,
        actor: safeActor
      })),
      replayFingerprint: active.replayFingerprint || null,
      baseMultiplier: 1,
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
  if (safeDecision === "APPROVE") {
    const verification = verifyPolicyProposal(proposal, { rows });
    if (!verification.valid) return reject(verification.reason);
    if (!fingerprint || fingerprint !== String(proposal.datasetFingerprint || "")) {
      return reject("DATASET_FINGERPRINT_REQUIRED");
    }
  }

  const already = current.find((event) =>
    event.proposalId === proposal.proposalId &&
    (event.decision === "APPROVE" || event.decision === "REJECT")
  );
  if (already) return reject("ALREADY_DECIDED");

  const decisionId = "V23D-" + stableHash(JSON.stringify({
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
    policyId: safeDecision === "APPROVE"
      ? "V23P-" + stableHash(JSON.stringify({
          proposalId: proposal.proposalId,
          multiplier: round(proposal.multiplier),
          replayFingerprint: proposal.replayFingerprint,
          datasetFingerprint: fingerprint,
          decidedAt
        }))
      : null,
    replayFingerprint: safeDecision === "APPROVE" ? proposal.replayFingerprint : null,
    baseMultiplier: 1,
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
  const multiplier = clamp(policy?.multiplier, POLICY_ABSOLUTE_MIN, POLICY_ABSOLUTE_MAX);
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
    activePolicyInstanceId: active?.policyId || null,
    activeMultiplier: active?.multiplier ?? null,
    baseDeviation: active?.multiplier === null || active?.multiplier === undefined ? null : round(Number(active.multiplier) - 1),
    replayFingerprint: proposal?.replayFingerprint || null,
    integrity: proposal ? verifyPolicyProposal(proposal).reason : "ABSENT",
    rowsFingerprint: proposal?.rowsFingerprint || null,
    decisions: normalisePolicyLedger(ledger).length
  });
}
