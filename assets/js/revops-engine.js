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

// Keep deterministic decimal arithmetic stable across JavaScript's binary floating point.
// Twelve decimal places are more than sufficient for forecast probabilities and currency
// inputs used by this local decision engine.
const roundDecimal = (value, places = 12) => {
  const result = numeric(value);
  if (result === null) return null;
  const factor = 10 ** places;
  return Math.round((result + Number.EPSILON) * factor) / factor;
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
  const raw = SIGNALS.map((key, index) => ({
    key,
    index,
    exact: clamp(lead?.[key]) * normalized[key]
  }));
  const target = Math.round(raw.reduce((sum, item) => sum + item.exact, 0));
  const result = Object.fromEntries(raw.map((item) => [item.key, Math.floor(item.exact)]));
  let remainder = target - Object.values(result).reduce((sum, value) => sum + value, 0);

  raw
    .map((item) => ({
      ...item,
      fraction: item.exact - Math.floor(item.exact)
    }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    .forEach((item) => {
      if (remainder > 0) {
        result[item.key] += 1;
        remainder -= 1;
      }
    });

  return result;
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

export function normaliseForecastAssumptions(assumptions = {}) {
  const defaults = { qualified: 0.80, nurture: 0.35, new: 0.10, downside: 0.75, upside: 1.15 };
  const maxByKey = { qualified: 1, nurture: 1, new: 1, downside: 2, upside: 2 };
  return Object.fromEntries(Object.keys(defaults).map((key) => {
    const value = numeric(assumptions?.[key]);
    return [key, Math.max(0, Math.min(maxByKey[key], value ?? defaults[key]))];
  }));
}

export function forecastPipeline(leads, assumptions = {}) {
  const normalizedForecast = normaliseForecastAssumptions(assumptions);
  const probabilities = {
    qualified: normalizedForecast.qualified,
    nurture: normalizedForecast.nurture,
    new: normalizedForecast.new,
    blocked: 0
  };

  const active = leads.filter((lead) => lead.stage !== "blocked");
  const rows = active.map((lead) => {
    const value = numeric(lead.value) ?? 0;
    const probability = probabilities[lead.stage] ?? 0;
    const expected = roundDecimal(value * probability) ?? 0;
    return {
      leadId: lead.id,
      account: lead.account || "Unnamed account",
      stage: lead.stage,
      value,
      probability,
      expectedValue: Math.round(expected),
      expectedValueExact: expected,
      owner: String(lead.owner || "Unassigned").trim() || "Unassigned",
      segment: String(lead.segment || "General").trim() || "General"
    };
  });

  const pipelineValue = rows.reduce((sum, row) => sum + row.value, 0);
  const expectedValueExact = roundDecimal(
    rows.reduce((sum, row) => sum + row.expectedValueExact, 0)
  ) ?? 0;
  const expectedValue = Math.round(expectedValueExact);
  const leadById = new Map(leads.map((lead) => [String(lead.id), lead]));
  const weightedByScore = rows.reduce((sum, row) => {
    const lead = leadById.get(String(row.leadId));
    const score = typeof lead?.score === "number" ? lead.score : 0;
    return sum + row.value * score / 100;
  }, 0);

  const bySegment = {};
  rows.forEach((row) => {
    if (!bySegment[row.segment]) {
      bySegment[row.segment] = { value: 0, expectedValue: 0, expectedValueExact: 0, count: 0 };
    }
    bySegment[row.segment].value += row.value;
    bySegment[row.segment].expectedValueExact += row.expectedValueExact;
    bySegment[row.segment].count += 1;
  });

  const topAccounts = [...rows]
    .sort((a, b) => b.value - a.value || String(a.leadId).localeCompare(String(b.leadId)))
    .slice(0, 5);

  return {
    probabilities,
    pipelineValue,
    expectedValue,
    expectedValueExact,
    weightedByScore: Math.round(weightedByScore),
    expectedCoverage: pipelineValue ? roundDecimal(expectedValueExact / pipelineValue) : 0,
    activeRecords: rows.length,
    topAccounts,
    topAccountShare: pipelineValue && topAccounts.length ? topAccounts[0].value / pipelineValue : 0,
    bySegment: Object.fromEntries(Object.entries(bySegment).map(([segment, item]) => [
      segment,
      { ...item, expectedValue: Math.round(item.expectedValueExact) }
    ])),
    rows
  };
}

export function forecastScenarios(leads, assumptions = {}) {
  const base = forecastPipeline(leads, assumptions);
  const normalizedForecast = normaliseForecastAssumptions(assumptions);
  const multipliers = {
    downside: normalizedForecast.downside,
    base: 1,
    upside: normalizedForecast.upside
  };

  return Object.fromEntries(Object.entries(multipliers).map(([name, multiplier]) => [
    name,
    {
      pipelineValue: base.pipelineValue,
      expectedValue: Math.round(
        (base.expectedValueExact ?? 0) * Math.max(0, multiplier)
      ),
      coverage: base.pipelineValue
        ? roundDecimal((base.expectedValueExact / base.pipelineValue) * Math.max(0, multiplier))
        : 0,
      multiplier
    }
  ]));
}



export const INTELLIGENCE_DEFAULTS = Object.freeze({
  staleDays: 14,
  highValue: 50000,
  ownerlessValue: 25000,
  highIntent: 80,
  lowEngagement: 40,
  untouchedQualifiedDays: 7,
  unqualifiedHighValue: 30000
});

function median(values) {
  const clean = values.filter((value) => Number.isFinite(Number(value))).map(Number).sort((a, b) => a - b);
  if (!clean.length) return 0;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

function percentile(values, p) {
  const clean = values.filter((value) => Number.isFinite(Number(value))).map(Number).sort((a, b) => a - b);
  if (!clean.length) return 0;
  const index = (clean.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return clean[lower];
  return clean[lower] + (clean[upper] - clean[lower]) * (index - lower);
}

export function normaliseIntelligenceConfig(config = {}) {
  const result = {};
  Object.entries(INTELLIGENCE_DEFAULTS).forEach(([key, fallback]) => {
    const value = numeric(config?.[key]);
    result[key] = value !== null && value >= 0 ? value : fallback;
  });
  return result;
}

function recencyScore(days) {
  const value = numeric(days);
  if (value === null || value < 0) return null;
  if (value <= 3) return 100;
  if (value <= 7) return 90;
  if (value <= 14) return 75;
  if (value <= 30) return 50;
  if (value <= 60) return 25;
  return 0;
}

function healthLabel(score) {
  if (score === null) return "unknown";
  if (score >= 75) return "healthy";
  if (score >= 55) return "watch";
  if (score >= 35) return "risk";
  return "critical";
}

export function accountHealth(lead, config = {}) {
  const options = normaliseIntelligenceConfig(config);
  const signalValues = SIGNALS.map((key) => clamp(lead?.[key]));
  if (signalValues.some((value) => value === null)) {
    return {
      score: null,
      status: "blocked",
      confidence: "low",
      reasons: ["Invalid qualification signal"]
    };
  }

  const signalWeights = { fit: 0.20, intent: 0.25, engagement: 0.20, urgency: 0.15 };
  const recency = recencyScore(lead?.lastTouchDays);
  let score = signalValues[0] * signalWeights.fit +
    signalValues[1] * signalWeights.intent +
    signalValues[2] * signalWeights.engagement +
    signalValues[3] * signalWeights.urgency;
  let denominator = Object.values(signalWeights).reduce((sum, value) => sum + value, 0);

  if (recency !== null) {
    score += recency * 0.20;
    denominator += 0.20;
  }

  score = Math.round(score / denominator);
  const reasons = [];
  if (signalValues[1] >= options.highIntent && signalValues[2] <= options.lowEngagement) {
    reasons.push("Intent high / engagement low");
  }
  if (signalValues[0] < 50 && signalValues[1] >= options.highIntent) {
    reasons.push("Fit / intent mismatch");
  }
  if (recency !== null && recency < 50) reasons.push("Contact recency is weak");
  if (recency === null) reasons.push("Recency context missing");

  return {
    score,
    status: healthLabel(score),
    confidence: recency === null ? "medium" : "high",
    reasons
  };
}

export function segmentIntelligence(leads, forecastAssumptions = {}, forecastOverride = null) {
  const rows = Array.isArray(leads) ? leads : [];
  const forecast = forecastOverride || forecastPipeline(rows, forecastAssumptions);
  const groups = {};
  rows.forEach((lead) => {
    const segment = String(lead?.segment || "General").trim() || "General";
    if (!groups[segment]) {
      groups[segment] = {
        segment,
        records: 0,
        activeRecords: 0,
        blockedRecords: 0,
        pipelineValue: 0,
        qualifiedValue: 0,
        qualifiedRecords: 0,
        weightedPipeline: 0,
        expectedValue: 0,
        qualifiedRate: 0,
        staleRecords: 0,
        staleRate: 0,
        averageScore: 0
      };
    }
    const group = groups[segment];
    group.records += 1;
    if (lead.stage === "blocked") {
      group.blockedRecords += 1;
      return;
    }
    group.activeRecords += 1;
    const value = numeric(lead.value) ?? 0;
    group.pipelineValue += value;
    if (lead.stage === "qualified") {
      group.qualifiedValue += value;
      group.qualifiedRecords += 1;
    }
    if (typeof lead.score === "number") {
      group.weightedPipeline += value * lead.score / 100;
      group.averageScore += lead.score;
    }
    if ((numeric(lead.lastTouchDays) ?? -1) > INTELLIGENCE_DEFAULTS.staleDays) {
      group.staleRecords += 1;
    }
  });

  Object.values(groups).forEach((group) => {
    group.qualifiedRate = group.activeRecords ? group.qualifiedRecords / group.activeRecords : 0;
    group.qualifiedValueShare = group.pipelineValue ? group.qualifiedValue / group.pipelineValue : 0;
    group.staleRate = group.activeRecords ? group.staleRecords / group.activeRecords : 0;
    group.averageScore = group.activeRecords
      ? Math.round(group.averageScore / group.activeRecords)
      : 0;
    const forecastSegment = forecast.bySegment[group.segment];
    group.expectedValue = forecastSegment?.expectedValue || 0;
  });

  const totalPipeline = Object.values(groups).reduce((sum, item) => sum + item.pipelineValue, 0);
  const totalRecords = Object.values(groups).reduce((sum, item) => sum + item.activeRecords, 0);

  return Object.fromEntries(
    Object.entries(groups)
      .map(([key, item]) => [key, {
        ...item,
        pipelineShare: totalPipeline ? item.pipelineValue / totalPipeline : 0,
        recordShare: totalRecords ? item.activeRecords / totalRecords : 0,
        concentrationIndex: totalPipeline && totalRecords
          ? (item.pipelineValue / totalPipeline) / (item.activeRecords / totalRecords)
          : 0
      }])
      .sort((a, b) => b[1].expectedValue - a[1].expectedValue || a[0].localeCompare(b[0]))
  );
}

export function cohortAnalysis(leads, cohortKey = "cohort", forecastAssumptions = {}, forecastOverride = null) {
  const rows = Array.isArray(leads) ? leads : [];
  const forecast = forecastOverride || forecastPipeline(rows, forecastAssumptions);
  const groups = {};

  rows.forEach((lead) => {
    const cohort = String(lead?.[cohortKey] || "Unspecified").trim() || "Unspecified";
    if (!groups[cohort]) {
      groups[cohort] = {
        cohort,
        records: 0,
        activeRecords: 0,
        blockedRecords: 0,
        pipelineValue: 0,
        expectedValue: 0,
        qualifiedRecords: 0,
        staleRecords: 0,
        averageScore: 0
      };
    }
    const group = groups[cohort];
    group.records += 1;
    if (lead.stage === "blocked") {
      group.blockedRecords += 1;
      return;
    }
    group.activeRecords += 1;
    group.pipelineValue += numeric(lead.value) ?? 0;
    if (lead.stage === "qualified") group.qualifiedRecords += 1;
    if (typeof lead.score === "number") group.averageScore += lead.score;
    if ((numeric(lead.lastTouchDays) ?? -1) > INTELLIGENCE_DEFAULTS.staleDays) group.staleRecords += 1;
  });

  const forecastByLeadId = new Map(forecast.rows.map((row) => [String(row.leadId), row]));
  Object.values(groups).forEach((group) => {
    group.qualifiedRate = group.activeRecords ? group.qualifiedRecords / group.activeRecords : 0;
    group.staleRate = group.activeRecords ? group.staleRecords / group.activeRecords : 0;
    group.averageScore = group.activeRecords ? Math.round(group.averageScore / group.activeRecords) : 0;
    const cohortExact = rows
      .filter((lead) => String(lead?.[cohortKey] || "Unspecified").trim() === group.cohort)
      .filter((lead) => lead.stage !== "blocked")
      .reduce((sum, lead) => sum + (forecastByLeadId.get(String(lead.id))?.expectedValueExact ?? 0), 0);
    group.expectedValue = Math.round(cohortExact);
  });

  return Object.values(groups)
    .sort((a, b) => b.expectedValue - a.expectedValue || a.cohort.localeCompare(b.cohort));
}

export function applyBusinessRules(leads, config = {}) {
  const options = normaliseIntelligenceConfig(config);
  const findings = [];

  (Array.isArray(leads) ? leads : []).forEach((lead) => {
    const value = numeric(lead?.value) ?? 0;
    const stale = (numeric(lead?.lastTouchDays) ?? -1) > options.staleDays;
    const owner = String(lead?.owner || "").trim();
    const rules = [];

    if (lead?.stage === "blocked" && value > 0) {
      rules.push({ code: "BLOCKED_REVENUE", severity: "critical", message: "Revenue attached to blocked data." });
    }
    if (lead?.stage !== "blocked" && value >= options.highValue && stale) {
      rules.push({ code: "HIGH_VALUE_STALE", severity: "high", message: "High-value account is stale." });
    }
    if (lead?.stage !== "blocked" && value >= options.ownerlessValue && !owner) {
      rules.push({ code: "OWNERLESS_REVENUE", severity: "high", message: "Material pipeline has no owner." });
    }
    if (lead?.stage === "qualified" && (numeric(lead?.lastTouchDays) ?? 0) > options.untouchedQualifiedDays) {
      rules.push({ code: "QUALIFIED_UNTOUCHED", severity: "high", message: "Qualified account lacks recent touch." });
    }
    if ((numeric(lead?.intent) ?? 0) >= options.highIntent &&
        (numeric(lead?.engagement) ?? 100) <= options.lowEngagement) {
      rules.push({ code: "INTENT_ENGAGEMENT_GAP", severity: "medium", message: "Strong intent with weak engagement." });
    }
    if ((numeric(lead?.fit) ?? 100) < 50 && (numeric(lead?.intent) ?? 0) >= options.highIntent) {
      rules.push({ code: "FIT_INTENT_MISMATCH", severity: "medium", message: "High intent conflicts with low fit." });
    }
    if (lead?.stage !== "blocked" && lead?.stage !== "qualified" && value >= options.unqualifiedHighValue) {
      rules.push({ code: "UNQUALIFIED_VALUE", severity: "medium", message: "Material value sits below qualified stage." });
    }

    rules.forEach((rule) => findings.push({
      ...rule,
      leadId: lead.id,
      account: lead.account || "Unnamed account",
      stage: lead.stage,
      owner: owner || "Unassigned",
      segment: String(lead?.segment || "General").trim() || "General",
      value
    }));
  });

  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
  return findings.sort((a, b) =>
    severityRank[b.severity] - severityRank[a.severity] ||
    b.value - a.value ||
    String(a.leadId).localeCompare(String(b.leadId))
  );
}

export function detectAnomalies(leads, config = {}) {
  const options = normaliseIntelligenceConfig(config);
  const rows = (Array.isArray(leads) ? leads : []).filter((lead) => lead.stage !== "blocked");
  const values = rows.map((lead) => numeric(lead.value)).filter((value) => value !== null && value > 0);
  const q1 = percentile(values, 0.25);
  const q3 = percentile(values, 0.75);
  const iqr = q3 - q1;
  const valueLimit = iqr > 0 ? q3 + iqr * 1.5 : q3 > 0 ? q3 * 2 : 0;
  const anomalies = [];

  rows.forEach((lead) => {
    const value = numeric(lead.value);
    if (value !== null && valueLimit > 0 && value > valueLimit) {
      anomalies.push({
        type: "value_outlier",
        severity: "high",
        leadId: lead.id,
        account: lead.account || "Unnamed account",
        value,
        message: "Deal value is an IQR outlier for this run."
      });
    }
  });

  const overallStaleRate = rows.length
    ? rows.filter((lead) => (numeric(lead.lastTouchDays) ?? -1) > options.staleDays).length / rows.length
    : 0;
  const overallQualifiedRate = rows.length
    ? rows.filter((lead) => lead.stage === "qualified").length / rows.length
    : 0;
  const grouped = {};
  rows.forEach((lead) => {
    const segment = String(lead.segment || "General").trim() || "General";
    if (!grouped[segment]) grouped[segment] = [];
    grouped[segment].push(lead);
  });

  Object.entries(grouped).forEach(([segment, items]) => {
    if (items.length < 2) return;
    const staleRate = items.filter((lead) => (numeric(lead.lastTouchDays) ?? -1) > options.staleDays).length / items.length;
    const qualifiedRate = items.filter((lead) => lead.stage === "qualified").length / items.length;
    const pipeline = items.reduce((sum, lead) => sum + (numeric(lead.value) ?? 0), 0);
    const totalPipeline = rows.reduce((sum, lead) => sum + (numeric(lead.value) ?? 0), 0);
    const recordShare = items.length / rows.length;
    const pipelineShare = totalPipeline ? pipeline / totalPipeline : 0;

    if (staleRate >= overallStaleRate + 0.25) {
      anomalies.push({
        type: "segment_stale_cluster",
        severity: "medium",
        segment,
        message: "Segment stale rate is materially above run baseline.",
        staleRate
      });
    }
    if (qualifiedRate <= overallQualifiedRate - 0.25 && overallQualifiedRate > 0.25) {
      anomalies.push({
        type: "segment_qualification_gap",
        severity: "medium",
        segment,
        message: "Segment qualification rate is materially below run baseline.",
        qualifiedRate
      });
    }
    if (pipelineShare >= 0.20 && pipelineShare > recordShare * 2) {
      anomalies.push({
        type: "segment_value_concentration",
        severity: "high",
        segment,
        message: "Segment owns disproportionately large pipeline value.",
        pipelineShare,
        recordShare
      });
    }
  });

  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
  return {
    total: anomalies.length,
    high: anomalies.filter((item) => item.severity === "high").length,
    medium: anomalies.filter((item) => item.severity === "medium").length,
    items: anomalies.sort((a, b) =>
      severityRank[b.severity] - severityRank[a.severity] ||
      (numeric(b.value) ?? 0) - (numeric(a.value) ?? 0) ||
      String(a.leadId || a.segment || "").localeCompare(String(b.leadId || b.segment || ""))
    )
  };
}

export function revenueLeakage(leads, config = {}) {
  const options = { ...INTELLIGENCE_DEFAULTS, ...config };
  const rows = [];
  const categories = {
    blockedRevenue: 0,
    staleRevenue: 0,
    ownerlessRevenue: 0,
    qualifiedUntouchedRevenue: 0,
    intentEngagementGapRevenue: 0,
    unqualifiedHighValueRevenue: 0
  };

  (Array.isArray(leads) ? leads : []).forEach((lead) => {
    const value = numeric(lead?.value) ?? 0;
    if (value <= 0) return;
    const stale = (numeric(lead?.lastTouchDays) ?? -1) > options.staleDays;
    const ownerless = !String(lead?.owner || "").trim();
    const reasons = [];

    if (lead?.stage === "blocked") { categories.blockedRevenue += value; reasons.push("blocked_data"); }
    if (lead?.stage !== "blocked" && stale) { categories.staleRevenue += value; reasons.push("stale"); }
    if (lead?.stage !== "blocked" && ownerless && value >= options.ownerlessValue) {
      categories.ownerlessRevenue += value; reasons.push("ownerless");
    }
    if (lead?.stage === "qualified" && (numeric(lead?.lastTouchDays) ?? 0) > options.untouchedQualifiedDays) {
      categories.qualifiedUntouchedRevenue += value; reasons.push("qualified_untouched");
    }
    if ((numeric(lead?.intent) ?? 0) >= options.highIntent &&
        (numeric(lead?.engagement) ?? 100) <= options.lowEngagement) {
      categories.intentEngagementGapRevenue += value;
      reasons.push("intent_engagement_gap");
    }
    if (lead?.stage !== "blocked" && lead?.stage !== "qualified" && value >= options.unqualifiedHighValue) {
      categories.unqualifiedHighValueRevenue += value;
      reasons.push("unqualified_value");
    }

    if (reasons.length) {
      rows.push({
        leadId: lead.id,
        account: lead.account || "Unnamed account",
        stage: lead.stage,
        owner: String(lead.owner || "Unassigned").trim() || "Unassigned",
        segment: String(lead.segment || "General").trim() || "General",
        value,
        reasons
      });
    }
  });

  const pipelineValue = (Array.isArray(leads) ? leads : [])
    .filter((lead) => lead.stage !== "blocked")
    .reduce((sum, lead) => sum + (numeric(lead.value) ?? 0), 0);

  const atRiskValue = rows.reduce((sum, row) => sum + row.value, 0);
  const totalValue = (Array.isArray(leads) ? leads : []).reduce((sum, lead) => sum + Math.max(0, numeric(lead.value) ?? 0), 0);

  return {
    ...categories,
    atRiskValue,
    totalValue,
    activePipelineValue: pipelineValue,
    leakageRate: totalValue ? atRiskValue / totalValue : 0,
    rows: rows.sort((a, b) => b.value - a.value || String(a.leadId).localeCompare(String(b.leadId)))
  };
}

export function executiveIntelligence(leads, forecastAssumptions = {}, config = {}, precomputed = {}) {
  const evaluated = Array.isArray(leads) ? leads : [];
  const options = normaliseIntelligenceConfig(config);
  const forecast = precomputed.forecast || forecastPipeline(evaluated, forecastAssumptions);
  const healthRows = evaluated.map((lead) => ({ lead, health: accountHealth(lead, options) }));
  const validHealth = healthRows.filter((item) => item.health.score !== null);
  const health = {
    average: validHealth.length
      ? Math.round(validHealth.reduce((sum, item) => sum + item.health.score, 0) / validHealth.length)
      : 0,
    healthy: validHealth.filter((item) => item.health.status === "healthy").length,
    watch: validHealth.filter((item) => item.health.status === "watch").length,
    risk: validHealth.filter((item) => item.health.status === "risk").length,
    critical: validHealth.filter((item) => item.health.status === "critical").length,
    unknown: healthRows.length - validHealth.length
  };
  const rules = applyBusinessRules(evaluated, config);
  const anomalies = detectAnomalies(evaluated, options);
  const leakage = revenueLeakage(evaluated, config);
  const segments = precomputed.segments || segmentIntelligence(evaluated, forecastAssumptions, forecast);
  const cohorts = precomputed.cohorts || cohortAnalysis(evaluated, "cohort", forecastAssumptions, forecast);

  const criticalCount = rules.filter((item) => item.severity === "critical").length;
  const highCount = rules.filter((item) => item.severity === "high").length + anomalies.high;
  const signal = criticalCount > 0 ? "critical" :
    highCount > 0 || leakage.leakageRate >= 0.25 ? "attention" :
      "controlled";

  const priorities = [
    ...rules.map((item) => ({ type: "rule", severity: item.severity, title: item.message, detail: item.account, value: item.value })),
    ...anomalies.items.map((item) => ({ type: "anomaly", severity: item.severity, title: item.message, detail: item.account || item.segment || "Run", value: item.value || 0 }))
  ].slice(0, 8);

  const opportunities = [];
  const bestSegment = Object.values(segments)[0];
  if (bestSegment) {
    opportunities.push({
      type: "segment",
      title: "Concentrate on " + bestSegment.segment,
      detail: Math.round(bestSegment.pipelineShare * 100) + "% of pipeline · " + Math.round(bestSegment.qualifiedRate * 100) + "% qualified",
      value: bestSegment.expectedValue
    });
  }
  const topQualified = evaluated
    .filter((lead) => lead.stage === "qualified" && (numeric(lead.value) ?? 0) > 0)
    .sort((a, b) => (numeric(b.value) ?? 0) - (numeric(a.value) ?? 0))[0];
  if (topQualified) {
    opportunities.push({
      type: "account",
      title: "Protect " + (topQualified.account || topQualified.id),
      detail: "Qualified value with active commercial signal",
      value: numeric(topQualified.value) ?? 0
    });
  }

  return {
    config: options,
    signal,
    forecast,
    health,
    rules: { total: rules.length, critical: criticalCount, high: highCount, findings: rules },
    anomalies,
    leakage,
    segments,
    cohorts,
    priorities,
    opportunities
  };
}


export function ownerIntelligence(leads, forecastAssumptions = {}, config = {}, forecastOverride = null) {
  const rows = Array.isArray(leads) ? leads.filter((lead) => lead.stage !== "blocked") : [];
  const forecast = forecastOverride || forecastPipeline(rows, forecastAssumptions);
  const groups = {};

  rows.forEach((lead) => {
    const owner = String(lead?.owner || "Unassigned").trim() || "Unassigned";
    if (!groups[owner]) {
      groups[owner] = {
        owner,
        records: 0,
        pipelineValue: 0,
        qualifiedRecords: 0,
        staleRecords: 0,
        expectedValue: 0,
        riskFindings: 0,
        averageScore: 0
      };
    }
    const group = groups[owner];
    const value = numeric(lead.value) ?? 0;
    group.records += 1;
    group.pipelineValue += value;
    if (lead.stage === "qualified") group.qualifiedRecords += 1;
    if ((numeric(lead.lastTouchDays) ?? -1) > (normaliseIntelligenceConfig(config).staleDays)) group.staleRecords += 1;
    if (typeof lead.score === "number") group.averageScore += lead.score;
    group.riskFindings += applyBusinessRules([lead], config).filter((item) =>
      item.severity === "critical" || item.severity === "high"
    ).length;
  });

  const ownerForecast = forecast.rows.reduce((map, row) => {
    const owner = row.owner;
    map[owner] = (map[owner] || 0) + (row.expectedValueExact ?? row.expectedValue);
    return map;
  }, {});

  const totalPipeline = Object.values(groups).reduce((sum, item) => sum + item.pipelineValue, 0);
  Object.values(groups).forEach((group) => {
    group.expectedValue = Math.round(ownerForecast[group.owner] || 0);
    group.qualifiedRate = group.records ? group.qualifiedRecords / group.records : 0;
    group.staleRate = group.records ? group.staleRecords / group.records : 0;
    group.averageScore = group.records ? Math.round(group.averageScore / group.records) : 0;
    group.pipelineShare = totalPipeline ? group.pipelineValue / totalPipeline : 0;
  });

  return Object.values(groups).sort((a, b) =>
    b.expectedValue - a.expectedValue ||
    b.pipelineValue - a.pipelineValue ||
    a.owner.localeCompare(b.owner)
  );
}

function composeExecutiveBrief(pipeline, commercial, intelligence, owners) {
  const topOwner = owners[0] || null;
  const topSegment = Object.values(intelligence.segments)[0] || null;
  const headline = intelligence.signal === "critical"
    ? "Revenue and operating risk require attention."
    : intelligence.signal === "attention"
      ? "Pipeline is usable, but several signals need attention."
      : "Pipeline is controlled with no material high-severity signal.";

  const keyFacts = [
    pipeline.byStage.qualified + " qualified of " + pipeline.scored + " scored records",
    formatBriefMoney(intelligence.forecast.expectedValue) + " expected base value",
    formatBriefMoney(intelligence.leakage.atRiskValue) + " value carrying at least one risk signal",
    Math.round(intelligence.forecast.topAccountShare * 100) + "% top-account concentration"
  ];

  const actions = [
    ...intelligence.priorities.slice(0, 3).map((item) => item.title),
    topOwner ? "Review " + topOwner.owner + " portfolio: " + formatBriefMoney(topOwner.expectedValue) + " expected value." : null,
    topSegment ? "Protect " + topSegment.segment + ": " + formatBriefMoney(topSegment.expectedValue) + " expected value." : null
  ].filter(Boolean).slice(0, 5);

  return {
    headline,
    signal: intelligence.signal,
    summary: {
      records: pipeline.total,
      qualified: pipeline.byStage.qualified,
      blocked: pipeline.byStage.blocked,
      pipelineValue: commercial.pipelineValue,
      expectedValue: intelligence.forecast.expectedValue,
      leakageValue: intelligence.leakage.atRiskValue,
      healthAverage: intelligence.health.average
    },
    keyFacts,
    actions,
    topOwner,
    topSegment,
    intelligence
  };
}

export function buildExecutiveBrief(leads, forecastAssumptions = {}, config = {}) {
  const evaluated = Array.isArray(leads) ? leads : [];
  const pipeline = summarisePipeline(evaluated);
  const commercial = commercialMetrics(evaluated);
  const forecast = forecastPipeline(evaluated, forecastAssumptions);
  const segments = segmentIntelligence(evaluated, forecastAssumptions, forecast);
  const cohorts = cohortAnalysis(evaluated, "cohort", forecastAssumptions, forecast);
  const intelligence = executiveIntelligence(
    evaluated,
    forecastAssumptions,
    config,
    { forecast, segments, cohorts }
  );
  const owners = ownerIntelligence(evaluated, forecastAssumptions, config, forecast);
  return composeExecutiveBrief(pipeline, commercial, intelligence, owners);
}

export function buildRunAnalysis(leads, forecastAssumptions = {}, config = {}) {
  const evaluated = Array.isArray(leads) ? leads : [];
  const options = normaliseIntelligenceConfig(config);
  const pipeline = summarisePipeline(evaluated);
  const commercial = commercialMetrics(evaluated);
  const forecast = forecastPipeline(evaluated, forecastAssumptions);
  const scenarios = forecastScenarios(evaluated, forecastAssumptions);
  const segments = segmentIntelligence(evaluated, forecastAssumptions, forecast);
  const cohorts = cohortAnalysis(evaluated, "cohort", forecastAssumptions, forecast);
  const intelligence = executiveIntelligence(
    evaluated,
    forecastAssumptions,
    options,
    { forecast, segments, cohorts }
  );
  const owners = ownerIntelligence(evaluated, forecastAssumptions, options, forecast);
  const executive = composeExecutiveBrief(pipeline, commercial, intelligence, owners);

  return Object.freeze({
    evaluated,
    pipeline,
    commercial,
    forecast,
    scenarios,
    segments,
    cohorts,
    intelligence,
    owners,
    executive
  });
}

export function buildDecisionTrace(lead, forecastAssumptions = {}, config = {}, context = {}) {
  const candidate = lead || {};
  const risks = applyBusinessRules([candidate], config);
  const health = accountHealth(candidate, config);
  const policy = ACTION_POLICY[candidate.stage] || ACTION_POLICY.blocked;
  const forecast = forecastPipeline([candidate], forecastAssumptions);
  const forecastRow = forecast.rows[0] || null;
  const proposedTarget = candidate.stage === "new"
    ? "nurture"
    : candidate.stage === "nurture"
      ? "qualified"
      : null;

  return {
    runId: context.runId || null,
    input: {
      id: candidate.id || null,
      account: candidate.account || "Unnamed account",
      signals: Object.fromEntries(SIGNALS.map((key) => [key, candidate[key] ?? null])),
      quality: candidate.quality || validateLead(candidate)
    },
    decision: {
      score: typeof candidate.score === "number" ? candidate.score : null,
      breakdown: candidate.breakdown || {},
      stage: candidate.stage || "blocked",
      nextAction: candidate.nextAction || nextAction(candidate)
    },
    commercial: {
      value: numeric(candidate.value),
      owner: String(candidate.owner || "Unassigned").trim() || "Unassigned",
      segment: String(candidate.segment || "General").trim() || "General",
      source: String(candidate.source || "").trim(),
      cohort: String(candidate.cohort || "").trim(),
      lastTouchDays: numeric(candidate.lastTouchDays),
      stale: (numeric(candidate.lastTouchDays) ?? -1) > INTELLIGENCE_DEFAULTS.staleDays,
      expectedValue: forecastRow?.expectedValue || 0,
      probability: forecastRow?.probability || 0
    },
    health,
    risks,
    proposal: {
      from: candidate.stage || "blocked",
      to: proposedTarget,
      action: policy.action,
      lane: policy.lane,
      priority: policy.priority,
      slaHours: policy.slaHours,
      approvalRequired: proposedTarget === "qualified" || proposedTarget === "blocked"
    },
    approval: {
      status: "pending",
      required: proposedTarget === "qualified" || proposedTarget === "blocked",
      reason: proposedTarget === "qualified" || proposedTarget === "blocked"
        ? "Sensitive transition requires explicit human approval."
        : "No sensitive transition proposed."
    },
    execution: {
      state: "NOT_EXECUTED",
      mode: "SIMULATION_ONLY"
    }
  };
}

function formatBriefMoney(value) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(numeric(value) ?? 0);
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
  forecast = {},
  source = "demo",
  scenario = "balanced"
} = {}) {
  const normalizedWeights = normaliseWeights(weights);
  const normalizedThresholds = normaliseThresholds(thresholds);
  const normalizedForecast = normaliseForecastAssumptions(forecast);
  const payload = {
    records,
    source,
    scenario,
    thresholds: normalizedThresholds,
    weights: normalizedWeights,
    forecast: normalizedForecast
  };
  const runId = "RUN-" + hashString(stableStringify(payload)).toUpperCase();

  return {
    runId,
    createdAt: new Date().toISOString(),
    source,
    scenario,
    weights: normalizedWeights,
    thresholds: normalizedThresholds,
    forecast: normalizedForecast,
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
