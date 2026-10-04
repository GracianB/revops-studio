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
  transition
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
