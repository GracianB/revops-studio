import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  POLICY_SIGNATURE_VERSION,
  POLICY_SIGNATURE_ALGORITHM,
  generatePolicyEvidenceKeyPair,
  importPolicyEvidencePrivateKey,
  buildPolicyEvidenceSigningPayload,
  signPolicyEvidenceBundle,
  verifyPolicyEvidenceSignature,
  serialiseSignedPolicyEvidenceBundle
} from "../assets/js/policy-evidence-signing.js";
import {
  buildRecalibrationProposal,
  decidePolicy
} from "../assets/js/policy-engine.js";
import { buildPolicyEvidenceBundle } from "../assets/js/policy-evidence.js";

globalThis.crypto = webcrypto;

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

async function signedEvidence() {
  const observed = rows();
  const datasetFingerprint = "ds-v27";
  const proposal = buildRecalibrationProposal({
    report: report(),
    rows: observed,
    datasetFingerprint,
    runId: "run-v27",
    now
  });
  const decision = decidePolicy({
    proposal,
    decision: "APPROVE",
    actor: "gracian-local",
    reason: "cryptographic signature test",
    datasetFingerprint,
    rows: observed,
    now
  });
  const bundle = buildPolicyEvidenceBundle({
    datasetFingerprint,
    proposal,
    ledger: decision.ledger,
    rows: observed,
    exportedAt: now
  });
  const keys = await generatePolicyEvidenceKeyPair();
  const signed = await signPolicyEvidenceBundle(bundle, {
    privateKey: keys.privateKey,
    publicKeyJwk: keys.publicKeyJwk
  });
  return { observed, bundle, keys, signed };
}

test("V27 exposes an explicit ECDSA signature contract", () => {
  assert.equal(POLICY_SIGNATURE_VERSION, "27.0");
  assert.equal(POLICY_SIGNATURE_ALGORITHM, "ECDSA-P256-SHA256");
});

test("V27 generates a portable P-256 key identity", async () => {
  const keys = await generatePolicyEvidenceKeyPair();
  assert.equal(keys.publicKeyJwk.kty, "EC");
  assert.equal(keys.publicKeyJwk.crv, "P-256");
  assert.match(keys.keyFingerprint, /^S27-/);
  assert.ok(keys.privateKey);
});

test("V27 imports an exported private key without changing its identity", async () => {
  const keys = await generatePolicyEvidenceKeyPair();
  const imported = await importPolicyEvidencePrivateKey(keys.privateKeyJwk);
  assert.equal(imported.keyFingerprint, keys.keyFingerprint);
});

test("V27 builds a stable signing payload from the V26 bundle", async () => {
  const { bundle } = await signedEvidence();
  const payload = await buildPolicyEvidenceSigningPayload(bundle);
  assert.equal(payload.valid, true);
  assert.equal(payload.reason, "SIGNING_PAYLOAD_READY");
  assert.match(payload.fingerprint, /^S27-/);
});

test("V27 signs and verifies a policy evidence bundle", async () => {
  const { signed, keys } = await signedEvidence();
  assert.equal(signed.valid, true, signed.reason);
  assert.equal(signed.bundle.signature.signatureVersion, "27.0");
  const verified = await verifyPolicyEvidenceSignature(signed.bundle, {
    expectedKeyFingerprint: keys.keyFingerprint
  });
  assert.equal(verified.valid, true, verified.reason);
  assert.equal(verified.reason, "SIGNATURE_VERIFIED");
});

test("V27 upgrades signature verification with the original observed rows", async () => {
  const { signed, keys, observed } = await signedEvidence();
  const verified = await verifyPolicyEvidenceSignature(signed.bundle, {
    expectedKeyFingerprint: keys.keyFingerprint,
    datasetFingerprint: "ds-v27",
    rows: observed
  });
  assert.equal(verified.valid, true, verified.reason);
  assert.equal(verified.evidence, "EVIDENCE_VERIFIED_WITH_ROWS");
});

test("V27 rejects a tampered signed payload", async () => {
  const { signed } = await signedEvidence();
  const forged = {
    ...signed.bundle,
    manifest: {
      ...signed.bundle.manifest,
      ledgerEventCount: 99
    }
  };
  const verified = await verifyPolicyEvidenceSignature(forged);
  assert.equal(verified.valid, false);
  assert.equal(verified.reason, "EVIDENCE_NOT_VERIFIED");
});

test("V27 rejects a payload with modified signature bytes", async () => {
  const { signed } = await signedEvidence();
  const original = signed.bundle.signature.signature;
  const last = original.at(-1) === "A" ? "B" : "A";
  const forged = {
    ...signed.bundle,
    signature: {
      ...signed.bundle.signature,
      signature: original.slice(0, -1) + last
    }
  };
  const verified = await verifyPolicyEvidenceSignature(forged);
  assert.equal(verified.valid, false);
  assert.equal(verified.reason, "SIGNATURE_INVALID");
});

test("V27 rejects the wrong pinned signer", async () => {
  const { signed } = await signedEvidence();
  const other = await generatePolicyEvidenceKeyPair();
  const verified = await verifyPolicyEvidenceSignature(signed.bundle, {
    expectedKeyFingerprint: other.keyFingerprint
  });
  assert.equal(verified.valid, false);
  assert.equal(verified.reason, "SIGNER_KEY_MISMATCH");
});

test("V27 serialises a signed evidence package as JSON", async () => {
  const { signed } = await signedEvidence();
  const json = serialiseSignedPolicyEvidenceBundle(signed.bundle);
  assert.equal(typeof json, "string");
  const parsed = JSON.parse(json);
  assert.equal(parsed.signature.algorithm, "ECDSA-P256-SHA256");
});
