import test from "node:test";
import assert from "node:assert/strict";
import {
  POLICY_CONTRACT_VERSION,
  POLICY_HARD_MAX_STEP,
  POLICY_ABSOLUTE_MIN,
  POLICY_ABSOLUTE_MAX,
  buildReplayFingerprint,
  verifyPolicyProposal,
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

test("V22 contract exposes a hard bounded recalibration step", () => {
  const config = normalisePolicyConfig({ maxStep: 9, multiplierMin: 2, multiplierMax: 0.2 });
  assert.equal(config.maxStep, POLICY_HARD_MAX_STEP);
  assert.equal(config.maxStep, 0.15);
  assert.equal(config.multiplierMin, 0.5);
  assert.equal(config.multiplierMax, 1.5);
  assert.equal(POLICY_CONTRACT_VERSION, "22.0");
});

test("V22 blocks a stable report", () => {
  const proposal = buildRecalibrationProposal({
    report: report("STABLE"),
    rows: biasedRows(),
    now
  });
  assert.equal(proposal.status, "BLOCKED");
  assert.equal(proposal.reason, "GLOBAL_DRIFT_REQUIRED");
  assert.equal(proposal.eligible, false);
});

test("V22 requires global drift before proposing global recalibration", () => {
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

test("V22 blocks insufficient samples even when drift is critical", () => {
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL", true),
    rows: biasedRows(3),
    now
  });
  assert.equal(proposal.reason, "SAMPLE_INSUFFICIENT");
});

test("V22 proposes a clamped multiplier and requires replay improvement", () => {
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

test("V22 proposal identity is deterministic", () => {
  const input = {
    report: report("WARNING"),
    rows: biasedRows(10, 0.7, 2),
    now
  };
  const first = buildRecalibrationProposal(input);
  const second = buildRecalibrationProposal(input);
  assert.equal(first.proposalId, second.proposalId);
});

test("V22 rejects a candidate that does not improve the replay", () => {
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

test("V22 approval requires an eligible proposal and an actor", () => {
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL"),
    rows: biasedRows(10, 0.9, 2),
    datasetFingerprint: "ds-actor",
    now
  });
  const missingActor = decidePolicy({ proposal, decision: "APPROVE", now });
  assert.equal(missingActor.accepted, false);
  assert.equal(missingActor.reason, "MISSING_ACTOR");

  const approved = decidePolicy({
    proposal,
    decision: "APPROVE",
    actor: "operator",
    datasetFingerprint: "ds-actor",
    now
  });
  assert.equal(approved.accepted, true);
  assert.equal(approved.active.proposalId, proposal.proposalId);
  assert.equal(approved.active.multiplier, proposal.multiplier);
});

test("V22 approval rejects a forged multiplier outside the hard step", () => {
  const result = decidePolicy({
    proposal: {
      contractVersion: POLICY_CONTRACT_VERSION,
      proposalId: "V22-forged",
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
  assert.equal(result.reason, "REPLAY_BINDING_MISMATCH");
});

test("V22 cannot approve an ineligible proposal", () => {
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

test("V22 reject records the decision and leaves no active policy", () => {
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL"),
    rows: biasedRows(10, 0.9, 2),
    datasetFingerprint: "ds-reject",
    now
  });
  const rejected = decidePolicy({
    proposal,
    decision: "REJECT",
    actor: "operator",
    datasetFingerprint: "ds-reject",
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
    datasetFingerprint: "ds-reject",
    now
  });
  assert.equal(second.reason, "ALREADY_DECIDED");
});

test("V22 rollback restores the previous approved policy", () => {
  const first = buildRecalibrationProposal({
    report: report("CRITICAL"),
    rows: biasedRows(10, 0.9, 2),
    datasetFingerprint: "ds-rollback",
    now
  });
  const second = buildRecalibrationProposal({
    report: report("CRITICAL"),
    rows: biasedRows(10, 0.7, 1),
    datasetFingerprint: "ds-rollback",
    now: "2026-10-06T00:00:00.000Z"
  });
  const approvedFirst = decidePolicy({ proposal: first, decision: "APPROVE", actor: "operator", now });
  const approvedSecond = decidePolicy({
    ledger: approvedFirst.ledger,
    proposal: second,
    decision: "APPROVE",
    actor: "operator",
    datasetFingerprint: "ds-rollback",
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

test("V22 isolates policy decisions by dataset fingerprint", () => {
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

test("V22 applies the multiplier only to stage probabilities", () => {
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

test("V22 summary exports the decision state without ledger rows", () => {
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL"),
    rows: biasedRows(10, 0.9, 2),
    now
  });
  const approved = decidePolicy({ proposal, decision: "APPROVE", actor: "operator", datasetFingerprint: "ds-summary", now });
  const summary = summarisePolicy({ proposal, ledger: approved.ledger });
  assert.equal(summary.contractVersion, "22.0");
  assert.equal(summary.decisions, 1);
  assert.equal(summary.activeMultiplier, proposal.multiplier);
  assert.equal(Object.hasOwn(summary, "ledger"), false);
});

test("V22 proposal carries a replay binding anchored to the replay payload", () => {
  const proposal = buildRecalibrationProposal({ report: report("CRITICAL"), rows: biasedRows(12, 0.85, 3), datasetFingerprint: "ds-replay", runId: "run-replay", now });
  assert.equal(proposal.contractVersion, "22.0");
  assert.equal(proposal.baseMultiplier, 1);
  assert.equal(proposal.replayFingerprint, buildReplayFingerprint(proposal.replay));
  assert.equal(verifyPolicyProposal(proposal).valid, true);
});
test("V22 rejects approval when the replay payload changes after proposal generation", () => {
  const proposal = buildRecalibrationProposal({ report: report("CRITICAL"), rows: biasedRows(12, 0.85, 3), datasetFingerprint: "ds-tamper", runId: "run-tamper", now });
  const tampered = { ...proposal, replay: { ...proposal.replay, candidateBrier: Number((proposal.replay.candidateBrier + 0.01).toFixed(6)) } };
  const result = decidePolicy({ proposal: tampered, decision: "APPROVE", actor: "operator", datasetFingerprint: "ds-tamper", now });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "REPLAY_BINDING_MISMATCH");
});
test("V22 rejects a forged improvement even when the replay fingerprint is intact", () => {
  const proposal = buildRecalibrationProposal({ report: report("CRITICAL"), rows: biasedRows(12, 0.85, 3), datasetFingerprint: "ds-improvement", now });
  const tampered = { ...proposal, improvement: Number((proposal.improvement + 0.1).toFixed(6)) };
  const result = decidePolicy({ proposal: tampered, decision: "APPROVE", actor: "operator", datasetFingerprint: "ds-improvement", now });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "REPLAY_IMPROVEMENT_MISMATCH");
});
test("V22 absolute boundary rejects a policy above the base ceiling", () => {
  const proposal = buildRecalibrationProposal({ report: report("CRITICAL"), rows: biasedRows(20, 0.95, 1), datasetFingerprint: "ds-boundary", now });
  const forged = { ...proposal, multiplier: 1.16, replay: { ...proposal.replay, multiplier: 1.16 } };
  forged.replayFingerprint = buildReplayFingerprint(forged.replay);
  const result = decidePolicy({ proposal: forged, decision: "APPROVE", actor: "operator", datasetFingerprint: "ds-boundary", now });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "POLICY_BOUNDARY_MISMATCH");
});
test("V22 approval creates a stable policy instance identity", () => {
  const proposal = buildRecalibrationProposal({ report: report("CRITICAL"), rows: biasedRows(10, 0.9, 2), datasetFingerprint: "ds-policy-id", now });
  const a = decidePolicy({ proposal, decision: "APPROVE", actor: "operator", datasetFingerprint: "ds-policy-id", now });
  const b = decidePolicy({ proposal, decision: "APPROVE", actor: "operator", datasetFingerprint: "ds-policy-id", now });
  assert.equal(a.accepted, true);
  assert.equal(typeof a.active.policyId, "string");
  assert.equal(a.active.policyId, b.active.policyId);
  assert.equal(a.active.replayFingerprint, proposal.replayFingerprint);
});
test("V22 summary exposes policy identity, base deviation and integrity state", () => {
  const proposal = buildRecalibrationProposal({ report: report("CRITICAL"), rows: biasedRows(10, 0.9, 2), datasetFingerprint: "ds-summary", now });
  const approved = decidePolicy({ proposal, decision: "APPROVE", actor: "operator", datasetFingerprint: "ds-summary", now });
  const summary = summarisePolicy({ proposal, ledger: approved.ledger, datasetFingerprint: "ds-summary" });
  assert.equal(summary.activePolicyInstanceId, approved.active.policyId);
  assert.equal(summary.baseDeviation, Number((proposal.multiplier - 1).toFixed(6)));
  assert.equal(summary.integrity, "REPLAY_BINDING_VALID");
});
test("V22 active policy application cannot escape the absolute boundary", () => {
  const assumptions = { qualified: 0.8, nurture: 0.4, new: 0.2, downside: 0.75, upside: 1.15 };
  const adjusted = applyPolicyToAssumptions(assumptions, { multiplier: 1.5 });
  assert.equal(adjusted.qualified, 0.92);
  assert.equal(adjusted.nurture, 0.46);
  assert.equal(adjusted.new, 0.23);
  assert.equal(adjusted.downside, 0.75);
  assert.equal(adjusted.upside, 1.15);
});
