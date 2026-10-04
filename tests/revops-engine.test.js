import test from "node:test";
import assert from "node:assert/strict";
import { evaluateBatch, scoreLead, transition } from "../assets/js/revops-engine.js";

test("100/100 inputs produce a 100 qualified score", () => {
  const lead = scoreLead({ id:"T-001", fit:100, intent:100, engagement:100, urgency:100 });
  assert.equal(lead.score, 100);
  assert.equal(lead.stage, "qualified");
});

test("medium signals produce nurture", () => {
  const [lead] = evaluateBatch([{ id:"T-002", fit:50, intent:50, engagement:50, urgency:50 }]);
  assert.equal(lead.score, 50);
  assert.equal(lead.stage, "nurture");
});

test("sensitive transitions require approval", () => {
  const lead = { id:"T-003", stage:"new" };
  assert.equal(transition(lead, "qualified").ok, false);
  assert.equal(transition(lead, "qualified", true).ok, true);
});

test("unknown target stages fail closed", () => {
  assert.throws(() => transition({ id:"T-004", stage:"new" }, "execute"), /Unknown stage/);
});
