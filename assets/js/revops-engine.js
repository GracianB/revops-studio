/**
 * RevOps Engine
 * Deterministic, explainable and network-free.
 */
export const STAGES = Object.freeze(["new", "qualified", "nurture", "blocked"]);

export const DEFAULT_WEIGHTS = Object.freeze({
  fit: 0.35,
  intent: 0.30,
  engagement: 0.20,
  urgency: 0.15
});

const clamp = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, numeric));
};

export function normaliseWeights(weights = DEFAULT_WEIGHTS) {
  const values = Object.fromEntries(
    Object.keys(DEFAULT_WEIGHTS).map((key) => [key, Math.max(0, Number(weights[key]) || 0)])
  );
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  if (total === 0) return { ...DEFAULT_WEIGHTS };
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value / total]));
}

export function validateLead(lead) {
  const errors = [];
  for (const key of Object.keys(DEFAULT_WEIGHTS)) {
    if (clamp(lead?.[key]) === null) errors.push(key + ": invalid");
  }
  if (!lead?.id) errors.push("id: missing");
  return { valid: errors.length === 0, errors };
}

export function scoreBreakdown(lead, weights = DEFAULT_WEIGHTS) {
  const normalized = normaliseWeights(weights);
  return Object.fromEntries(
    Object.keys(normalized).map((key) => [key, Math.round(clamp(lead[key]) * normalized[key])])
  );
}

export function scoreLead(lead, weights = DEFAULT_WEIGHTS) {
  const quality = validateLead(lead);
  if (!quality.valid) {
    return {
      ...lead,
      score: null,
      stage: "blocked",
      quality,
      breakdown: {},
      nextAction: "Fix data quality → evaluate again"
    };
  }

  const normalized = normaliseWeights(weights);
  const score = Math.round(
    Object.keys(normalized).reduce((sum, key) => sum + clamp(lead[key]) * normalized[key], 0)
  );
  const stage = score >= 75 ? "qualified" : score >= 50 ? "nurture" : "new";
  const nextAction =
    stage === "qualified"
      ? "Human review → propose next step"
      : stage === "nurture"
        ? "Add context → monitor intent"
        : "Enrich data → score again";

  return {
    ...lead,
    score,
    stage,
    quality,
    breakdown: scoreBreakdown(lead, normalized),
    nextAction
  };
}

export function evaluateBatch(leads, weights = DEFAULT_WEIGHTS) {
  return leads.map((lead) => scoreLead(lead, weights));
}

export function summarisePipeline(leads) {
  const scores = leads.filter((lead) => typeof lead.score === "number");
  const byStage = Object.fromEntries(STAGES.map((stage) => [stage, 0]));
  scores.forEach((lead) => { byStage[lead.stage] += 1; });
  return {
    total: leads.length,
    scored: scores.length,
    qualityIssues: leads.length - scores.length,
    averageScore: scores.length ? Math.round(scores.reduce((sum, lead) => sum + lead.score, 0) / scores.length) : 0,
    byStage,
    qualificationRate: scores.length ? byStage.qualified / scores.length : 0
  };
}

const TRANSITIONS = Object.freeze({
  new: ["nurture", "qualified", "blocked"],
  nurture: ["new", "qualified", "blocked"],
  qualified: ["blocked"],
  blocked: ["new", "nurture"]
});

export function transition(lead, targetStage, approved = false) {
  if (!STAGES.includes(targetStage)) throw new Error("Unknown stage");
  const current = lead?.stage || "new";
  if (current === targetStage) return { ok: true, lead, reason: "No-op" };
  if (!(TRANSITIONS[current] || []).includes(targetStage)) return { ok: false, lead, reason: "Transition not allowed" };
  if ((targetStage === "qualified" || targetStage === "blocked") && !approved) {
    return { ok: false, lead, reason: "Human approval required" };
  }
  return { ok: true, lead: { ...lead, stage: targetStage }, reason: "Transition applied" };
}

export function auditEvent(action, lead, detail, at = new Date().toISOString()) {
  return { at, action, leadId: lead.id, detail };
}
