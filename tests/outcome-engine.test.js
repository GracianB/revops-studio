import test from "node:test";
import assert from "node:assert/strict";
import {
  OUTCOME_TYPES,
  POSITIVE_OUTCOMES,
  validateOutcome,
  createOutcomeRecord,
  fingerprintOutcomes,
  createOutcomeLedger,
  appendOutcome,
  buildOutcomeSummary,
  actionEffectiveness,
  calibrateForecast,
  buildFeedbackAnalysis,
  createOutcomeEvent
} from "../assets/js/outcome-engine.js";

const base = (overrides = {}) => createOutcomeRecord({
  runId: "RUN-V18",
  leadId: "L-001",
  actionId: "ACT-001",
  action: "Add context",
  type: OUTCOME_TYPES.RESPONSE,
  occurredAt: "2026-10-04T22:00:00.000Z",
  expectedProbability: 0.35,
  expectedValue: 3500,
  actualValue: 5000,
  responseHours: 12,
  slaHours: 24,
  ...overrides
});

test("outcome types expose the closed-loop lifecycle", () => {
  assert.deepEqual(Object.values(OUTCOME_TYPES), [
    "REPLIED", "MEETING_BOOKED", "OPPORTUNITY_CREATED", "CLOSED_WON", "CLOSED_LOST", "NO_RESPONSE"
  ]);
  assert.ok(POSITIVE_OUTCOMES.includes(OUTCOME_TYPES.WON));
  assert.ok(!POSITIVE_OUTCOMES.includes(OUTCOME_TYPES.LOST));
});

test("invalid outcome fails validation", () => {
  const result = validateOutcome({ runId:"RUN", leadId:"L", type:"UNKNOWN" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("type: invalid"));
  assert.ok(result.errors.includes("occurredAt: missing"));
});

test("outcome record is deterministic and exposes SLA state", () => {
  const first = base();
  const second = base();
  assert.equal(first.outcomeId, second.outcomeId);
  assert.equal(first.contractVersion, "18.0");
  assert.equal(first.positive, true);
  assert.equal(first.terminal, false);
  assert.equal(first.slaBreached, false);
});

test("late outcome marks SLA breach", () => {
  const outcome = base({ responseHours:25, slaHours:24 });
  assert.equal(outcome.slaBreached, true);
});

test("outcome fingerprint is order-independent", () => {
  const one = base({ leadId:"L-1" });
  const two = base({ leadId:"L-2", type:OUTCOME_TYPES.MEETING });
  assert.equal(fingerprintOutcomes([one, two]), fingerprintOutcomes([two, one]));
  assert.notEqual(fingerprintOutcomes([one]), fingerprintOutcomes([two]));
});

test("outcome ledger appends and rejects duplicates", () => {
  let ledger = createOutcomeLedger({ runId:"RUN-V18", datasetFingerprint:"FP" });
  const first = appendOutcome(ledger, base());
  assert.equal(first.accepted, true);
  ledger = first.ledger;
  const duplicate = appendOutcome(ledger, base());
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(ledger.sequence, 1);
});

test("outcome ledger rejects malformed records", () => {
  const ledger = createOutcomeLedger({ runId:"RUN-V18" });
  const result = appendOutcome(ledger, {
    runId:"RUN-V18",
    leadId:"L-001",
    type:"BAD"
  });
  assert.equal(result.accepted, false);
});

test("outcome summary calculates positive and terminal conversion", () => {
  const outcomes = [
    base({ leadId:"L-1", type:OUTCOME_TYPES.RESPONSE }),
    base({ leadId:"L-2", type:OUTCOME_TYPES.WON, actualRevenue:7000, actualValue:7000 }),
    base({ leadId:"L-3", type:OUTCOME_TYPES.LOST })
  ];
  const summary = buildOutcomeSummary(outcomes);
  assert.equal(summary.total, 3);
  assert.equal(summary.positive, 2);
  assert.equal(summary.terminal, 2);
  assert.equal(summary.wins, 1);
  assert.equal(summary.losses, 1);
  assert.equal(summary.winRate, 0.5);
});

test("outcome summary compares expected and actual value", () => {
  const summary = buildOutcomeSummary([
    base({ expectedValue:3500, actualValue:5000 }),
    base({ leadId:"L-2", expectedValue:1000, actualValue:0, type:OUTCOME_TYPES.NO_RESPONSE })
  ]);
  assert.equal(summary.expectedValue, 4500);
  assert.equal(summary.actualValue, 5000);
  assert.equal(summary.valueVariance, 500);
});

test("outcome summary calculates median response hours for even samples", () => {
  const summary = buildOutcomeSummary([
    base({ leadId:"1", responseHours:4 }),
    base({ leadId:"2", responseHours:8 }),
    base({ leadId:"3", responseHours:12 }),
    base({ leadId:"4", responseHours:20 })
  ]);
  assert.equal(summary.medianResponseHours, 10);
});

test("action effectiveness ranks actions and calculates value variance", () => {
  const actions = [
    { leadId:"L-1", action:"Human review" },
    { leadId:"L-2", action:"Add context" }
  ];
  const outcomes = [
    base({ leadId:"L-1", action:"Human review", type:OUTCOME_TYPES.WON, actualValue:10000, expectedValue:6000 }),
    base({ leadId:"L-2", action:null, type:OUTCOME_TYPES.NO_RESPONSE, actualValue:0, expectedValue:2000 })
  ];
  const result = actionEffectiveness(actions, outcomes);
  const human = result.find((item) => item.action === "Human review");
  const context = result.find((item) => item.action === "Add context");
  assert.equal(human.positiveRate, 1);
  assert.equal(human.valueVariance, 4000);
  assert.equal(context.positiveRate, 0);
  assert.equal(context.valueVariance, -2000);
});

test("forecast calibration measures expected versus observed outcomes", () => {
  const forecast = [
    { leadId:"L-1", account:"A", probability:0.8 },
    { leadId:"L-2", account:"B", probability:0.2 }
  ];
  const outcomes = [
    base({ leadId:"L-1", type:OUTCOME_TYPES.WON }),
    base({ leadId:"L-2", type:OUTCOME_TYPES.LOST })
  ];
  const result = calibrateForecast(forecast, outcomes);
  assert.equal(result.observedRecords, 2);
  assert.equal(result.expectedRate, 0.5);
  assert.equal(result.actualRate, 0.5);
  assert.equal(result.calibrationError, 0);
});

test("forecast calibration uses positive non-terminal outcomes as observed success", () => {
  const result = calibrateForecast(
    [{ leadId:"L-1", account:"A", probability:0.35 }],
    [base({ leadId:"L-1", type:OUTCOME_TYPES.MEETING })]
  );
  assert.equal(result.observedRecords, 1);
  assert.equal(result.actualRate, 1);
  assert.equal(result.calibrationError, 0.65);
});

test("feedback analysis combines summary, effectiveness and calibration", () => {
  const action = { leadId:"L-1", action:"Add context" };
  const outcome = base({ leadId:"L-1", expectedProbability:0.35, expectedValue:3500 });
  const analysis = buildFeedbackAnalysis({
    plan:{ runId:"RUN-V18", actions:[action] },
    forecast:{ rows:[{ leadId:"L-1", account:"A", probability:0.35 }] },
    outcomes:[outcome]
  });
  assert.equal(analysis.contractVersion, "18.0");
  assert.equal(analysis.summary.total, 1);
  assert.equal(analysis.effectiveness[0].action, "Add context");
  assert.equal(analysis.calibration.observedRecords, 1);
});

test("outcome event maps feedback to the execution ledger boundary", () => {
  const outcome = base({ type:OUTCOME_TYPES.WON, actualRevenue:9000 });
  const event = createOutcomeEvent(outcome);
  assert.equal(event.type, "OUTCOME_RECORDED");
  assert.equal(event.runId, "RUN-V18");
  assert.equal(event.leadId, "L-001");
  assert.equal(event.idempotencyKey, outcome.outcomeId);
  assert.equal(event.payload.actualRevenue, 9000);
});
