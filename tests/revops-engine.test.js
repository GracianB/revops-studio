import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WEIGHTS,
  normaliseWeights,
  scoreLead,
  evaluateBatch,
  summarisePipeline,
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

test("pipeline summary exposes qualification rate", () => {
  const result = summarisePipeline(evaluateBatch([
    { id:"A", fit:100, intent:100, engagement:100, urgency:100 },
    { id:"B", fit:50, intent:50, engagement:50, urgency:50 }
  ]));
  assert.equal(result.total, 2);
  assert.equal(result.scored, 2);
  assert.equal(result.byStage.qualified, 1);
  assert.equal(result.byStage.nurture, 1);
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
  const result = parseCsv('id,account,fit,intent,engagement,urgency\\nL1,"North, Inc.",90,80,70,60');
  assert.equal(result[0].account, "North, Inc.");
  assert.equal(result[0].fit, 90);
});

test("CSV parser rejects missing required columns", async () => {
  const { parseCsv } = await import("../assets/js/csv-utils.js");
  assert.throws(() => parseCsv("id,fit,intent\\nL1,90,80"), /Faltan columnas/);
});

test("unknown target stages fail closed", () => {
  assert.throws(() => transition({ id:"T-006", stage:"new" }, "execute"), /Unknown stage/);
});
