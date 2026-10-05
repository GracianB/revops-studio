import test from "node:test";
import assert from "node:assert/strict";
import {
  POLICY_CONTRACT_VERSION,
  POLICY_HARD_MAX_STEP,
  POLICY_ABSOLUTE_MIN,
  POLICY_ABSOLUTE_MAX,
  buildReplayFingerprint,
  buildRowsFingerprint,
  buildPolicyProposalFingerprint,
  buildPolicyLineageFingerprint,
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

test("V24 contract exposes a hard bounded recalibration step", () => {
  const config = normalisePolicyConfig({ maxStep: 9, multiplierMin: 2, multiplierMax: 0.2 });
  assert.equal(config.maxStep, POLICY_HARD_MAX_STEP);
  assert.equal(config.maxStep, 0.15);
  assert.equal(config.multiplierMin, 0.5);
  assert.equal(config.multiplierMax, 1.5);
  assert.equal(POLICY_CONTRACT_VERSION, "24.0");
});

test("V24 blocks a stable report", () => {
  const proposal = buildRecalibrationProposal({
    report: report("STABLE"),
    rows: biasedRows(),
    now
  });
  assert.equal(proposal.status, "BLOCKED");
  assert.equal(proposal.reason, "GLOBAL_DRIFT_REQUIRED");
  assert.equal(proposal.eligible, false);
});

test("V24 requires global drift before proposing global recalibration", () => {
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

test("V24 blocks insufficient samples even when drift is critical", () => {
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL", true),
    rows: biasedRows(3),
    now
  });
  assert.equal(proposal.reason, "SAMPLE_INSUFFICIENT");
});

test("V24 proposes a clamped multiplier and requires replay improvement", () => {
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

test("V24 proposal identity is deterministic", () => {
  const input = {
    report: report("WARNING"),
    rows: biasedRows(10, 0.7, 2),
    now
  };
  const first = buildRecalibrationProposal(input);
  const second = buildRecalibrationProposal(input);
  assert.equal(first.proposalId, second.proposalId);
});

test("V24 rejects a candidate that does not improve the replay", () => {
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

test("V24 approval requires an eligible proposal and an actor", () => {
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL"),
    rows: biasedRows(10, 0.9, 2),
    datasetFingerprint: "ds-actor",
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
    datasetFingerprint: "ds-actor",
    rows: biasedRows(10, 0.9, 2),
    now
  });
  assert.equal(approved.accepted, true, approved.reason);
  assert.equal(approved.active.proposalId, proposal.proposalId);
  assert.equal(approved.active.multiplier, proposal.multiplier);
});

test("V24 approval rejects a forged multiplier outside the hard step", () => {
  const result = decidePolicy({
    proposal: {
      contractVersion: POLICY_CONTRACT_VERSION,
      proposalId: "V24-forged",
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

test("V24 cannot approve an ineligible proposal", () => {
  const proposal = buildRecalibrationProposal({
    report: report("STABLE"),
    rows: biasedRows(),
    datasetFingerprint: "ds-ineligible",
    now
  });
  const result = decidePolicy({
    proposal,
    decision: "APPROVE",
    actor: "operator",
    datasetFingerprint: "ds-ineligible",
    rows: biasedRows(),
    now
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "PROPOSAL_NOT_ELIGIBLE");
});

test("V24 reject records the decision and leaves no active policy", () => {
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
    rows: biasedRows(10, 0.9, 2),
    now
  });
  assert.equal(second.reason, "ALREADY_DECIDED");
});

test("V24 rollback restores the previous approved policy", () => {
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
  const approvedFirst = decidePolicy({ proposal: first, decision: "APPROVE", actor: "gracian-local", reason: "test governance", datasetFingerprint: "ds-rollback", rows: biasedRows(10, 0.9, 2), now });
  const approvedSecond = decidePolicy({
    ledger: approvedFirst.ledger,
    proposal: second,
    decision: "APPROVE",
    actor: "operator",
    datasetFingerprint: "ds-rollback",
    rows: biasedRows(10, 0.7, 1),
    now: "2026-10-06T00:00:00.000Z"
  });
  const rolled = decidePolicy({
    ledger: approvedSecond.ledger,
    decision: "ROLLBACK",
    actor: "operator",
    datasetFingerprint: "ds-rollback",
    now: "2026-10-07T00:00:00.000Z"
  });
  assert.equal(rolled.accepted, true);
  assert.equal(rolled.active.proposalId, first.proposalId);
});

test("V24 isolates policy decisions by dataset fingerprint", () => {
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
    rows: biasedRows(10, 0.9, 2),
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

test("V24 applies the multiplier only to stage probabilities", () => {
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

test("V24 summary exports the decision state without ledger rows", () => {
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL"),
    rows: biasedRows(10, 0.9, 2),
    datasetFingerprint: "ds-summary",
    now
  });
  const approved = decidePolicy({ proposal, decision: "APPROVE", actor: "gracian-local", reason: "test governance", datasetFingerprint: "ds-summary", rows: biasedRows(10, 0.9, 2), now });
  const summary = summarisePolicy({ proposal, ledger: approved.ledger, datasetFingerprint: "ds-summary", rows: biasedRows(10, 0.9, 2) });
  assert.equal(summary.contractVersion, "24.0");
  assert.equal(summary.decisions, 1);
  assert.equal(summary.activeMultiplier, proposal.multiplier);
  assert.equal(Object.hasOwn(summary, "ledger"), false);
});

test("V24 proposal carries a replay binding anchored to the replay payload", () => {
  const proposal = buildRecalibrationProposal({ report: report("CRITICAL"), rows: biasedRows(12, 0.85, 3), datasetFingerprint: "ds-replay", runId: "run-replay", now });
  assert.equal(proposal.contractVersion, "24.0");
  assert.equal(proposal.baseMultiplier, 1);
  assert.equal(proposal.replayFingerprint, buildReplayFingerprint(proposal.replay));
  assert.equal(verifyPolicyProposal(proposal, { rows: biasedRows(12, 0.85, 3) }).reason, "REPLAY_ROWS_VERIFIED");
});
test("V24 rejects approval when the replay payload changes after proposal generation", () => {
  const proposal = buildRecalibrationProposal({ report: report("CRITICAL"), rows: biasedRows(12, 0.85, 3), datasetFingerprint: "ds-tamper", runId: "run-tamper", now });
  const tampered = { ...proposal, replay: { ...proposal.replay, candidateBrier: Number((proposal.replay.candidateBrier + 0.01).toFixed(6)) } };
  const result = decidePolicy({ proposal: tampered, decision: "APPROVE", actor: "gracian-local", reason: "test governance", datasetFingerprint: "ds-tamper", now });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "REPLAY_BINDING_MISMATCH");
});
test("V24 rejects a forged improvement even when the replay fingerprint is intact", () => {
  const proposal = buildRecalibrationProposal({ report: report("CRITICAL"), rows: biasedRows(12, 0.85, 3), datasetFingerprint: "ds-improvement", now });
  const tampered = { ...proposal, improvement: Number((proposal.improvement + 0.1).toFixed(6)) };
  const result = decidePolicy({ proposal: tampered, decision: "APPROVE", actor: "gracian-local", reason: "test governance", datasetFingerprint: "ds-improvement", now });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "REPLAY_IMPROVEMENT_MISMATCH");
});
test("V24 absolute boundary rejects a policy above the base ceiling", () => {
  const proposal = buildRecalibrationProposal({ report: report("CRITICAL"), rows: biasedRows(20, 0.95, 1), datasetFingerprint: "ds-boundary", now });
  const forged = { ...proposal, multiplier: 1.16, replay: { ...proposal.replay, multiplier: 1.16 } };
  forged.replayFingerprint = buildReplayFingerprint(forged.replay);
  const result = decidePolicy({ proposal: forged, decision: "APPROVE", actor: "gracian-local", reason: "test governance", datasetFingerprint: "ds-boundary", rows: biasedRows(20, 0.95, 1), now });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "POLICY_BOUNDARY_MISMATCH");
});
test("V24 approval creates a stable policy instance identity", () => {
  const proposal = buildRecalibrationProposal({ report: report("CRITICAL"), rows: biasedRows(10, 0.9, 2), datasetFingerprint: "ds-policy-id", now });
  const a = decidePolicy({ proposal, decision: "APPROVE", actor: "gracian-local", reason: "test governance", datasetFingerprint: "ds-policy-id", rows: biasedRows(10, 0.9, 2), now });
  const b = decidePolicy({ proposal, decision: "APPROVE", actor: "gracian-local", reason: "test governance", datasetFingerprint: "ds-policy-id", rows: biasedRows(10, 0.9, 2), now });
  assert.equal(a.accepted, true, a.reason);
  assert.equal(typeof a.active.policyId, "string");
  assert.equal(a.active.policyId, b.active.policyId);
  assert.equal(a.active.replayFingerprint, proposal.replayFingerprint);
});
test("V24 summary exposes policy identity, base deviation and integrity state", () => {
  const proposal = buildRecalibrationProposal({ report: report("CRITICAL"), rows: biasedRows(10, 0.9, 2), datasetFingerprint: "ds-summary", now });
  const approved = decidePolicy({ proposal, decision: "APPROVE", actor: "gracian-local", reason: "test governance", datasetFingerprint: "ds-summary", rows: biasedRows(10, 0.9, 2), now });
  const summary = summarisePolicy({ proposal, ledger: approved.ledger, datasetFingerprint: "ds-summary", rows: biasedRows(10, 0.9, 2) });
  assert.equal(summary.activePolicyInstanceId, approved.active.policyId);
  assert.equal(summary.baseDeviation, Number((proposal.multiplier - 1).toFixed(6)));
  assert.equal(summary.integrity, "REPLAY_ROWS_VERIFIED");
});
test("V24 active policy application cannot escape the absolute boundary", () => {
  const assumptions = { qualified: 0.8, nurture: 0.4, new: 0.2, downside: 0.75, upside: 1.15 };
  const adjusted = applyPolicyToAssumptions(assumptions, { multiplier: 1.5 });
  assert.equal(adjusted.qualified, 0.92);
  assert.equal(adjusted.nurture, 0.46);
  assert.equal(adjusted.new, 0.23);
  assert.equal(adjusted.downside, 0.75);
  assert.equal(adjusted.upside, 1.15);
});

test("V24 requires the observed rows to approve a proposal", () => {
  const proposal = buildRecalibrationProposal({ report: report("CRITICAL"), rows: biasedRows(10, 0.9, 2), datasetFingerprint: "ds-proof", now });
  const result = decidePolicy({ proposal, decision: "APPROVE", actor: "gracian-local", reason: "test governance", datasetFingerprint: "ds-proof", now });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "ROWS_REQUIRED_FOR_APPROVAL");
});
test("V24 rejects approval when the observed rows change", () => {
  const originalRows = biasedRows(10, 0.9, 2);
  const changedRows = biasedRows(10, 0.9, 1);
  const proposal = buildRecalibrationProposal({ report: report("CRITICAL"), rows: originalRows, datasetFingerprint: "ds-real", now });
  const result = decidePolicy({ proposal, decision: "APPROVE", actor: "gracian-local", reason: "test governance", datasetFingerprint: "ds-real", rows: changedRows, now });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "ROWS_FINGERPRINT_MISMATCH");
});
test("V24 ledger drops an approved event with an invalid multiplier", () => {
  const rows = biasedRows(10, 0.9, 2);
  const proposal = buildRecalibrationProposal({ report: report("CRITICAL"), rows, datasetFingerprint: "ds-ledger", now });
  const approved = decidePolicy({ proposal, decision: "APPROVE", actor: "gracian-local", reason: "test governance", datasetFingerprint: "ds-ledger", rows, now });
  const tampered = approved.ledger.map((event) => ({ ...event, multiplier: 1.9 }));
  assert.equal(summarisePolicy({ ledger: tampered, datasetFingerprint: "ds-ledger" }).activeMultiplier, null);
});
test("V24 active policy is fail-closed without a dataset fingerprint", () => {
  const rows = biasedRows(10, 0.9, 2);
  const proposal = buildRecalibrationProposal({ report: report("CRITICAL"), rows, datasetFingerprint: "ds-scope", now });
  const approved = decidePolicy({ proposal, decision: "APPROVE", actor: "gracian-local", reason: "test governance", datasetFingerprint: "ds-scope", rows, now });
  assert.equal(summarisePolicy({ ledger: approved.ledger }).activeMultiplier, null);
});

test("V24 diagnostic: evidence verification returns a verified state", () => {
  const rows = biasedRows(10, 0.9, 2);
  const proposal = buildRecalibrationProposal({ report: report("CRITICAL"), rows, datasetFingerprint: "ds-diagnostic", now });
  const verification = verifyPolicyProposal(proposal, { rows });
  assert.equal(verification.valid, true, verification.reason);
  assert.equal(verification.reason, "REPLAY_ROWS_VERIFIED");
});

test("V24 requires a real actor identity", () => {
  const rows = biasedRows(10, 0.9, 2);
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL"), rows, datasetFingerprint: "ds-actor", runId: "run-actor", now
  });
  const result = decidePolicy({
    proposal, decision: "APPROVE", actor: "operator", reason: "test governance",
    datasetFingerprint: "ds-actor", rows, now
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "ACTOR_IDENTITY_REQUIRED");
});

test("V24 requires a rationale for every policy decision", () => {
  const rows = biasedRows(10, 0.9, 2);
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL"), rows, datasetFingerprint: "ds-rationale", runId: "run-rationale", now
  });
  const result = decidePolicy({
    proposal, decision: "APPROVE", actor: "gracian-local",
    datasetFingerprint: "ds-rationale", rows, now
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "MISSING_RATIONALE");
});

test("V24 proposal approval expires stale evidence", () => {
  const rows = biasedRows(10, 0.9, 2);
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL"), rows, datasetFingerprint: "ds-expiry", runId: "run-expiry",
    now: "2026-10-01T00:00:00.000Z"
  });
  const result = decidePolicy({
    proposal, decision: "APPROVE", actor: "gracian-local", reason: "approved from tested evidence",
    datasetFingerprint: "ds-expiry", rows, now: "2026-10-05T00:00:00.000Z"
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "PROPOSAL_EXPIRED");
});

test("V24 proposal contains a complete deterministic lineage", () => {
  const rows = biasedRows(10, 0.9, 2);
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL"), rows, datasetFingerprint: "ds-lineage", runId: "run-lineage", now
  });
  assert.equal(proposal.contractVersion, "24.0");
  assert.equal(proposal.rowsFingerprint, buildRowsFingerprint(rows));
  assert.equal(proposal.proposalFingerprint, buildPolicyProposalFingerprint(proposal));
  assert.equal(proposal.lineageFingerprint, buildPolicyLineageFingerprint(proposal.lineage));
  assert.equal(proposal.lineage.sourceRunId, "run-lineage");
  assert.equal(proposal.lineage.datasetFingerprint, "ds-lineage");
  assert.equal(proposal.lineage.replayFingerprint, proposal.replayFingerprint);
});

test("V24 rejects tampered proposal lineage", () => {
  const rows = biasedRows(10, 0.9, 2);
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL"), rows, datasetFingerprint: "ds-lineage-tamper", runId: "run-lineage-tamper", now
  });
  const tampered = {
    ...proposal,
    lineage: { ...proposal.lineage, rowsFingerprint: "D24-forged" }
  };
  const result = decidePolicy({
    proposal: tampered, decision: "APPROVE", actor: "gracian-local",
    reason: "tamper test", datasetFingerprint: "ds-lineage-tamper", rows, now
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "PROPOSAL_FINGERPRINT_MISMATCH");
});

test("V24 approval stores actor, rationale and complete policy lineage", () => {
  const rows = biasedRows(10, 0.9, 2);
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL"), rows, datasetFingerprint: "ds-approval-lineage", runId: "run-approval-lineage", now
  });
  const result = decidePolicy({
    proposal, decision: "APPROVE", actor: "gracian-local",
    reason: "evidence replay verified", datasetFingerprint: "ds-approval-lineage", rows, now
  });
  assert.equal(result.accepted, true, result.reason);
  assert.equal(result.active.actor, "gracian-local");
  assert.equal(result.active.rationale, "evidence replay verified");
  assert.equal(result.active.runId, "run-approval-lineage");
  assert.equal(result.active.proposalFingerprint, proposal.proposalFingerprint);
  assert.equal(result.active.rowsFingerprint, proposal.rowsFingerprint);
  assert.equal(result.active.replayFingerprint, proposal.replayFingerprint);
  assert.match(result.active.policyId, /^V24P-/);
  assert.match(result.active.lineageFingerprint, /^L24-/);
});

test("V24 ledger is fail-closed when lineage is tampered", () => {
  const rows = biasedRows(10, 0.9, 2);
  const proposal = buildRecalibrationProposal({
    report: report("CRITICAL"), rows, datasetFingerprint: "ds-ledger-lineage", runId: "run-ledger-lineage", now
  });
  const result = decidePolicy({
    proposal, decision: "APPROVE", actor: "gracian-local",
    reason: "ledger test", datasetFingerprint: "ds-ledger-lineage", rows, now
  });
  const tampered = result.ledger.map((event) => ({ ...event, lineageFingerprint: "L24-forged" }));
  assert.equal(summarisePolicy({
    ledger: tampered, datasetFingerprint: "ds-ledger-lineage"
  }).activeMultiplier, null);
});
