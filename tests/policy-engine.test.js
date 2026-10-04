import test from "node:test";
import assert from "node:assert/strict";
import {
  POLICY_CONTRACT_VERSION,
  POLICY_HARD_MAX_STEP,
  applyPolicyToAssumptions,
  buildRecalibrationProposal,
  decidePolicy,
  normalisePolicyConfig,
  replayProbabilityPolicy,
  summarisePolicy
} from "../assets/js/policy-engine.js";

const now = "2026-10-05T00:00:00.000Z";

function report(severity = "CRITICAL", sampleSufficient = true) {
  return {
    severity,
    global: {
      severity,
      sampleSufficient
    },
    recommendations: [{
      code: severity === "CRITICAL"
        ? "CONTROLLED_RECALIBRATION"
        : "CALIBRATION_STABLE"
    }]
  };
}

function biasedRows(count = 10, probability = 0.8, successes = 4) {
  return Array.from({ length: count }, (_, index) => ({
    leadId: "L" + index,
    probability,
    observedSuccess: index < successes ? 1 : 0
  }));
}

test("V21 contract exposes a hard bounded recalibration step", () => {
  const config = normalisePolicyConfig({ maxStep: 9, multiplierMin: 2, multiplierMax: 0.2 });
  assert.equal(config.maxStep, POLICY_HARD_MAX_STEP);
  assert.equal(config.maxStep, 0.15);
  assert.equal(config.multiplierMin, 0.5);
  assert.equal(config.multiplierMax, 1.5);
  assert.equal(POLICY_CONTRACT_VERSION, "21.0");
});

test("V21 blocks a stable report", () => {
  const proposal = buildRecalibrationProposal({
    report: report("STABLE"),
    rows: biasedRows(),
    now
  });
  assert.equal(proposal.status, "BLOCKED");
  assert.equal(proposal.reason, "NO_MATERIAL_DRIFT");
  assert.equal(proposal.eligible, false);
});

test("V21 requires global drift before proposing global recalibration", () => {
  const proposal = buildRecalibrationProposal({
    report: {
      severity: "CRITICAL",
      global: { severity: "STABLE", sampleSufficient: true },
      recommendations: [{ code: "SEGMENT_DRIFT" }]
    },
    rows: biasedRows(12, 0.9, 2),
    now
  });
  assert.equal(proposal.status, "BLOCKED");
  assert.equal(proposal.reason, "GLOBAL_DRIFT_REQUIRED");
});

test("V21 blocks insufficient samples even when drift is critical", () => {
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL", true),
    rows: biasedRows(3),
    now
  });
  assert.equal(proposal.reason, "SAMPLE_INSUFFICIENT");
});

test("V21 proposes a clamped multiplier and requires replay improvement", () => {
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL"),
    rows: biasedRows(12, 0.85, 3),
    datasetFingerprint: "ds-1",
    runId: "run-1",
    now
  });
  assert.equal(proposal.eligible, true);
  assert.equal(proposal.status, "ELIGIBLE");
  assert.ok(proposal.multiplier < 1);
  assert.ok(proposal.multiplier >= 0.85);
  assert.ok(proposal.improvement >= 0.01);
  assert.equal(proposal.datasetFingerprint, "ds-1");
});

test("V21 proposal identity is deterministic", () => {
  const input = {
    report: report("WARNING"),
    rows: biasedRows(10, 0.7, 2),
    now
  };
  const first = buildRecalibrationProposal(input);
  const second = buildRecalibrationProposal(input);
  assert.equal(first.proposalId, second.proposalId);
});

test("V21 rejects a candidate that does not improve the replay", () => {
  const rows = biasedRows(10, 0.55, 4);
  const proposal = buildRecalibrationProposal({
    report: report("WARNING"),
    rows,
    now,
    config: { biasFloor: 0.01, minImprovement: 0.5 }
  });
  assert.equal(proposal.eligible, false);
  assert.equal(proposal.reason, "REPLAY_NOT_IMPROVED");
  assert.ok(proposal.replay);
});

test("V21 approval requires an eligible proposal and an actor", () => {
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL"),
    rows: biasedRows(10, 0.9, 2),
    now
  });
  const missingActor = decidePolicy({ proposal, decision: "APPROVE", now });
  assert.equal(missingActor.accepted, false);
  assert.equal(missingActor.reason, "MISSING_ACTOR");

  const approved = decidePolicy({
    proposal,
    decision: "APPROVE",
    actor: "operator",
    now
  });
  assert.equal(approved.accepted, true);
  assert.equal(approved.active.proposalId, proposal.proposalId);
  assert.equal(approved.active.multiplier, proposal.multiplier);
});

test("V21 approval rejects a forged multiplier outside the hard step", () => {
  const result = decidePolicy({
    proposal: {
      contractVersion: POLICY_CONTRACT_VERSION,
      proposalId: "V21-forged",
      eligible: true,
      multiplier: 1.4,
      datasetFingerprint: "ds-a"
    },
    decision: "APPROVE",
    actor: "operator",
    datasetFingerprint: "ds-a",
    now
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "PROPOSAL_STEP_EXCEEDED");
});

test("V21 cannot approve an ineligible proposal", () => {
  const proposal = buildRecalibrationProposal({
    report: report("STABLE"),
    rows: biasedRows(),
    now
  });
  const result = decidePolicy({
    proposal,
    decision: "APPROVE",
    actor: "operator",
    now
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "PROPOSAL_NOT_ELIGIBLE");
});

test("V21 reject records the decision and leaves no active policy", () => {
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL"),
    rows: biasedRows(10, 0.9, 2),
    now
  });
  const rejected = decidePolicy({
    proposal,
    decision: "REJECT",
    actor: "operator",
    now,
    reason: "not now"
  });
  assert.equal(rejected.accepted, true);
  assert.equal(rejected.active, null);
  const second = decidePolicy({
    ledger: rejected.ledger,
    proposal,
    decision: "APPROVE",
    actor: "operator",
    now
  });
  assert.equal(second.reason, "ALREADY_DECIDED");
});

test("V21 rollback restores the previous approved policy", () => {
  const first = buildRecalibrationProposal({
    report: report("CRITICAL"),
    rows: biasedRows(10, 0.9, 2),
    now
  });
  const second = buildRecalibrationProposal({
    report: report("CRITICAL"),
    rows: biasedRows(10, 0.7, 1),
    now: "2026-10-06T00:00:00.000Z"
  });
  const approvedFirst = decidePolicy({ proposal: first, decision: "APPROVE", actor: "operator", now });
  const approvedSecond = decidePolicy({
    ledger: approvedFirst.ledger,
    proposal: second,
    decision: "APPROVE",
    actor: "operator",
    now: "2026-10-06T00:00:00.000Z"
  });
  const rolled = decidePolicy({
    ledger: approvedSecond.ledger,
    decision: "ROLLBACK",
    actor: "operator",
    now: "2026-10-07T00:00:00.000Z"
  });
  assert.equal(rolled.accepted, true);
  assert.equal(rolled.active.proposalId, first.proposalId);
});

test("V21 isolates policy decisions by dataset fingerprint", () => {
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL"),
    rows: biasedRows(10, 0.9, 2),
    datasetFingerprint: "ds-a",
    now
  });
  const approved = decidePolicy({
    proposal,
    decision: "APPROVE",
    actor: "operator",
    datasetFingerprint: "ds-a",
    now
  });
  const other = decidePolicy({
    ledger: approved.ledger,
    proposal,
    decision: "APPROVE",
    actor: "operator",
    datasetFingerprint: "ds-b",
    now
  });
  assert.equal(other.reason, "DATASET_MISMATCH");
  assert.equal(summarisePolicy({
    proposal,
    ledger: approved.ledger,
    datasetFingerprint: "ds-b"
  }).activeMultiplier, null);
});

test("V21 applies the multiplier only to stage probabilities", () => {
  const adjusted = applyPolicyToAssumptions({
    qualified: 0.8,
    nurture: 0.4,
    new: 0.2,
    downside: 0.75,
    upside: 1.15,
    weight: 1
  }, { multiplier: 0.9 });
  assert.equal(adjusted.qualified, 0.72);
  assert.equal(adjusted.nurture, 0.36);
  assert.equal(adjusted.new, 0.18);
  assert.equal(adjusted.downside, 0.75);
  assert.equal(adjusted.upside, 1.15);
  assert.equal(adjusted.weight, 1);
});

test("V21 summary exports the decision state without ledger rows", () => {
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL"),
    rows: biasedRows(10, 0.9, 2),
    now
  });
  const approved = decidePolicy({ proposal, decision: "APPROVE", actor: "operator", now });
  const summary = summarisePolicy({ proposal, ledger: approved.ledger });
  assert.equal(summary.contractVersion, "21.0");
  assert.equal(summary.decisions, 1);
  assert.equal(summary.activeMultiplier, proposal.multiplier);
  assert.equal(Object.hasOwn(summary, "ledger"), false);
});
