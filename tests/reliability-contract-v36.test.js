import test from "node:test";
import assert from "node:assert/strict";

import {
  RELIABILITY_CONTRACT_VERSION,
  RELIABILITY_LIMITS,
  measureOperation,
  evaluateReliabilityBudget
} from "../assets/js/reliability-contract-v36.js";

test("V36 version is deterministic", () => {
  assert.equal(
    RELIABILITY_CONTRACT_VERSION,
    "36.0"
  );
});

test("successful operation is measured", () => {
  const result =
    measureOperation(() => 42);

  assert.equal(result.ok, true);
  assert.equal(result.value, 42);
  assert.ok(result.durationMs >= 0);
});

test("operation errors are captured", () => {
  const result =
    measureOperation(() => {
      throw new Error("boom");
    });

  assert.equal(result.ok, false);
  assert.equal(result.error, "boom");
});

test("within-budget operation passes", () => {
  const result =
    evaluateReliabilityBudget({
      verificationMs: 50,
      exportMs: 50,
      payloadBytes: 1000
    });

  assert.equal(result.valid, true);
});

test("over-budget operation fails", () => {
  const result =
    evaluateReliabilityBudget({
      verificationMs: 5001
    });

  assert.equal(result.valid, false);
  assert.deepEqual(
    result.failures,
    ["VERIFICATION_TIME_LIMIT"]
  );
});
