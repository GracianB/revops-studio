import { calculateCalibrationMetrics } from "./calibration-engine.js";

export const POLICY_CONTRACT_VERSION = "24.0";

export const POLICY_DEFAULTS = Object.freeze({
  minSamples: 8,
  maxStep: 0.15,
  minImprovement: 0.01,
  multiplierMin: 0.5,
  multiplierMax: 1.5,
  biasFloor: 0.02,
  historyLimit: 24,
  proposalTtlHours: 24
});

export const POLICY_HARD_MAX_STEP = 0.15;
export const POLICY_ABSOLUTE_MIN = 1 - POLICY_HARD_MAX_STEP;
export const POLICY_ABSOLUTE_MAX = 1 + POLICY_HARD_MAX_STEP;
export const POLICY_PROPOSAL_TTL_HOURS = 24;
export const POLICY_PROPOSAL_TTL_MS = POLICY_PROPOSAL_TTL_HOURS * 60 * 60 * 1000;

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

const normaliseTextIdentity = (value, maxLength) => {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text || text.length > maxLength || /[\u0000-\u001F\u007F]/.test(text)) return null;
  return text;
};

export function normaliseActor(actor = "") {
  return normaliseTextIdentity(actor, 80);
}

export function normaliseRationale(reason = "") {
  return normaliseTextIdentity(reason, 500);
}

const lineageCanonical = ({
  proposalId = null,
  runId = null,
  sourceRunId = null,
  datasetFingerprint = null,
  rowsFingerprint = null,
  replayFingerprint = null,
  policyId = null,
  decidedAt = null,
  actor = null
} = {}) => ({
  contractVersion: POLICY_CONTRACT_VERSION,
  proposalId: proposalId || null,
  sourceRunId: runId || sourceRunId || null,
  datasetFingerprint: datasetFingerprint || null,
  rowsFingerprint: rowsFingerprint || null,
  replayFingerprint: replayFingerprint || null,
  policyId: policyId || null,
  decidedAt: isoTime(decidedAt),
  actor: actor || null
});

export function buildPolicyLineageFingerprint(fields = {}) {
  return "L24-" + stableHash(JSON.stringify(lineageCanonical(fields)));
}

export function buildPolicyProposalFingerprint(proposal = null) {
  if (!proposal || typeof proposal !== "object") return null;
  return "P24-" + stableHash(JSON.stringify({
    contractVersion: proposal.contractVersion || null,
    proposalId: proposal.proposalId || null,
    generatedAt: isoTime(proposal.generatedAt),
    datasetFingerprint: proposal.datasetFingerprint || null,
    runId: proposal.runId || null,
    records: Number(proposal.records),
    multiplier: round(proposal.multiplier),
    bias: round(proposal.bias),
    improvement: round(proposal.improvement),
    replayFingerprint: proposal.replayFingerprint || null,
    rowsFingerprint: proposal.rowsFingerprint || null,
    baseMultiplier: round(proposal.baseMultiplier)
  }));
}

export function buildPolicyInstanceFingerprint({
  proposalId = null,
  proposalFingerprint = null,
  multiplier = null,
  replayFingerprint = null,
  rowsFingerprint = null,
  datasetFingerprint = null,
  decidedAt = null,
  actor = null,
  rationale = null
} = {}) {
  return "P25-" + stableHash(JSON.stringify({
    proposalId: proposalId || null,
    proposalFingerprint: proposalFingerprint || null,
    multiplier: round(multiplier),
    replayFingerprint: replayFingerprint || null,
    rowsFingerprint: rowsFingerprint || null,
    datasetFingerprint: datasetFingerprint || null,
    decidedAt: isoTime(decidedAt),
    actor: actor || null,
    rationale: rationale || null
  }));
}

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
  return "D24-" + stableHash(JSON.stringify(canonical));
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
  return "R23-" + stableHash(JSON.stringify(canonical));
}

export function verifyPolicyProposal(proposal = null, { rows = null, now = null, config = {} } = {}) {
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

  const expectedProposalFingerprint = buildPolicyProposalFingerprint(proposal);
  if (!expectedProposalFingerprint || expectedProposalFingerprint !== proposal.proposalFingerprint) {
    return { valid: false, reason: "PROPOSAL_FINGERPRINT_MISMATCH" };
  }

  const expectedLineage = lineageCanonical({
    proposalId: proposal.proposalId,
    runId: proposal.runId,
    datasetFingerprint: proposal.datasetFingerprint,
    rowsFingerprint: proposal.rowsFingerprint,
    replayFingerprint: proposal.replayFingerprint
  });
  const suppliedLineage = proposal.lineage || {};
  if (JSON.stringify(suppliedLineage) !== JSON.stringify(expectedLineage)) {
    return { valid: false, reason: "PROPOSAL_LINEAGE_MISMATCH" };
  }
  if (proposal.lineageFingerprint !== buildPolicyLineageFingerprint(expectedLineage)) {
    return { valid: false, reason: "PROPOSAL_LINEAGE_FINGERPRINT_MISMATCH" };
  }

  if (!proposal.rowsFingerprint) return { valid: false, reason: "ROWS_FINGERPRINT_MISSING" };

  if (now !== null) {
    const nowIso = isoTime(now);
    const generatedMs = new Date(proposal.generatedAt).getTime();
    const nowMs = nowIso ? new Date(nowIso).getTime() : NaN;
    const ttlHours = normalisePolicyConfig(config).proposalTtlHours;
    if (!Number.isFinite(nowMs) || !Number.isFinite(generatedMs)) {
      return { valid: false, reason: "INVALID_PROPOSAL_TIME" };
    }
    if (nowMs < generatedMs) return { valid: false, reason: "PROPOSAL_TIME_TRAVEL" };
    if (nowMs - generatedMs > ttlHours * 60 * 60 * 1000) {
      return { valid: false, reason: "PROPOSAL_EXPIRED" };
    }
  }
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
    historyLimit: Math.round(clamp(config.historyLimit, 1, 120) ?? defaults.historyLimit),
    proposalTtlHours: Math.round(clamp(config.proposalTtlHours, 1, 168) ?? defaults.proposalTtlHours)
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

  const freezeProposal = (payload) => {
    const lineage = lineageCanonical({
      proposalId: payload.proposalId,
      runId: payload.runId,
      datasetFingerprint: payload.datasetFingerprint,
      rowsFingerprint: payload.rowsFingerprint,
      replayFingerprint: payload.replayFingerprint
    });
    return Object.freeze({
      ...payload,
      proposalFingerprint: buildPolicyProposalFingerprint(payload),
      lineage: Object.freeze(lineage),
      lineageFingerprint: buildPolicyLineageFingerprint(lineage)
    });
  };

  const blocked = (reason) => freezeProposal({
    contractVersion: POLICY_CONTRACT_VERSION,
    proposalId: "V25-" + stableHash(JSON.stringify({
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

  return freezeProposal({
    contractVersion: POLICY_CONTRACT_VERSION,
    proposalId: "V25-" + stableHash(JSON.stringify({
      fingerprint,
      runId: runId || null,
      generatedAt,
      multiplier: round(multiplier),
      records: safeRows.length,
      bias: round(bias),
      rowsFingerprint
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
    const rawMultiplier = numeric(event?.multiplier);
    const multiplier = clamp(rawMultiplier, POLICY_ABSOLUTE_MIN, POLICY_ABSOLUTE_MAX);
    const datasetEventFingerprint = event?.datasetFingerprint ? String(event.datasetFingerprint) : null;
    const policyId = event?.policyId ? String(event.policyId) : null;
    const replayFingerprint = event?.replayFingerprint ? String(event.replayFingerprint) : null;
    const rationale = normaliseRationale(event?.rationale ?? event?.reason);
    const sourceRunId = event?.runId ? String(event.runId) : null;
    const proposalGeneratedAt = isoTime(event?.proposalGeneratedAt);
    const proposalFingerprint = event?.proposalFingerprint ? String(event.proposalFingerprint) : null;
    const rowsFingerprint = event?.rowsFingerprint ? String(event.rowsFingerprint) : null;
    const lineageFingerprint = event?.lineageFingerprint ? String(event.lineageFingerprint) : null;

    if (!decisionId || !decidedAt || !actor || !rationale || !lineageFingerprint) return null;
    if (!["APPROVE", "REJECT", "ROLLBACK"].includes(decision)) return null;
    if (decision !== "ROLLBACK" && !proposalId) return null;
    if (decision !== "APPROVE" && !rationale) return null;
    if (decision === "ROLLBACK" && (!datasetEventFingerprint || !policyId || !sourceRunId)) return null;
    if (
      decision === "APPROVE" &&
      (rawMultiplier === null ||
       rawMultiplier < POLICY_ABSOLUTE_MIN ||
       rawMultiplier > POLICY_ABSOLUTE_MAX ||
       !datasetEventFingerprint ||
       !policyId ||
       !replayFingerprint ||
       !rowsFingerprint ||
       !sourceRunId ||
       !proposalGeneratedAt ||
       !proposalFingerprint)
    ) return null;

    const expectedLineageFingerprint = buildPolicyLineageFingerprint({
      proposalId: proposalId || null,
      runId: sourceRunId,
      datasetFingerprint: datasetEventFingerprint,
      rowsFingerprint,
      replayFingerprint,
      policyId,
      decidedAt,
      actor
    });
    if (lineageFingerprint !== expectedLineageFingerprint) return null;

    return Object.freeze({
      decisionId,
      proposalId: proposalId || null,
      decision,
      actor,
      decidedAt,
      runId: sourceRunId,
      proposalGeneratedAt,
      datasetFingerprint: datasetEventFingerprint,
      multiplier: decision === "APPROVE" ? multiplier : null,
      policyId,
      replayFingerprint,
      rowsFingerprint,
      proposalFingerprint,
      lineageFingerprint,
      baseMultiplier: numeric(event?.baseMultiplier) === null ? 1 : round(event.baseMultiplier),
      rationale,
      reason: rationale
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
  const safeActor = normaliseActor(actor);
  const safeRationale = normaliseRationale(reason);
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
  const actorToken = String(actor || "").trim().toLowerCase();
  const genericActorTokens = new Set(["operator", "default-actor", "default", "system", "unknown", "anonymous"]);
  if (genericActorTokens.has(actorToken)) return reject("ACTOR_IDENTITY_REQUIRED");
  if (!safeRationale) return reject("MISSING_RATIONALE");
  if (!decidedAt) return reject("INVALID_TIME");
  if (!["APPROVE", "REJECT", "ROLLBACK"].includes(safeDecision)) return reject("INVALID_DECISION");
  if ((safeDecision === "APPROVE" || safeDecision === "ROLLBACK") && !fingerprint) {
    return reject("DATASET_FINGERPRINT_REQUIRED");
  }

  if (safeDecision === "ROLLBACK") {
    const active = activePolicy(current, fingerprint);
    if (!active) return reject("NO_ACTIVE_POLICY");
    const decisionId = "V25D-" + stableHash(JSON.stringify({
      decision: "ROLLBACK",
      proposalId: active.proposalId,
      decidedAt,
      actor: safeActor,
      rationale: safeRationale
    }));
    if (current.some((event) => event.decisionId === decisionId)) return reject("ALREADY_DECIDED");
    const policyId = "V25P-" + stableHash(JSON.stringify({
      rollbackOf: active.policyId || active.decisionId,
      decidedAt,
      actor: safeActor,
      rationale: safeRationale
    }));
    const nextEvent = {
      decisionId,
      proposalId: active.proposalId,
      decision: "ROLLBACK",
      actor: safeActor,
      decidedAt,
      runId: active.runId || null,
      proposalGeneratedAt: active.proposalGeneratedAt || null,
      datasetFingerprint: fingerprint,
      multiplier: null,
      policyId,
      replayFingerprint: active.replayFingerprint || null,
      rowsFingerprint: active.rowsFingerprint || null,
      proposalFingerprint: active.proposalFingerprint || null,
      lineageFingerprint: buildPolicyLineageFingerprint({
        proposalId: active.proposalId,
        runId: active.runId || null,
        datasetFingerprint: fingerprint,
        rowsFingerprint: active.rowsFingerprint || null,
        replayFingerprint: active.replayFingerprint || null,
        policyId,
        decidedAt,
        actor: safeActor
      }),
      baseMultiplier: 1,
      rationale: safeRationale
    };
    const next = [...current, nextEvent].slice(-POLICY_DEFAULTS.historyLimit);
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
    const verification = verifyPolicyProposal(proposal, { rows, now: decidedAt, config: proposal?.configuration || {} });
    if (!verification.valid) return reject(verification.reason);
    if (!proposal.runId) return reject("SOURCE_RUN_ID_REQUIRED");
    if (!fingerprint || fingerprint !== String(proposal.datasetFingerprint || "")) {
      return reject("DATASET_FINGERPRINT_REQUIRED");
    }
  }

  const already = current.find((event) =>
    event.proposalId === proposal.proposalId &&
    (event.decision === "APPROVE" || event.decision === "REJECT")
  );
  if (already) return reject("ALREADY_DECIDED");

  const proposalFingerprint = proposal.proposalFingerprint || buildPolicyProposalFingerprint(proposal);
  const policyId = safeDecision === "APPROVE"
    ? buildPolicyInstanceFingerprint({
        proposalId: proposal.proposalId,
        proposalFingerprint,
        multiplier: proposal.multiplier,
        replayFingerprint: proposal.replayFingerprint,
        rowsFingerprint: proposal.rowsFingerprint,
        datasetFingerprint: fingerprint,
        decidedAt,
        actor: safeActor,
        rationale: safeRationale
      })
    : null;
  const decisionId = "V25D-" + stableHash(JSON.stringify({
    decision: safeDecision,
    proposalId: proposal.proposalId,
    proposalFingerprint,
    decidedAt,
    actor: safeActor,
    rationale: safeRationale
  }));

  const datasetScope = fingerprint || proposal.datasetFingerprint || null;
  const nextEvent = {
    decisionId,
    proposalId: proposal.proposalId,
    decision: safeDecision,
    actor: safeActor,
    decidedAt,
    runId: proposal.runId || null,
    proposalGeneratedAt: isoTime(proposal.generatedAt),
    datasetFingerprint: datasetScope,
    multiplier: safeDecision === "APPROVE" ? proposal.multiplier : null,
    policyId,
    replayFingerprint: proposal.replayFingerprint || null,
    rowsFingerprint: proposal.rowsFingerprint || null,
    proposalFingerprint,
    lineageFingerprint: buildPolicyLineageFingerprint({
      proposalId: proposal.proposalId,
      runId: proposal.runId || null,
      datasetFingerprint: datasetScope,
      rowsFingerprint: proposal.rowsFingerprint || null,
      replayFingerprint: proposal.replayFingerprint || null,
      policyId,
      decidedAt,
      actor: safeActor
    }),
    baseMultiplier: 1,
    rationale: safeRationale
  };
  const next = [...current, nextEvent].slice(-POLICY_DEFAULTS.historyLimit);

  return {
    accepted: true,
    reason: safeDecision === "APPROVE" ? "APPROVED" : "REJECTED",
    ledger: normalisePolicyLedger(next),
    active: activePolicy(next, fingerprint)
  };
}

export function verifyPolicyLedger(ledger = [], { datasetFingerprint = null } = {}) {
  if (!Array.isArray(ledger)) return { valid: false, reason: "LEDGER_INVALID" };
  if (!ledger.length) {
    return { valid: true, reason: "LEDGER_EMPTY", eventCount: 0, active: null };
  }

  const scope = datasetFingerprint ? String(datasetFingerprint) : null;
  const seenDecisionIds = new Set();
  const seenProposalDecisions = new Set();
  const stacks = new Map();
  let previousTime = null;
  let scopedCount = 0;

  for (let index = 0; index < ledger.length; index += 1) {
    const raw = ledger[index];
    const event = normalisePolicyLedger([raw])[0];
    if (!event) return { valid: false, reason: "LEDGER_EVENT_INVALID", index };

    if (seenDecisionIds.has(event.decisionId)) {
      return { valid: false, reason: "LEDGER_DUPLICATE_DECISION_ID", index };
    }
    seenDecisionIds.add(event.decisionId);

    const time = new Date(event.decidedAt).getTime();
    if (previousTime !== null && time < previousTime) {
      return { valid: false, reason: "LEDGER_ORDER_INVALID", index };
    }
    previousTime = time;

    if (scope && event.datasetFingerprint !== scope) continue;
    scopedCount += 1;

    const stack = stacks.get(event.datasetFingerprint) || [];
    const proposalKey = event.proposalId || event.decisionId;

    if (event.decision === "APPROVE") {
      if (seenProposalDecisions.has(event.proposalId)) {
        return { valid: false, reason: "LEDGER_DUPLICATE_PROPOSAL_DECISION", index };
      }
      seenProposalDecisions.add(event.proposalId);
      const expectedPolicyId = buildPolicyInstanceFingerprint({
        proposalId: event.proposalId,
        proposalFingerprint: event.proposalFingerprint,
        multiplier: event.multiplier,
        replayFingerprint: event.replayFingerprint,
        rowsFingerprint: event.rowsFingerprint,
        datasetFingerprint: event.datasetFingerprint,
        decidedAt: event.decidedAt,
        actor: event.actor,
        rationale: event.rationale
      });
      if (expectedPolicyId !== event.policyId) {
        return { valid: false, reason: "POLICY_ID_MISMATCH", index };
      }
      stack.push(event);
    } else if (event.decision === "REJECT") {
      if (seenProposalDecisions.has(proposalKey)) {
        return { valid: false, reason: "LEDGER_DUPLICATE_PROPOSAL_DECISION", index };
      }
      seenProposalDecisions.add(proposalKey);
    } else if (event.decision === "ROLLBACK") {
      const active = stack.at(-1);
      if (!active) return { valid: false, reason: "ROLLBACK_WITHOUT_ACTIVE_POLICY", index };
      if (event.proposalId !== active.proposalId ||
          event.runId !== active.runId ||
          event.datasetFingerprint !== active.datasetFingerprint ||
          event.rowsFingerprint !== active.rowsFingerprint ||
          event.replayFingerprint !== active.replayFingerprint ||
          event.proposalFingerprint !== active.proposalFingerprint) {
        return { valid: false, reason: "ROLLBACK_LINEAGE_MISMATCH", index };
      }
      stack.pop();
    }

    stacks.set(event.datasetFingerprint, stack);
  }

  const scopedStack = scope
    ? (stacks.get(scope) || [])
    : [...stacks.values()].flat();
  return {
    valid: true,
    reason: "LEDGER_REPLAY_VERIFIED",
    eventCount: scopedCount,
    active: scopedStack.at(-1) || null
  };
}

export function verifyActivePolicy(active = null, { rows = null, datasetFingerprint = null } = {}) {
  if (!active) return { valid: false, reason: "NO_ACTIVE_POLICY" };
  if (!datasetFingerprint) return { valid: false, reason: "DATASET_FINGERPRINT_REQUIRED" };
  if (active.datasetFingerprint !== String(datasetFingerprint)) {
    return { valid: false, reason: "ACTIVE_DATASET_MISMATCH" };
  }
  const expectedPolicyId = buildPolicyInstanceFingerprint({
    proposalId: active.proposalId,
    proposalFingerprint: active.proposalFingerprint,
    multiplier: active.multiplier,
    replayFingerprint: active.replayFingerprint,
    rowsFingerprint: active.rowsFingerprint,
    datasetFingerprint: active.datasetFingerprint,
    decidedAt: active.decidedAt,
    actor: active.actor,
    rationale: active.rationale
  });
  if (expectedPolicyId !== active.policyId) {
    return { valid: false, reason: "POLICY_ID_MISMATCH" };
  }

  const expectedLineage = lineageCanonical({
    proposalId: active.proposalId,
    runId: active.runId,
    datasetFingerprint: active.datasetFingerprint,
    rowsFingerprint: active.rowsFingerprint,
    replayFingerprint: active.replayFingerprint,
    policyId: active.policyId,
    decidedAt: active.decidedAt,
    actor: active.actor
  });
  if (active.lineageFingerprint !== buildPolicyLineageFingerprint(expectedLineage)) {
    return { valid: false, reason: "ACTIVE_LINEAGE_MISMATCH" };
  }

  if (rows === null) return { valid: true, reason: "ACTIVE_STRUCTURAL_ONLY" };
  const observedRowsFingerprint = buildRowsFingerprint(rows);
  if (!observedRowsFingerprint) return { valid: false, reason: "ROWS_REQUIRED_FOR_ACTIVE_REPLAY" };
  if (observedRowsFingerprint !== active.rowsFingerprint) {
    return { valid: false, reason: "ACTIVE_ROWS_MISMATCH" };
  }

  const replay = replayProbabilityPolicy(rows, active.multiplier);
  if (buildReplayFingerprint(replay) !== active.replayFingerprint) {
    return { valid: false, reason: "ACTIVE_REPLAY_MISMATCH" };
  }

  return {
    valid: true,
    reason: "ACTIVE_REPLAY_VERIFIED",
    rowsFingerprint: observedRowsFingerprint,
    replayFingerprint: active.replayFingerprint
  };
}

export function replayPolicyLedger(ledger = [], options = {}) {
  return verifyPolicyLedger(ledger, options);
}

export function buildPolicyDecisionLineage({ proposal = null, decisionEvent = null } = {}) {
  const source = decisionEvent || proposal || {};
  return Object.freeze(lineageCanonical({
    proposalId: source.proposalId || null,
    runId: source.runId || source.sourceRunId || null,
    datasetFingerprint: source.datasetFingerprint || null,
    rowsFingerprint: source.rowsFingerprint || null,
    replayFingerprint: source.replayFingerprint || null,
    policyId: source.policyId || source.activePolicyInstanceId || null,
    decidedAt: source.decidedAt || null,
    actor: source.actor || null
  }));
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

export function summarisePolicy({ proposal = null, ledger = [], datasetFingerprint = null, rows = null } = {}) {
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
    proposalFingerprint: proposal?.proposalFingerprint || null,
    proposalLineageFingerprint: proposal?.lineageFingerprint || null,
    sourceRunId: proposal?.runId || null,
    proposalIntegrity: proposal ? verifyPolicyProposal(proposal, { rows }).reason : "ABSENT",
    integrity: proposal ? verifyPolicyProposal(proposal, { rows }).reason : "ABSENT",
    ledgerIntegrity: verifyPolicyLedger(ledger, { datasetFingerprint }).reason,
    activePolicyIntegrity: active
      ? verifyActivePolicy(active, { rows, datasetFingerprint }).reason
      : "NO_ACTIVE_POLICY",
    lineageReplay: verifyPolicyLedger(ledger, { datasetFingerprint }).valid &&
      (!active || verifyActivePolicy(active, { rows, datasetFingerprint }).valid)
      ? "VERIFIED"
      : "REJECTED",
    rowsFingerprint: proposal?.rowsFingerprint || null,
    activeActor: active?.actor || null,
    activeRationale: active?.rationale || null,
    activeRunId: active?.runId || null,
    activeDatasetFingerprint: active?.datasetFingerprint || null,
    activeRowsFingerprint: active?.rowsFingerprint || null,
    activeReplayFingerprint: active?.replayFingerprint || null,
    activeLineageFingerprint: active?.lineageFingerprint || null,
    decisions: normalisePolicyLedger(ledger).length
  });
}
