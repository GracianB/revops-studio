import test from "node:test";
import assert from "node:assert/strict";
import {
  POLICY_CONTRACT_VERSION,
  buildRecalibrationProposal,
  decidePolicy
} from "../assets/js/policy-engine.js";
import {
  POLICY_EVIDENCE_VERSION,
  POLICY_EVIDENCE_SCHEMA,
  buildPolicyEvidenceManifest,
  buildPolicyEvidenceBundle,
  verifyPolicyEvidenceBundle,
  serialisePolicyEvidenceBundle
} from "../assets/js/policy-evidence.js";

const now = "2026-10-05T00:00:00.000Z";

function report() {
  return {
    severity: "CRITICAL",
    global: { severity: "CRITICAL", sampleSufficient: true },
    recommendations: [{ code: "CONTROLLED_RECALIBRATION" }]
  };
}

function rows(count = 10, probability = 0.9, successes = 2) {
  return Array.from({ length: count }, (_, index) => ({
    leadId: "L" + index,
    probability,
    observedSuccess: index < successes ? 1 : 0
  }));
}

function approvedEvidence({ datasetFingerprint = "ds-v26", includeRows = true } = {}) {
  const observed = rows();
  const proposal = buildRecalibrationProposal({
    report: report(),
    rows: observed,
    datasetFingerprint,
    runId: "run-v26",
    now
  });
  const decision = decidePolicy({
    proposal,
    decision: "APPROVE",
    actor: "gracian-local",
    reason: "portable evidence test",
    datasetFingerprint,
    rows: observed,
    now
  });
  return {
    rows: observed,
    proposal,
    ledger: decision.ledger,
    bundle: buildPolicyEvidenceBundle({
      datasetFingerprint,
      proposal,
      ledger: decision.ledger,
      rows: includeRows ? observed : null,
      exportedAt: now
    })
  };
}

test("V26 exposes a versioned policy evidence schema", () => {
  assert.equal(POLICY_CONTRACT_VERSION, "25.0");
  assert.equal(POLICY_EVIDENCE_VERSION, "26.0");
  assert.equal(POLICY_EVIDENCE_SCHEMA, "revops-policy-evidence");
});

test("V26 builds a stable manifest from policy lineage", () => {
  const { proposal, ledger } = approvedEvidence();
  const manifest = buildPolicyEvidenceManifest({
    datasetFingerprint: "ds-v26",
    proposal,
    ledger,
    active: ledger[0],
    observationMode: "FINGERPRINT_ONLY"
  });
  assert.equal(manifest.evidenceVersion, "26.0");
  assert.equal(manifest.policyContractVersion, "25.0");
  assert.equal(manifest.datasetFingerprint, "ds-v26");
  assert.equal(manifest.ledgerEventCount, 1);
  assert.equal(manifest.proposalLineage.contractVersion, "25.0");
  assert.equal(manifest.proposalLineage.sourceRunId, "run-v26");
});

test("V26 creates a portable bundle without raw rows", () => {
  const { bundle } = approvedEvidence({ includeRows: false });
  assert.equal(bundle.valid, true, bundle.reason);
  assert.equal(bundle.ledger.length, 1);
  assert.equal(bundle.proposal.rowsFingerprint.startsWith("D25-"), true);
  assert.equal(Object.prototype.hasOwnProperty.call(bundle, "rows"), false);
  assert.equal(bundle.verification.reason, "EVIDENCE_VERIFIED_FINGERPRINT_ONLY");
});

test("V26 verifies an exported bundle independently of raw rows", () => {
  const { bundle } = approvedEvidence({ includeRows: false });
  const result = verifyPolicyEvidenceBundle(bundle);
  assert.equal(result.valid, true, result.reason);
  assert.equal(result.reason, "EVIDENCE_VERIFIED_FINGERPRINT_ONLY");
});

test("V26 upgrades verification when the original observed rows are supplied", () => {
  const { bundle, rows: observed } = approvedEvidence({ includeRows: false });
  const result = verifyPolicyEvidenceBundle(bundle, { rows: observed });
  assert.equal(result.valid, true, result.reason);
  assert.equal(result.reason, "EVIDENCE_VERIFIED_WITH_ROWS");
  assert.equal(result.active, "ACTIVE_REPLAY_VERIFIED");
});

test("V26 rejects a forged manifest fingerprint", () => {
  const { bundle } = approvedEvidence({ includeRows: false });
  const forged = { ...bundle, manifestFingerprint: "E26-forged" };
  const result = verifyPolicyEvidenceBundle(forged);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "MANIFEST_FINGERPRINT_MISMATCH");
});

test("V26 rejects a forged ledger event", () => {
  const { bundle } = approvedEvidence({ includeRows: false });
  const forged = {
    ...bundle,
    ledger: bundle.ledger.map((event) => ({ ...event, actor: "intruder" }))
  };
  const result = verifyPolicyEvidenceBundle(forged);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "MANIFEST_MISMATCH");
});

test("V26 rejects a dataset scope swap", () => {
  const { bundle } = approvedEvidence({ includeRows: false });
  const result = verifyPolicyEvidenceBundle(bundle, { datasetFingerprint: "ds-other" });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "DATASET_SCOPE_MISMATCH");
});

test("V26 serialises the bundle as deterministic JSON", () => {
  const { bundle } = approvedEvidence({ includeRows: false });
  const serialised = serialisePolicyEvidenceBundle(bundle);
  assert.equal(typeof serialised, "string");
  const parsed = JSON.parse(serialised);
  assert.equal(parsed.evidenceVersion, "26.0");
  assert.equal(parsed.manifestFingerprint, bundle.manifestFingerprint);
});
