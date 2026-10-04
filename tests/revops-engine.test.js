import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WEIGHTS,
  normaliseWeights,
  scoreLead,
  evaluateBatch,
  summarisePipeline,
  buildActionQueue,
  summariseQueue,
  compareEvaluations,
  evaluateScenarios,
  createRunSnapshot,
  commercialMetrics,
  forecastPipeline,
  forecastScenarios,
  normaliseThresholds,
  normaliseIntelligenceConfig,
  normaliseForecastAssumptions,
  transition,
  accountHealth,
  segmentIntelligence,
  cohortAnalysis,
  applyBusinessRules,
  detectAnomalies,
  revenueLeakage,
  executiveIntelligence,
  ownerIntelligence,
  buildExecutiveBrief
} from "../assets/js/revops-engine.js";

test("weights are normalised to 1", () => {
  const weights = normaliseWeights({ fit: 20, intent: 20, engagement: 10, urgency: 0 });
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-10);
});

test("default all-100 signals produce a 100 qualified score", () => {
  const lead = scoreLead({ id:"T-001", fit:100, intent:100, engagement:100, urgency:100 }, DEFAULT_WEIGHTS);
  assert.equal(lead.score, 100);
  assert.equal(lead.stage, "qualified");
  assert.equal(lead.quality.valid, true);
});

test("medium signals produce nurture", () => {
  const [lead] = evaluateBatch([{ id:"T-002", fit:50, intent:50, engagement:50, urgency:50 }]);
  assert.equal(lead.score, 50);
  assert.equal(lead.stage, "nurture");
});

test("invalid data fails closed into blocked", () => {
  const lead = scoreLead({ id:"T-003", fit:100, intent:"bad", engagement:20, urgency:30 });
  assert.equal(lead.stage, "blocked");
  assert.equal(lead.score, null);
});

test("pipeline summary exposes qualification rate and blocked records", () => {
  const result = summarisePipeline(evaluateBatch([
    { id:"A", fit:100, intent:100, engagement:100, urgency:100 },
    { id:"B", fit:50, intent:50, engagement:50, urgency:50 },
    { id:"C", fit:50, intent:"bad", engagement:50, urgency:50 }
  ]));
  assert.equal(result.total, 3);
  assert.equal(result.scored, 2);
  assert.equal(result.qualityIssues, 1);
  assert.equal(result.byStage.qualified, 1);
  assert.equal(result.byStage.nurture, 1);
  assert.equal(result.byStage.blocked, 1);
  assert.equal(result.qualificationRate, 0.5);
});

test("sensitive transitions require approval", () => {
  const lead = { id:"T-004", stage:"new" };
  assert.equal(transition(lead, "qualified").ok, false);
  assert.equal(transition(lead, "qualified", true).ok, true);
});

test("invalid transitions are blocked", () => {
  const result = transition({ id:"T-005", stage:"qualified" }, "new", true);
  assert.equal(result.ok, false);
});

test("CSV parser handles quoted fields", async () => {
  const { parseCsv } = await import("../assets/js/csv-utils.js");
  const result = parseCsv('id,account,fit,intent,engagement,urgency\nL1,"North, Inc.",90,80,70,60');
  assert.equal(result[0].account, "North, Inc.");
  assert.equal(result[0].fit, 90);
});

test("CSV parser rejects missing required columns", async () => {
  const { parseCsv } = await import("../assets/js/csv-utils.js");
  assert.throws(() => parseCsv("id,fit,intent\nL1,90,80"), /Faltan columnas/);
});

test("unknown target stages fail closed", () => {
  assert.throws(() => transition({ id:"T-006", stage:"new" }, "execute"), /Unknown stage/);
});


test("action queue prioritises blocked and qualified work", () => {
  const leads = evaluateBatch([
    { id:"Q-001", account:"Nurture Co", fit:60, intent:60, engagement:60, urgency:60 },
    { id:"Q-002", account:"Qualified Co", fit:90, intent:90, engagement:90, urgency:90 },
    { id:"Q-003", account:"Broken Co", fit:90, intent:"bad", engagement:50, urgency:100 }
  ]);
  const queue = buildActionQueue(leads, "2026-10-04T12:00:00Z");
  assert.equal(queue[0].stage, "blocked");
  assert.equal(queue[0].priority, "critical");
  assert.equal(queue[0].slaHours, 2);
  assert.equal(queue[1].stage, "qualified");
  assert.equal(queue[1].lane, "Sales / CS");
});

test("queue summary exposes urgent workload", () => {
  const leads = evaluateBatch([
    { id:"Q-004", fit:100, intent:100, engagement:100, urgency:100 },
    { id:"Q-005", fit:50, intent:50, engagement:50, urgency:50 }
  ]);
  const summary = summariseQueue(buildActionQueue(leads, "2026-10-04T12:00:00Z"));
  assert.equal(summary.total, 2);
  assert.equal(summary.urgent, 1);
  assert.equal(summary.byPriority.high, 1);
  assert.equal(summary.byPriority.medium, 1);
});

test("queue SLA is deterministic from supplied timestamp", () => {
  const [lead] = evaluateBatch([
    { id:"Q-006", fit:100, intent:100, engagement:100, urgency:100 }
  ]);
  const [item] = buildActionQueue([lead], "2026-10-04T12:00:00Z");
  assert.equal(item.dueAt, "2026-10-04T16:00:00.000Z");
});


test("model comparison identifies promotions and demotions", () => {
  const base = evaluateBatch([
    { id:"D-001", account:"Stable", fit:70, intent:70, engagement:70, urgency:70 },
    { id:"D-002", account:"Intent Heavy", fit:40, intent:95, engagement:40, urgency:40 }
  ]);
  const current = evaluateBatch([
    { id:"D-001", account:"Stable", fit:70, intent:70, engagement:70, urgency:70 },
    { id:"D-002", account:"Intent Heavy", fit:40, intent:95, engagement:40, urgency:40 }
  ], { fit: 10, intent: 80, engagement: 5, urgency: 5 });

  const diff = compareEvaluations(base, current);
  assert.equal(diff.totalCompared, 2);
  assert.equal(diff.changed >= 1, true);
  assert.equal(diff.changes[0].leadId, "D-002");
});

test("model comparison detects a newly blocked record", () => {
  const base = evaluateBatch([
    { id:"D-003", account:"Recover", fit:80, intent:80, engagement:80, urgency:80 }
  ]);
  const current = evaluateBatch([
    { id:"D-003", account:"Recover", fit:80, intent:"bad", engagement:80, urgency:80 }
  ]);
  const diff = compareEvaluations(base, current);
  assert.equal(diff.blocked, 1);
  assert.equal(diff.changes[0].kind, "blocked");
});


test("invalid stage thresholds fail safe to defaults", () => {
  assert.deepEqual(normaliseThresholds({ qualified: 40, nurture: 60 }), {
    qualified: 75,
    nurture: 50
  });
});

test("out of range signal values fail closed", () => {
  const lead = scoreLead({ id:"T-007", fit:101, intent:50, engagement:50, urgency:50 });
  assert.equal(lead.stage, "blocked");
  assert.equal(lead.score, null);
  assert.ok(lead.quality.errors.includes("fit: out_of_range"));
});

test("scenario evaluation returns a summary per preset", () => {
  const scenarios = evaluateScenarios([
    { id:"S-001", fit:90, intent:40, engagement:70, urgency:80 },
    { id:"S-002", fit:50, intent:90, engagement:40, urgency:30 }
  ], {
    balanced: { fit:35, intent:30, engagement:20, urgency:15 },
    growth: { fit:20, intent:50, engagement:10, urgency:20 }
  });
  assert.equal(Object.keys(scenarios).length, 2);
  assert.equal(typeof scenarios.growth.averageScore, "number");
  assert.equal(scenarios.balanced.total, 2);
});

test("run snapshot id is deterministic for identical inputs", () => {
  const args = {
    records: [{ id:"R-001", fit:80, intent:70, engagement:60, urgency:50 }],
    weights: { fit:40, intent:30, engagement:20, urgency:10 },
    thresholds: { qualified:75, nurture:50 },
    source: "demo",
    scenario: "balanced"
  };
  const first = createRunSnapshot(args);
  const second = createRunSnapshot(args);
  assert.equal(first.runId, second.runId);
  assert.match(first.runId, /^RUN-[0-9A-F]{8}$/);
});


test("CSV parser accepts European semicolon delimiters and multiline quoted fields", async () => {
  const { parseCsv } = await import("../assets/js/csv-utils.js");
  const result = parseCsv('id;account;fit;intent;engagement;urgency\nL1;"North; Inc.\nEU";90;80;70;60');
  assert.equal(result[0].account, "North; Inc.\nEU");
  assert.equal(result[0].fit, 90);
});

test("CSV parser rejects duplicate headers", async () => {
  const { parseCsv } = await import("../assets/js/csv-utils.js");
  assert.throws(
    () => parseCsv("id,fit,fit,intent,engagement,urgency\nL1,90,80,70,60,50"),
    /Columnas duplicadas/
  );
});

test("CSV parser rejects oversized input", async () => {
  const { parseCsv } = await import("../assets/js/csv-utils.js");
  assert.throws(
    () => parseCsv("id,fit,intent,engagement,urgency\n" + "x".repeat(2_000_001)),
    /CSV demasiado grande/
  );
});


test("commercial metrics calculate pipeline and weighted pipeline", () => {
  const leads = evaluateBatch([
    { id:"C-001", fit:100, intent:100, engagement:100, urgency:100, value:50000, owner:"Ana", segment:"Enterprise", lastTouchDays:3 },
    { id:"C-002", fit:50, intent:50, engagement:50, urgency:50, value:20000, owner:"Luis", segment:"SMB", lastTouchDays:20 },
    { id:"C-003", fit:10, intent:10, engagement:10, urgency:10, value:10000, owner:"Ana", segment:"SMB", lastTouchDays:30 }
  ]);
  const result = commercialMetrics(leads);
  assert.equal(result.pipelineValue, 80000);
  assert.equal(result.qualifiedValue, 50000);
  assert.equal(result.weightedPipeline, 61000);
  assert.equal(result.staleRecords, 2);
  assert.equal(result.owners.Ana, 2);
  assert.equal(result.segments.SMB, 2);
});

test("action queue marks stale context and includes owner", () => {
  const [lead] = evaluateBatch([
    { id:"C-004", account:"Stale Account", fit:90, intent:90, engagement:90, urgency:70, value:60000, owner:"Ana", segment:"Enterprise", lastTouchDays:20 }
  ]);
  const [item] = buildActionQueue([lead], "2026-10-04T12:00:00Z");
  assert.equal(item.owner, "Ana");
  assert.equal(item.stale, true);
  assert.equal(item.value, 60000);
});

test("CSV parser preserves optional commercial context", async () => {
  const { parseCsv } = await import("../assets/js/csv-utils.js");
  const [row] = parseCsv("id,account,fit,intent,engagement,urgency,value,owner,segment,source,last_touch_days\nL9,Acme,90,80,70,60,42000,Ana,Enterprise,Inbound,12");
  assert.equal(row.value, 42000);
  assert.equal(row.owner, "Ana");
  assert.equal(row.segment, "Enterprise");
  assert.equal(row.lastTouchDays, 12);
});


test("forecast pipeline applies stage probabilities to active value", () => {
  const leads = evaluateBatch([
    { id:"F-001", fit:100, intent:100, engagement:100, urgency:100, value:50000 },
    { id:"F-002", fit:50, intent:50, engagement:50, urgency:50, value:20000 },
    { id:"F-003", fit:10, intent:10, engagement:10, urgency:10, value:10000 }
  ]);
  const result = forecastPipeline(leads, {
    qualified: 0.8,
    nurture: 0.35,
    new: 0.1
  });
  assert.equal(result.pipelineValue, 80000);
  assert.equal(result.expectedValue, 48000);
  assert.equal(result.activeRecords, 3);
  assert.equal(result.expectedCoverage, 0.6);
});

test("forecast scenarios preserve pipeline and change expected value by multiplier", () => {
  const leads = evaluateBatch([
    { id:"F-004", fit:100, intent:100, engagement:100, urgency:100, value:40000 }
  ]);
  const result = forecastScenarios(leads, {
    qualified: 0.8,
    downside: 0.5,
    upside: 1.5
  });
  assert.equal(result.downside.pipelineValue, 40000);
  assert.equal(result.downside.expectedValue, 16000);
  assert.equal(result.base.expectedValue, 32000);
  assert.equal(result.upside.expectedValue, 48000);
});

test("forecast exposes top-account concentration and segment forecast", () => {
  const leads = evaluateBatch([
    { id:"F-005", account:"Big", fit:100, intent:100, engagement:100, urgency:100, value:80000, segment:"Enterprise" },
    { id:"F-006", account:"Small", fit:50, intent:50, engagement:50, urgency:50, value:20000, segment:"SMB" }
  ]);
  const result = forecastPipeline(leads);
  assert.equal(result.topAccountShare, 0.8);
  assert.equal(result.bySegment.Enterprise.expectedValue, 64000);
  assert.equal(result.bySegment.SMB.expectedValue, 7000);
});


test("forecast assumptions are part of run identity", () => {
  const base = {
    records: [{ id:"F-007", fit:80, intent:70, engagement:60, urgency:50, value:30000 }],
    weights: { fit:40, intent:30, engagement:20, urgency:10 },
    thresholds: { qualified:75, nurture:50 },
    source: "demo",
    scenario: "balanced"
  };
  const first = createRunSnapshot({
    ...base,
    forecast: { qualified:0.8, nurture:0.35, new:0.1, downside:0.75, upside:1.15 }
  });
  const second = createRunSnapshot({
    ...base,
    forecast: { qualified:0.6, nurture:0.35, new:0.1, downside:0.75, upside:1.15 }
  });
  assert.notEqual(first.runId, second.runId);
  assert.equal(first.forecast.qualified, 0.8);
});


test("account health is deterministic and recency aware", () => {
  const healthy = accountHealth({
    id: "H-001", fit: 100, intent: 100, engagement: 100, urgency: 100, lastTouchDays: 2
  });
  assert.equal(healthy.score, 100);
  assert.equal(healthy.status, "healthy");
  assert.equal(healthy.confidence, "high");

  const unknown = accountHealth({
    id: "H-002", fit: 80, intent: 80, engagement: 70, urgency: 20
  });
  assert.equal(unknown.confidence, "medium");
  assert.ok(unknown.reasons.includes("Recency context missing"));
});

test("segment intelligence separates record rate from value share", () => {
  const leads = evaluateBatch([
    { id:"SI-001", fit:100, intent:100, engagement:100, urgency:100, value:50000, segment:"Enterprise" },
    { id:"SI-002", fit:50, intent:50, engagement:50, urgency:50, value:10000, segment:"Enterprise" },
    { id:"SI-003", fit:100, intent:100, engagement:100, urgency:100, value:10000, segment:"SMB" }
  ]);
  const result = segmentIntelligence(leads, { qualified:0.8, nurture:0.35, new:0.1 });
  assert.equal(result.Enterprise.activeRecords, 2);
  assert.equal(result.Enterprise.qualifiedRate, 0.5);
  assert.equal(result.Enterprise.qualifiedValueShare, 50000 / 60000);
  assert.equal(result.Enterprise.expectedValue, 43500);
});

test("cohort analysis groups commercial context without changing scoring", () => {
  const leads = evaluateBatch([
    { id:"CO-001", fit:100, intent:100, engagement:100, urgency:100, value:20000, cohort:"2026-Q3" },
    { id:"CO-002", fit:50, intent:50, engagement:50, urgency:50, value:10000, cohort:"2026-Q3" },
    { id:"CO-003", fit:10, intent:10, engagement:10, urgency:10, value:5000, cohort:"2026-Q4" }
  ]);
  const result = cohortAnalysis(leads, "cohort", { qualified:0.8, nurture:0.35, new:0.1 });
  assert.equal(result.length, 2);
  assert.equal(result[0].cohort, "2026-Q3");
  assert.equal(result[0].qualifiedRate, 0.5);
  assert.equal(result[0].expectedValue, 19500);
});

test("business rules surface material operational risk", () => {
  const leads = evaluateBatch([
    { id:"BR-001", account:"Stale Enterprise", fit:90, intent:90, engagement:30, urgency:80, value:60000, owner:"", segment:"Enterprise", lastTouchDays:30 },
    { id:"BR-002", account:"Broken Revenue", fit:90, intent:"bad", engagement:90, urgency:90, value:40000, owner:"Ana", segment:"Enterprise" }
  ]);
  const findings = applyBusinessRules(leads);
  assert.equal(findings.some((item) => item.code === "HIGH_VALUE_STALE"), true);
  assert.equal(findings.some((item) => item.code === "OWNERLESS_REVENUE"), true);
  assert.equal(findings.some((item) => item.code === "INTENT_ENGAGEMENT_GAP"), true);
  assert.equal(findings.some((item) => item.code === "BLOCKED_REVENUE"), true);
});

test("anomaly detection flags value outliers and segment clusters", () => {
  const leads = evaluateBatch([
    { id:"AN-001", fit:80, intent:80, engagement:80, urgency:80, value:100, segment:"A", lastTouchDays:30 },
    { id:"AN-002", fit:80, intent:80, engagement:80, urgency:80, value:110, segment:"A", lastTouchDays:35 },
    { id:"AN-003", fit:80, intent:80, engagement:80, urgency:80, value:120, segment:"B", lastTouchDays:1 },
    { id:"AN-004", fit:80, intent:80, engagement:80, urgency:80, value:130, segment:"B", lastTouchDays:2 },
    { id:"AN-005", fit:80, intent:80, engagement:80, urgency:80, value:1000, segment:"A", lastTouchDays:40 }
  ]);
  const result = detectAnomalies(leads);
  assert.equal(result.items.some((item) => item.type === "value_outlier" && item.leadId === "AN-005"), true);
  assert.equal(result.items.some((item) => item.type === "segment_stale_cluster" && item.segment === "A"), true);
});

test("revenue leakage deduplicates total exposure and keeps category totals", () => {
  const leads = evaluateBatch([
    { id:"RL-001", fit:100, intent:100, engagement:20, urgency:80, value:50000, owner:"", segment:"Enterprise", lastTouchDays:25 },
    { id:"RL-002", fit:100, intent:100, engagement:100, urgency:80, value:30000, owner:"Ana", segment:"Enterprise", lastTouchDays:1 }
  ]);
  const result = revenueLeakage(leads);
  assert.equal(result.totalValue, 80000);
  assert.equal(result.atRiskValue, 50000);
  assert.equal(result.staleRevenue, 50000);
  assert.equal(result.ownerlessRevenue, 50000);
  assert.equal(result.intentEngagementGapRevenue, 50000);
  assert.equal(result.leakageRate, 0.625);
});

test("executive intelligence returns a single decision surface", () => {
  const leads = evaluateBatch([
    { id:"EX-001", account:"Northstar", fit:100, intent:100, engagement:100, urgency:100, value:80000, owner:"Ana", segment:"Enterprise", cohort:"2026-Q4", lastTouchDays:2 },
    { id:"EX-002", account:"At Risk", fit:90, intent:90, engagement:20, urgency:90, value:60000, owner:"", segment:"Enterprise", cohort:"2026-Q4", lastTouchDays:30 },
    { id:"EX-003", account:"Broken", fit:90, intent:"bad", engagement:90, urgency:90, value:40000, segment:"SMB", cohort:"2026-Q3" }
  ]);
  const result = executiveIntelligence(leads, { qualified:0.8, nurture:0.35, new:0.1 });
  assert.equal(result.signal, "critical");
  assert.ok(result.rules.critical >= 1);
  assert.ok(result.leakage.atRiskValue >= 60000);
  assert.ok(result.priorities.length > 0);
  assert.ok(result.opportunities.length > 0);
});

test("run snapshot preserves forecast multipliers above 100 percent", () => {
  const snapshot = createRunSnapshot({
    records: [{ id:"V11-001", fit:80, intent:70, engagement:60, urgency:50, value:30000 }],
    forecast: { qualified:0.8, nurture:0.35, new:0.1, downside:0.75, upside:1.15 }
  });
  assert.equal(snapshot.forecast.upside, 1.15);
});

test("CSV parser preserves optional cohort context", async () => {
  const { parseCsv } = await import("../assets/js/csv-utils.js");
  const [row] = parseCsv("id,account,fit,intent,engagement,urgency,value,segment,cohort\nCO9,Acme,90,80,70,60,42000,Enterprise,2026-Q4");
  assert.equal(row.cohort, "2026-Q4");
});


test("intelligence configuration fails safe to deterministic defaults", () => {
  const config = normaliseIntelligenceConfig({
    staleDays: -10,
    highValue: "bad",
    ownerlessValue: 30000,
    lowEngagement: 35
  });
  assert.equal(config.staleDays, 14);
  assert.equal(config.highValue, 50000);
  assert.equal(config.ownerlessValue, 30000);
  assert.equal(config.lowEngagement, 35);
});

test("forecast assumptions clamp probabilities and multipliers independently", () => {
  const config = normaliseForecastAssumptions({
    qualified: 9,
    nurture: -2,
    new: "bad",
    downside: 4,
    upside: 1.5
  });
  assert.equal(config.qualified, 1);
  assert.equal(config.nurture, 0);
  assert.equal(config.new, 0.1);
  assert.equal(config.downside, 2);
  assert.equal(config.upside, 1.5);
});


test("owner intelligence ranks portfolios by expected value", () => {
  const leads = evaluateBatch([
    { id:"OI-001", fit:100, intent:100, engagement:100, urgency:100, value:60000, owner:"Ana", lastTouchDays:2 },
    { id:"OI-002", fit:50, intent:50, engagement:50, urgency:50, value:20000, owner:"Luis", lastTouchDays:20 },
    { id:"OI-003", fit:10, intent:10, engagement:10, urgency:10, value:10000, owner:"Luis", lastTouchDays:30 }
  ]);
  const result = ownerIntelligence(leads, { qualified:0.8, nurture:0.35, new:0.1 });
  assert.equal(result[0].owner, "Ana");
  assert.equal(result[0].expectedValue, 48000);
  assert.equal(result[1].pipelineValue, 30000);
  assert.equal(result[1].staleRate, 1);
});

test("executive brief is deterministic and evidence based", () => {
  const leads = evaluateBatch([
    { id:"EB-001", account:"Anchor", fit:100, intent:100, engagement:100, urgency:100, value:80000, owner:"Ana", segment:"Enterprise", lastTouchDays:2 },
    { id:"EB-002", account:"Risk", fit:90, intent:90, engagement:20, urgency:90, value:60000, owner:"", segment:"Enterprise", lastTouchDays:30 },
    { id:"EB-003", account:"Broken", fit:90, intent:"bad", engagement:90, urgency:90, value:40000, owner:"Luis", segment:"SMB" }
  ]);
  const first = buildExecutiveBrief(leads, { qualified:0.8, nurture:0.35, new:0.1 });
  const second = buildExecutiveBrief(leads, { qualified:0.8, nurture:0.35, new:0.1 });
  assert.deepEqual(first, second);
  assert.equal(first.signal, "critical");
  assert.equal(first.summary.pipelineValue, 140000);
  assert.equal(first.summary.expectedValue, 112000);
  assert.ok(first.keyFacts.some((item) => item.includes("€112,000")));
  assert.ok(first.actions.length > 0);
});
