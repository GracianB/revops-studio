/**
 * RevOps Studio · V18 Outcome & Feedback Engine
 * Pure, deterministic, local-first feedback analysis.
 */

export const OUTCOME_TYPES = Object.freeze({
  RESPONSE: "REPLIED",
  MEETING: "MEETING_BOOKED",
  OPPORTUNITY: "OPPORTUNITY_CREATED",
  WON: "CLOSED_WON",
  LOST: "CLOSED_LOST",
  NO_RESPONSE: "NO_RESPONSE"
});

export const POSITIVE_OUTCOMES = Object.freeze([
  OUTCOME_TYPES.RESPONSE,
  OUTCOME_TYPES.MEETING,
  OUTCOME_TYPES.OPPORTUNITY,
  OUTCOME_TYPES.WON
]);

const TERMINAL_OUTCOMES = Object.freeze([OUTCOME_TYPES.WON, OUTCOME_TYPES.LOST]);

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const text = (value, fallback = "") => {
  const s = String(value ?? "").trim();
  return s || fallback;
};

const stable = (value) => {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + stable(value[k])).join(",") + "}";
  }
  return JSON.stringify(value);
};

const hash = (value) => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
};

const round = (value, places = 4) => {
  const n = num(value);
  if (n === null) return null;
  const factor = 10 ** places;
  return Math.round((n + Number.EPSILON) * factor) / factor;
};

export function validateOutcome(outcome = {}) {
  const errors = [];
  if (!text(outcome.runId)) errors.push("runId: missing");
  if (!text(outcome.leadId)) errors.push("leadId: missing");
  if (!Object.values(OUTCOME_TYPES).includes(outcome.type)) errors.push("type: invalid");
  if (!text(outcome.occurredAt)) errors.push("occurredAt: missing");
  if (outcome.actualValue != null && num(outcome.actualValue) === null) errors.push("actualValue: invalid");
  if (outcome.actualRevenue != null && num(outcome.actualRevenue) === null) errors.push("actualRevenue: invalid");
  if (outcome.responseHours != null && (num(outcome.responseHours) === null || num(outcome.responseHours) < 0)) {
    errors.push("responseHours: invalid");
  }
  return { valid: errors.length === 0, errors };
}

export function createOutcomeRecord({
  runId, leadId, actionId = null, action = null, type, occurredAt,
  actor = "operator", source = "simulation", expectedProbability = null,
  expectedValue = null, actualValue = null, actualRevenue = null,
  responseHours = null, slaHours = null, note = ""
} = {}) {
  const record = {
    runId: text(runId),
    leadId: text(leadId),
    actionId: text(actionId) || null,
    action: text(action) || null,
    type,
    occurredAt: text(occurredAt),
    actor: text(actor, "operator"),
    source: text(source, "simulation"),
    expectedProbability: num(expectedProbability),
    expectedValue: num(expectedValue),
    actualValue: num(actualValue),
    actualRevenue: num(actualRevenue),
    responseHours: num(responseHours),
    slaHours: num(slaHours),
    note: text(note)
  };
  const quality = validateOutcome(record);
  if (!quality.valid) throw new Error("Invalid outcome: " + quality.errors.join(", "));
  const outcomeId = "OUT-" + hash(stable(record)).toUpperCase();
  return Object.freeze({
    contractVersion: "18.0",
    outcomeId,
    ...record,
    positive: POSITIVE_OUTCOMES.includes(type),
    terminal: TERMINAL_OUTCOMES.includes(type),
    slaBreached: record.responseHours != null && record.slaHours != null
      ? record.responseHours > record.slaHours
      : null
  });
}

export function fingerprintOutcomes(outcomes = []) {
  const rows = Array.isArray(outcomes) ? [...outcomes] : [];
  rows.sort((a, b) => String(a?.outcomeId ?? "").localeCompare(String(b?.outcomeId ?? "")));
  return hash(stable(rows));
}

export function createOutcomeLedger({
  runId = null, datasetFingerprint = null, source = "simulation"
} = {}) {
  const identity = { contractVersion: "18.0", runId, datasetFingerprint, source };
  return Object.freeze({
    contractVersion: "18.0",
    ledgerType: "REVOPS_OUTCOME_LEDGER",
    ledgerId: "OUTLEDGER-" + hash(stable(identity)).toUpperCase(),
    runId,
    datasetFingerprint,
    source,
    sequence: 0,
    outcomeFingerprint: fingerprintOutcomes([]),
    outcomes: Object.freeze([])
  });
}

export function appendOutcome(ledger, outcome) {
  if (!ledger || ledger.contractVersion !== "18.0" || ledger.ledgerType !== "REVOPS_OUTCOME_LEDGER") {
    return { accepted: false, duplicate: false, reason: "Invalid outcome ledger.", ledger, outcome: null };
  }
  const quality = validateOutcome(outcome);
  if (!quality.valid) {
    return { accepted: false, duplicate: false, reason: quality.errors.join(", "), ledger, outcome: null };
  }
  const duplicate = ledger.outcomes.find((item) =>
    item.outcomeId === outcome.outcomeId ||
    (item.runId === outcome.runId && item.leadId === outcome.leadId &&
     item.actionId === outcome.actionId && item.type === outcome.type)
  );
  if (duplicate) return { accepted: false, duplicate: true, reason: "Duplicate outcome.", ledger, outcome: duplicate };
  const outcomes = [...ledger.outcomes, outcome];
  const next = Object.freeze({
    ...ledger,
    sequence: outcomes.length,
    outcomeFingerprint: fingerprintOutcomes(outcomes),
    outcomes: Object.freeze(outcomes)
  });
  return { accepted: true, duplicate: false, reason: "Outcome appended.", ledger: next, outcome };
}

export function buildOutcomeSummary(outcomes = []) {
  const rows = Array.isArray(outcomes) ? outcomes : [];
  const terminal = rows.filter((r) => r.terminal);
  const wins = rows.filter((r) => r.type === OUTCOME_TYPES.WON);
  const observedSla = rows.filter((r) => r.slaBreached !== null);
  const response = rows.map((r) => num(r.responseHours)).filter((r) => r !== null).sort((a, b) => a - b);
  const actualValue = rows.reduce((s, r) => s + (num(r.actualValue) ?? 0), 0);
  const actualRevenue = rows.reduce((s, r) => s + (num(r.actualRevenue) ?? 0), 0);
  const expectedValue = rows.reduce((s, r) => s + (num(r.expectedValue) ?? 0), 0);
  const medianResponseHours = response.length
    ? response.length % 2 ? response[Math.floor(response.length / 2)] :
      round((response[response.length / 2 - 1] + response[response.length / 2]) / 2, 4)
    : null;

  return {
    total: rows.length,
    positive: rows.filter((r) => r.positive).length,
    positiveRate: rows.length ? rows.filter((r) => r.positive).length / rows.length : 0,
    responses: rows.filter((r) => r.type === OUTCOME_TYPES.RESPONSE).length,
    meetings: rows.filter((r) => r.type === OUTCOME_TYPES.MEETING).length,
    opportunities: rows.filter((r) => r.type === OUTCOME_TYPES.OPPORTUNITY).length,
    wins: wins.length,
    losses: rows.filter((r) => r.type === OUTCOME_TYPES.LOST).length,
    terminal: terminal.length,
    winRate: terminal.length ? wins.length / terminal.length : 0,
    expectedValue: round(expectedValue, 2),
    actualValue: round(actualValue, 2),
    valueVariance: round(actualValue - expectedValue, 2),
    actualRevenue: round(actualRevenue, 2),
    medianResponseHours,
    slaBreaches: observedSla.filter((r) => r.slaBreached).length,
    slaObserved: observedSla.length,
    slaAdherence: observedSla.length
      ? 1 - observedSla.filter((r) => r.slaBreached).length / observedSla.length
      : null
  };
}

export function actionEffectiveness(actions = [], outcomes = []) {
  const planByLead = new Map((Array.isArray(actions) ? actions : []).map((a) => [String(a.leadId), a]));
  const groups = {};
  (Array.isArray(outcomes) ? outcomes : []).forEach((outcome) => {
    const action = text(outcome.action, text(planByLead.get(String(outcome.leadId))?.action, "Unknown action"));
    const group = groups[action] ||= {
      action, outcomes: 0, positive: 0, terminal: 0, wins: 0,
      expectedValue: 0, actualValue: 0, actualRevenue: 0, breachedSla: 0, slaObserved: 0
    };
    group.outcomes += 1;
    group.positive += outcome.positive ? 1 : 0;
    group.terminal += outcome.terminal ? 1 : 0;
    group.wins += outcome.type === OUTCOME_TYPES.WON ? 1 : 0;
    group.expectedValue += num(outcome.expectedValue) ?? 0;
    group.actualValue += num(outcome.actualValue) ?? 0;
    group.actualRevenue += num(outcome.actualRevenue) ?? 0;
    if (outcome.slaBreached !== null) {
      group.slaObserved += 1;
      group.breachedSla += outcome.slaBreached ? 1 : 0;
    }
  });
  return Object.values(groups).map((g) => ({
    ...g,
    positiveRate: g.outcomes ? round(g.positive / g.outcomes) : 0,
    winRate: g.terminal ? round(g.wins / g.terminal) : 0,
    valueVariance: round(g.actualValue - g.expectedValue, 2),
    slaAdherence: g.slaObserved ? round(1 - g.breachedSla / g.slaObserved) : null
  })).sort((a, b) => b.positiveRate - a.positiveRate || b.actualValue - a.actualValue || a.action.localeCompare(b.action));
}

export function calibrateForecast(forecastRows = [], outcomes = []) {
  const byLead = new Map();
  (Array.isArray(outcomes) ? outcomes : []).forEach((outcome) => {
    const key = String(outcome.leadId);
    byLead.set(key, [...(byLead.get(key) || []), outcome]);
  });

  const rows = (Array.isArray(forecastRows) ? forecastRows : []).map((forecast) => {
    const leadOutcomes = byLead.get(String(forecast.leadId)) || [];
    if (!leadOutcomes.length) return null;
    const terminal = leadOutcomes.find((o) => o.terminal);
    const success = terminal ? terminal.type === OUTCOME_TYPES.WON : leadOutcomes.some((o) => o.positive);
    return {
      leadId: forecast.leadId,
      account: forecast.account || "Unnamed account",
      expectedProbability: num(forecast.probability) ?? 0,
      observedSuccess: success ? 1 : 0
    };
  }).filter(Boolean);

  if (!rows.length) {
    return { observedRecords: 0, expectedRate: null, actualRate: null, calibrationError: null, brierScore: null, rows: [] };
  }

  const expectedRate = rows.reduce((s, r) => s + r.expectedProbability, 0) / rows.length;
  const actualRate = rows.reduce((s, r) => s + r.observedSuccess, 0) / rows.length;
  const brierScore = rows.reduce((s, r) => s + (r.expectedProbability - r.observedSuccess) ** 2, 0) / rows.length;

  return {
    observedRecords: rows.length,
    expectedRate: round(expectedRate),
    actualRate: round(actualRate),
    calibrationError: round(actualRate - expectedRate),
    brierScore: round(brierScore, 6),
    rows
  };
}

export function buildFeedbackAnalysis({ plan = null, forecast = null, outcomes = [] } = {}) {
  const summary = buildOutcomeSummary(outcomes);
  return Object.freeze({
    contractVersion: "18.0",
    runId: plan?.runId || null,
    outcomeFingerprint: fingerprintOutcomes(outcomes),
    summary,
    effectiveness: actionEffectiveness(plan?.actions || [], outcomes),
    calibration: calibrateForecast(forecast?.rows || [], outcomes)
  });
}

export function createOutcomeEvent(outcome) {
  const safe = outcome || {};
  return Object.freeze({
    type: "OUTCOME_RECORDED",
    runId: safe.runId || null,
    leadId: safe.leadId || null,
    idempotencyKey: safe.outcomeId || null,
    actor: safe.actor || "operator",
    status: safe.type || "UNKNOWN",
    at: safe.occurredAt || null,
    payload: {
      actionId: safe.actionId || null,
      action: safe.action || null,
      expectedProbability: safe.expectedProbability ?? null,
      expectedValue: safe.expectedValue ?? null,
      actualValue: safe.actualValue ?? null,
      actualRevenue: safe.actualRevenue ?? null,
      responseHours: safe.responseHours ?? null,
      slaHours: safe.slaHours ?? null,
      slaBreached: safe.slaBreached ?? null
    }
  });
}
