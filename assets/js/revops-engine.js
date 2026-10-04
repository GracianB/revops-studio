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

export const DEFAULT_THRESHOLDS = Object.freeze({
  qualified: 75,
  nurture: 50
});

export const ACTION_POLICY = Object.freeze({
  qualified: Object.freeze({ priority: "high", lane: "Sales / CS", slaHours: 4, action: "Human review" }),
  nurture: Object.freeze({ priority: "medium", lane: "Lifecycle", slaHours: 24, action: "Add context" }),
  new: Object.freeze({ priority: "low", lane: "RevOps", slaHours: 72, action: "Enrich data" }),
  blocked: Object.freeze({ priority: "critical", lane: "Data / RevOps", slaHours: 2, action: "Fix data quality" })
});

const PRIORITY_RANK = Object.freeze({ critical: 4, high: 3, medium: 2, low: 1 });
const STAGE_RANK = Object.freeze({ blocked: 0, new: 1, nurture: 2, qualified: 3 });
const SIGNALS = Object.freeze(Object.keys(DEFAULT_WEIGHTS));

const numeric = (value) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};

const clamp = (value) => {
  const result = numeric(value);
  if (result === null) return null;
  return Math.max(0, Math.min(100, result));
};

export function normaliseWeights(weights = DEFAULT_WEIGHTS) {
  const values = Object.fromEntries(
    SIGNALS.map((key) => [key, Math.max(0, numeric(weights?.[key]) ?? 0)])
  );
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  if (total === 0) return { ...DEFAULT_WEIGHTS };
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value / total]));
}

export function normaliseThresholds(thresholds = DEFAULT_THRESHOLDS) {
  const qualified = clamp(thresholds?.qualified) ?? DEFAULT_THRESHOLDS.qualified;
  const nurture = clamp(thresholds?.nurture) ?? DEFAULT_THRESHOLDS.nurture;
  if (qualified <= nurture) {
    return { ...DEFAULT_THRESHOLDS };
  }
  return { qualified, nurture };
}

export function validateLead(lead) {
  const errors = [];
  for (const key of SIGNALS) {
    const value = numeric(lead?.[key]);
    if (value === null) errors.push(key + ": invalid");
    else if (value < 0 || value > 100) errors.push(key + ": out_of_range");
  }
  if (!String(lead?.id ?? "").trim()) errors.push("id: missing");
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
    SIGNALS.map((key) => [key, Math.round(clamp(lead[key]) * normalized[key])])
  );
}

export function scoreLead(lead, weights = DEFAULT_WEIGHTS, thresholds = DEFAULT_THRESHOLDS) {
  const quality = validateLead(lead);
  if (!quality.valid) {
    const blocked = {
      ...lead,
      score: null,
      stage: "blocked",
      quality,
      breakdown: {},
      thresholdProfile: normaliseThresholds(thresholds)
    };
    return { ...blocked, nextAction: nextAction(blocked) };
  }

  const normalized = normaliseWeights(weights);
  const thresholdProfile = normaliseThresholds(thresholds);
  const score = Math.round(
    SIGNALS.reduce((sum, key) => sum + clamp(lead[key]) * normalized[key], 0)
  );
  const stage = score >= thresholdProfile.qualified
    ? "qualified"
    : score >= thresholdProfile.nurture
      ? "nurture"
      : "new";

  const result = {
    ...lead,
    score,
    stage,
    quality,
    breakdown: scoreBreakdown(lead, normalized),
    thresholdProfile
  };

  return { ...result, nextAction: nextAction(result) };
}

export function evaluateBatch(leads, weights = DEFAULT_WEIGHTS, thresholds = DEFAULT_THRESHOLDS) {
  return (Array.isArray(leads) ? leads : []).map((lead) => scoreLead(lead, weights, thresholds));
}

export function summarisePipeline(leads) {
  const scored = leads.filter((lead) => typeof lead.score === "number");
  const byStage = Object.fromEntries(STAGES.map((stage) => [stage, 0]));

  leads.forEach((lead) => {
    if (STAGES.includes(lead?.stage)) byStage[lead.stage] += 1;
  });

  const scores = scored.map((lead) => lead.score);
  const minScore = scores.length ? Math.min(...scores) : 0;
  const maxScore = scores.length ? Math.max(...scores) : 0;

  return {
    total: leads.length,
    scored: scored.length,
    qualityIssues: byStage.blocked || 0,
    averageScore: scores.length
      ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
      : 0,
    minScore,
    maxScore,
    scoreSpread: scores.length ? maxScore - minScore : 0,
    byStage,
    qualificationRate: scored.length ? byStage.qualified / scored.length : 0
  };
}

function topSignal(lead) {
  const entries = Object.entries(lead.breakdown || {});
  if (!entries.length) return null;
  return entries.sort((a, b) => b[1] - a[1])[0];
}

export function commercialMetrics(leads) {
  const active = leads.filter((lead) => lead.stage !== "blocked");
  const pipelineValue = active.reduce((sum, lead) => sum + (numeric(lead.value) ?? 0), 0);
  const weightedPipeline = active.reduce((sum, lead) => {
    const score = typeof lead.score === "number" ? lead.score : 0;
    return sum + (numeric(lead.value) ?? 0) * score / 100;
  }, 0);
  const qualifiedValue = active
    .filter((lead) => lead.stage === "qualified")
    .reduce((sum, lead) => sum + (numeric(lead.value) ?? 0), 0);
  const staleThresholdDays = 14;
  const staleRecords = active.filter((lead) => {
    const days = numeric(lead.lastTouchDays);
    return days !== null && days > staleThresholdDays;
  });
  const segments = {};
  active.forEach((lead) => {
    const segment = String(lead.segment || "General").trim() || "General";
    segments[segment] = (segments[segment] || 0) + 1;
  });
  const owners = {};
  active.forEach((lead) => {
    const owner = String(lead.owner || "Unassigned").trim() || "Unassigned";
    owners[owner] = (owners[owner] || 0) + 1;
  });

  return {
    currency: "EUR",
    pipelineValue,
    weightedPipeline,
    qualifiedValue,
    staleThresholdDays,
    staleRecords: staleRecords.length,
    staleRate: active.length ? staleRecords.length / active.length : 0,
    segments,
    owners
  };
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
        (lead.stage === "qualified" ? numeric(lead.intent) || 0 : 0) +
        ((numeric(lead.lastTouchDays) ?? 0) > 14 ? 80 : 0) +
        Math.min(50, Math.round((numeric(lead.value) ?? 0) / 10000))
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
        value: numeric(lead.value) ?? 0,
        owner: String(lead.owner || "Unassigned").trim() || "Unassigned",
        segment: String(lead.segment || "General").trim() || "General",
        lastTouchDays: numeric(lead.lastTouchDays),
        stale: (numeric(lead.lastTouchDays) ?? -1) > 14,
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

export function forecastPipeline(leads, assumptions = {}) {
  const probabilities = {
    qualified: Number.isFinite(Number(assumptions.qualified)) ? Number(assumptions.qualified) : 0.80,
    nurture: Number.isFinite(Number(assumptions.nurture)) ? Number(assumptions.nurture) : 0.35,
    new: Number.isFinite(Number(assumptions.new)) ? Number(assumptions.new) : 0.10,
    blocked: 0
  };
  Object.keys(probabilities).forEach((stage) => {
    probabilities[stage] = Math.max(0, Math.min(1, probabilities[stage]));
  });

  const active = leads.filter((lead) => lead.stage !== "blocked");
  const rows = active.map((lead) => {
    const value = numeric(lead.value) ?? 0;
    const probability = probabilities[lead.stage] ?? 0;
    const expected = value * probability;
    return {
      leadId: lead.id,
      account: lead.account || "Unnamed account",
      stage: lead.stage,
      value,
      probability,
      expectedValue: Math.round(expected),
      owner: String(lead.owner || "Unassigned").trim() || "Unassigned",
      segment: String(lead.segment || "General").trim() || "General"
    };
  });

  const pipelineValue = rows.reduce((sum, row) => sum + row.value, 0);
  const expectedValue = rows.reduce((sum, row) => sum + row.expectedValue, 0);
  const leadById = new Map(leads.map((lead) => [String(lead.id), lead]));
  const weightedByScore = rows.reduce((sum, row) => {
    const lead = leadById.get(String(row.leadId));
    const score = typeof lead?.score === "number" ? lead.score : 0;
    return sum + row.value * score / 100;
  }, 0);

  const bySegment = {};
  rows.forEach((row) => {
    if (!bySegment[row.segment]) {
      bySegment[row.segment] = { value: 0, expectedValue: 0, count: 0 };
    }
    bySegment[row.segment].value += row.value;
    bySegment[row.segment].expectedValue += row.expectedValue;
    bySegment[row.segment].count += 1;
  });

  const topAccounts = [...rows]
    .sort((a, b) => b.value - a.value || String(a.leadId).localeCompare(String(b.leadId)))
    .slice(0, 5);

  return {
    probabilities,
    pipelineValue,
    expectedValue,
    weightedByScore: Math.round(weightedByScore),
    expectedCoverage: pipelineValue ? expectedValue / pipelineValue : 0,
    activeRecords: rows.length,
    topAccounts,
    topAccountShare: pipelineValue && topAccounts.length ? topAccounts[0].value / pipelineValue : 0,
    bySegment
  };
}

export function forecastScenarios(leads, assumptions = {}) {
  const base = forecastPipeline(leads, assumptions);
  const multipliers = {
    downside: Number.isFinite(Number(assumptions.downside)) ? Number(assumptions.downside) : 0.75,
    base: 1,
    upside: Number.isFinite(Number(assumptions.upside)) ? Number(assumptions.upside) : 1.15
  };

  return Object.fromEntries(Object.entries(multipliers).map(([name, multiplier]) => [
    name,
    {
      pipelineValue: base.pipelineValue,
      expectedValue: Math.round(base.expectedValue * Math.max(0, multiplier)),
      coverage: base.pipelineValue ? (base.expectedValue / base.pipelineValue) * Math.max(0, multiplier) : 0,
      multiplier
    }
  ]));
}

export function compareEvaluations(baseLeads, currentLeads) {
  const baseById = new Map(baseLeads.map((lead) => [String(lead.id), lead]));
  const changes = [];
  const currentIds = new Set();

  currentLeads.forEach((current) => {
    currentIds.add(String(current.id));
    const base = baseById.get(String(current.id));
    if (!base) {
      changes.push({
        leadId: current.id,
        account: current.account || "Unnamed account",
        fromStage: "missing",
        toStage: current.stage,
        scoreDelta: typeof current.score === "number" ? current.score : null,
        kind: "new"
      });
      return;
    }

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

  const removed = baseLeads.filter((lead) => !currentIds.has(String(lead.id))).map((lead) => ({
    leadId: lead.id,
    account: lead.account || "Unnamed account",
    fromStage: lead.stage,
    toStage: "missing",
    scoreDelta: null,
    kind: "removed"
  }));

  changes.push(...removed);

  return {
    totalCompared: currentLeads.length,
    changed: changes.length,
    promoted: changes.filter((item) => item.kind === "promoted").length,
    demoted: changes.filter((item) => item.kind === "demoted").length,
    blocked: changes.filter((item) => item.kind === "blocked").length,
    recovered: changes.filter((item) => item.kind === "recovered").length,
    newRecords: changes.filter((item) => item.kind === "new").length,
    removedRecords: changes.filter((item) => item.kind === "removed").length,
    averageScoreDelta: (() => {
      const deltas = changes.map((item) => item.scoreDelta).filter((value) => typeof value === "number");
      return deltas.length ? Math.round(deltas.reduce((sum, value) => sum + value, 0) / deltas.length) : 0;
    })(),
    changes
  };
}

export function evaluateScenarios(leads, scenarios = {}, thresholds = DEFAULT_THRESHOLDS) {
  return Object.fromEntries(
    Object.entries(scenarios).map(([name, weights]) => {
      const evaluated = evaluateBatch(leads, weights, thresholds);
      return [name, summarisePipeline(evaluated)];
    })
  );
}

function stableStringify(value) {
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createRunSnapshot({
  records = [],
  weights = DEFAULT_WEIGHTS,
  thresholds = DEFAULT_THRESHOLDS,
  source = "demo",
  scenario = "balanced"
} = {}) {
  const normalizedWeights = normaliseWeights(weights);
  const normalizedThresholds = normaliseThresholds(thresholds);
  const payload = {
    records,
    source,
    scenario,
    thresholds: normalizedThresholds,
    weights: normalizedWeights
  };
  const runId = "RUN-" + hashString(stableStringify(payload)).toUpperCase();

  return {
    runId,
    createdAt: new Date().toISOString(),
    source,
    scenario,
    weights: normalizedWeights,
    thresholds: normalizedThresholds,
    pipeline: summarisePipeline(evaluateBatch(records, normalizedWeights, normalizedThresholds))
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
