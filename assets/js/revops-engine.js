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

export const ACTION_POLICY = Object.freeze({
  qualified: Object.freeze({ priority: "high", lane: "Sales / CS", slaHours: 4, action: "Human review" }),
  nurture: Object.freeze({ priority: "medium", lane: "Lifecycle", slaHours: 24, action: "Add context" }),
  new: Object.freeze({ priority: "low", lane: "RevOps", slaHours: 72, action: "Enrich data" }),
  blocked: Object.freeze({ priority: "critical", lane: "Data / RevOps", slaHours: 2, action: "Fix data quality" })
});

const PRIORITY_RANK = Object.freeze({ critical: 4, high: 3, medium: 2, low: 1 });

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

export function nextAction(lead) {
  if (lead.stage === "qualified") return "Human review → propose next step";
  if (lead.stage === "nurture") return "Add context → monitor intent";
  if (lead.stage === "blocked") return "Fix data quality → evaluate again";
  return "Enrich data → score again";
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
    const blocked = { ...lead, score: null, stage: "blocked", quality, breakdown: {} };
    return { ...blocked, nextAction: nextAction(blocked) };
  }

  const normalized = normaliseWeights(weights);
  const score = Math.round(
    Object.keys(normalized).reduce((sum, key) => sum + clamp(lead[key]) * normalized[key], 0)
  );
  const stage = score >= 75 ? "qualified" : score >= 50 ? "nurture" : "new";

  const result = {
    ...lead,
    score,
    stage,
    quality,
    breakdown: scoreBreakdown(lead, normalized)
  };

  return { ...result, nextAction: nextAction(result) };
}

export function evaluateBatch(leads, weights = DEFAULT_WEIGHTS) {
  return leads.map((lead) => scoreLead(lead, weights));
}

export function summarisePipeline(leads) {
  const scored = leads.filter((lead) => typeof lead.score === "number");
  const byStage = Object.fromEntries(STAGES.map((stage) => [stage, 0]));
  leads.forEach((lead) => {
    if (STAGES.includes(lead?.stage)) byStage[lead.stage] += 1;
  });

  return {
    total: leads.length,
    scored: scored.length,
    qualityIssues: byStage.blocked || 0,
    averageScore: scored.length
      ? Math.round(scored.reduce((sum, lead) => sum + lead.score, 0) / scored.length)
      : 0,
    byStage,
    qualificationRate: scored.length ? byStage.qualified / scored.length : 0
  };
}

function topSignal(lead) {
  const entries = Object.entries(lead.breakdown || {});
  if (!entries.length) return null;
  return entries.sort((a, b) => b[1] - a[1])[0];
}

export function buildActionQueue(leads, now = new Date().toISOString()) {
  const baseTime = new Date(now);
  const safeBase = Number.isNaN(baseTime.getTime()) ? new Date() : baseTime;

  return [...leads]
    .map((lead) => {
      const policy = ACTION_POLICY[lead.stage] || ACTION_POLICY.blocked;
      const top = topSignal(lead);
      const score = typeof lead.score === "number" ? lead.score : 0;
      const urgency = clamp(lead.urgency) ?? 0;
      const priorityRank = PRIORITY_RANK[policy.priority] || 0;
      const priorityScore = Math.round(
        priorityRank * 1000 +
        score * 2 +
        urgency +
        (lead.stage === "qualified" ? lead.intent || 0 : 0)
      );

      const due = new Date(safeBase.getTime() + policy.slaHours * 60 * 60 * 1000);
      const reason = lead.stage === "blocked"
        ? (lead.quality?.errors?.length ? "Data issue: " + lead.quality.errors.join(", ") : "Data quality requires repair")
        : top
          ? "Top contribution: " + top[0] + " +" + top[1]
          : "Pipeline action required";

      return {
        leadId: lead.id,
        account: lead.account || "Unnamed account",
        stage: lead.stage,
        priority: policy.priority,
        lane: policy.lane,
        action: policy.action,
        nextAction: lead.nextAction,
        slaHours: policy.slaHours,
        dueAt: due.toISOString(),
        reason,
        score: lead.score,
        queueScore: priorityScore
      };
    })
    .sort((a, b) => b.queueScore - a.queueScore || String(a.leadId).localeCompare(String(b.leadId)));
}

export function summariseQueue(queue) {
  const byPriority = Object.fromEntries(Object.keys(PRIORITY_RANK).map((key) => [key, 0]));
  const byLane = {};
  queue.forEach((item) => {
    byPriority[item.priority] = (byPriority[item.priority] || 0) + 1;
    byLane[item.lane] = (byLane[item.lane] || 0) + 1;
  });

  return {
    total: queue.length,
    urgent: (byPriority.critical || 0) + (byPriority.high || 0),
    byPriority,
    byLane
  };
}

const STAGE_RANK = Object.freeze({ blocked: 0, new: 1, nurture: 2, qualified: 3 });

export function compareEvaluations(baseLeads, currentLeads) {
  const baseById = new Map(baseLeads.map((lead) => [String(lead.id), lead]));
  const changes = [];

  currentLeads.forEach((current) => {
    const base = baseById.get(String(current.id));
    if (!base) return;

    const stageChanged = base.stage !== current.stage;
    const scoreDelta = typeof base.score === "number" && typeof current.score === "number"
      ? current.score - base.score
      : null;

    if (stageChanged || (scoreDelta !== null && scoreDelta !== 0)) {
      changes.push({
        leadId: current.id,
        account: current.account || "Unnamed account",
        fromStage: base.stage,
        toStage: current.stage,
        scoreDelta,
        kind: current.stage === "blocked"
          ? "blocked"
          : base.stage === "blocked"
            ? "recovered"
            : (STAGE_RANK[current.stage] || 0) > (STAGE_RANK[base.stage] || 0)
              ? "promoted"
              : "demoted"
      });
    }
  });

  const promoted = changes.filter((item) => item.kind === "promoted").length;
  const demoted = changes.filter((item) => item.kind === "demoted").length;
  const blocked = changes.filter((item) => item.kind === "blocked").length;
  const recovered = changes.filter((item) => item.kind === "recovered").length;
  const scoreDeltas = changes.map((item) => item.scoreDelta).filter((value) => typeof value === "number");

  return {
    totalCompared: currentLeads.length,
    changed: changes.length,
    promoted,
    demoted,
    blocked,
    recovered,
    averageScoreDelta: scoreDeltas.length
      ? Math.round(scoreDeltas.reduce((sum, value) => sum + value, 0) / scoreDeltas.length)
      : 0,
    changes
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

  if (!(TRANSITIONS[current] || []).includes(targetStage)) {
    return { ok: false, lead, reason: "Transition not allowed" };
  }

  if ((targetStage === "qualified" || targetStage === "blocked") && !approved) {
    return { ok: false, lead, reason: "Human approval required" };
  }

  return {
    ok: true,
    lead: { ...lead, stage: targetStage },
    reason: "Transition applied"
  };
}

export function auditEvent(action, lead, detail, at = new Date().toISOString()) {
  return { at, action, leadId: lead.id, detail };
}
