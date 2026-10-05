import test from "node:test";
import assert from "node:assert/strict";
import {
  TRUST_REGISTRY_VERSION,
  TRUST_REGISTRY_SCHEMA,
  TRUST_STATES,
  TRUST_ACTIONS,
  createTrustRegistry,
  buildTrustedSignerFingerprint,
  registerTrustedSigner,
  retireTrustedSigner,
  revokeTrustedSigner,
  rotateTrustedSigner,
  resolveTrustedSigner,
  verifyTrustRegistry,
  verifyTrustedPolicyEvidence,
  exportTrustRegistry,
  importTrustRegistry
} from "../assets/js/policy-trust-registry.js";
import { generatePolicyEvidenceKeyPair, signPolicyEvidenceBundle } from "../assets/js/policy-evidence-signing.js";
import { buildRecalibrationProposal, decidePolicy } from "../assets/js/policy-engine.js";
import { buildPolicyEvidenceBundle } from "../assets/js/policy-evidence.js";

const now = "2026-10-05T00:00:00.000Z";
function report() {
  return {
    severity: "CRITICAL",
    global: { severity: "CRITICAL", sampleSufficient: true },
    recommendations: [{ code: "CONTROLLED_RECALIBRATION" }]
  };
}

function rows() {
  return Array.from({ length: 10 }, (_, i) => ({
    leadId: "L" + i,
    probability: 0.9,
    observedSuccess: i < 2 ? 1 : 0
  }));
}

async function signedBundle(keys, exportedAt = now) {
  const observed = rows();
  const datasetFingerprint = "ds-v28";
  const proposal = buildRecalibrationProposal({
    report: report(),
    rows: observed,
    datasetFingerprint,
    runId: "run-v28",
    now: exportedAt
  });
  const decision = decidePolicy({
    proposal,
    decision: "APPROVE",
    actor: "gracian-local",
    reason: "trust registry test",
    datasetFingerprint,
    rows: observed,
    now: exportedAt
  });
  return {
    observed,
    signed: await signPolicyEvidenceBundle(
      buildPolicyEvidenceBundle({
        datasetFingerprint,
        proposal,
        ledger: decision.ledger,
        rows: observed,
        exportedAt
      }),
      { privateKey: keys.privateKey, publicKeyJwk: keys.publicKeyJwk }
    )
  };
}

async function trustedRegistry(keys, effectiveAt = now) {
  const registry = createTrustRegistry();
  const registered = await registerTrustedSigner(registry, {
    publicKeyJwk: keys.publicKeyJwk,
    effectiveAt,
    actor: "security-owner",
    rationale: "initial trusted signer",
    createdAt: effectiveAt
  });
  assert.equal(registered.accepted, true, registered.reason);
  return registered.registry;
}

test("V28 exposes the trusted signer registry contract", () => {
  assert.equal(TRUST_REGISTRY_VERSION, "28.0");
  assert.equal(TRUST_REGISTRY_SCHEMA, "revops-policy-trust-registry");
  assert.equal(TRUST_STATES.ACTIVE, "ACTIVE");
  assert.equal(TRUST_ACTIONS.REVOKE, "REVOKE");
});

test("V28 builds deterministic K28 signer fingerprints", async () => {
  const keys = await generatePolicyEvidenceKeyPair();
  const a = await buildTrustedSignerFingerprint(keys.publicKeyJwk);
  const b = await buildTrustedSignerFingerprint(keys.publicKeyJwk);
  assert.equal(a, b);
  assert.match(a, /^K28-/);
});

test("V28 registers and verifies a trusted signer", async () => {
  const keys = await generatePolicyEvidenceKeyPair();
  const registry = await trustedRegistry(keys);
  const verification = await verifyTrustRegistry(registry);
  assert.equal(verification.valid, true, verification.reason);
  assert.equal(resolveTrustedSigner(registry, await buildTrustedSignerFingerprint(keys.publicKeyJwk), now).state, "ACTIVE");
});

test("V28 rejects forged event fingerprints", async () => {
  const keys = await generatePolicyEvidenceKeyPair();
  const registry = await trustedRegistry(keys);
  const forged = {
    ...registry,
    events: registry.events.map((event) => ({ ...event, rationale: "forged" }))
  };
  const result = await verifyTrustRegistry(forged);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRUST_EVENT_FINGERPRINT_MISMATCH");
});

test("V28 retires a signer while preserving historical trust", async () => {
  const keys = await generatePolicyEvidenceKeyPair();
  const registry = await trustedRegistry(keys);
  const fingerprint = await buildTrustedSignerFingerprint(keys.publicKeyJwk);
  const retired = await retireTrustedSigner(registry, {
    keyFingerprint: fingerprint,
    effectiveAt: "2026-10-06T00:00:00.000Z",
    actor: "security-owner",
    rationale: "routine rotation",
    createdAt: "2026-10-06T00:00:00.000Z"
  });
  assert.equal(retired.accepted, true, retired.reason);
  assert.equal(resolveTrustedSigner(retired.registry, fingerprint, now).state, "ACTIVE");
  assert.equal(resolveTrustedSigner(retired.registry, fingerprint, "2026-10-06T01:00:00.000Z").state, "RETIRED");
});

test("V28 rotates an active signer to a successor", async () => {
  const oldKeys = await generatePolicyEvidenceKeyPair();
  const newKeys = await generatePolicyEvidenceKeyPair();
  const registry = await trustedRegistry(oldKeys);
  const oldFp = await buildTrustedSignerFingerprint(oldKeys.publicKeyJwk);
  const rotated = await rotateTrustedSigner(registry, {
    previousKeyFingerprint: oldFp,
    newPublicKeyJwk: newKeys.publicKeyJwk,
    effectiveAt: "2026-10-06T00:00:00.000Z",
    actor: "security-owner",
    rationale: "scheduled key rotation",
    createdAt: "2026-10-06T00:00:00.000Z"
  });
  assert.equal(rotated.accepted, true, rotated.reason);
  const newFp = await buildTrustedSignerFingerprint(newKeys.publicKeyJwk);
  assert.equal(resolveTrustedSigner(rotated.registry, oldFp, "2026-10-06T12:00:00.000Z").state, "RETIRED");
  assert.equal(resolveTrustedSigner(rotated.registry, newFp, "2026-10-06T12:00:00.000Z").state, "ACTIVE");
});

test("V28 rotation rejects a non-active predecessor", async () => {
  const a = await generatePolicyEvidenceKeyPair();
  const b = await generatePolicyEvidenceKeyPair();
  const c = await generatePolicyEvidenceKeyPair();
  let registry = await trustedRegistry(a);
  const fp = await buildTrustedSignerFingerprint(a.publicKeyJwk);
  registry = (await retireTrustedSigner(registry, {
    keyFingerprint: fp,
    effectiveAt: "2026-10-06T00:00:00.000Z",
    actor: "security-owner",
    rationale: "retire",
    createdAt: "2026-10-06T00:00:00.000Z"
  })).registry;
  const result = await rotateTrustedSigner(registry, {
    previousKeyFingerprint: fp,
    newPublicKeyJwk: b.publicKeyJwk,
    effectiveAt: "2026-10-07T00:00:00.000Z",
    actor: "security-owner",
    rationale: "invalid rotation",
    createdAt: "2026-10-07T00:00:00.000Z"
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "PREDECESSOR_NOT_ACTIVE");
  void c;
});

test("V28 revocation blocks trust even when cryptography is valid", async () => {
  const keys = await generatePolicyEvidenceKeyPair();
  let registry = await trustedRegistry(keys);
  const fingerprint = await buildTrustedSignerFingerprint(keys.publicKeyJwk);
  registry = (await revokeTrustedSigner(registry, {
    keyFingerprint: fingerprint,
    effectiveAt: "2026-10-06T00:00:00.000Z",
    actor: "security-owner",
    rationale: "key compromise",
    createdAt: "2026-10-06T00:00:00.000Z"
  })).registry;
  const evidence = await signedBundle(keys, "2026-10-07T00:00:00.000Z");
  const registryCheck = await verifyTrustRegistry(registry);
  assert.equal(registryCheck.valid, true, registryCheck.reason);
  const result = await verifyTrustedPolicyEvidence(evidence.signed.bundle, { registry });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "SIGNER_REVOKED");
});

test("V28 verifies active trusted evidence", async () => {
  const keys = await generatePolicyEvidenceKeyPair();
  const registry = await trustedRegistry(keys);
  const evidence = await signedBundle(keys);
  const result = await verifyTrustedPolicyEvidence(evidence.signed.bundle, {
    registry,
    rows: evidence.observed
  });
  assert.equal(result.valid, true, result.reason);
  assert.equal(result.reason, "TRUSTED_ACTIVE_SIGNATURE");
});

test("V28 accepts historical signatures from retired signers", async () => {
  const keys = await generatePolicyEvidenceKeyPair();
  let registry = await trustedRegistry(keys);
  const fingerprint = await buildTrustedSignerFingerprint(keys.publicKeyJwk);
  registry = (await retireTrustedSigner(registry, {
    keyFingerprint: fingerprint,
    effectiveAt: "2026-10-06T00:00:00.000Z",
    actor: "security-owner",
    rationale: "rotation completed",
    createdAt: "2026-10-06T00:00:00.000Z"
  })).registry;
  const evidence = await signedBundle(keys, now);
  const registryCheck = await verifyTrustRegistry(registry);
  assert.equal(registryCheck.valid, true, registryCheck.reason);
  const result = await verifyTrustedPolicyEvidence(evidence.signed.bundle, { registry });
  assert.equal(result.valid, true, result.reason);
  assert.equal(result.reason, "TRUSTED_HISTORICAL_SIGNATURE");
});

test("V28 rejects a forged register state", async () => {
  const keys = await generatePolicyEvidenceKeyPair();
  const registry = await trustedRegistry(keys);
  const forged = {
    ...registry,
    events: [{
      ...registry.events[0],
      action: "REGISTER",
      state: "RETIRED",
      eventFingerprint: registry.events[0].eventFingerprint
    }]
  };
  const result = await verifyTrustRegistry(forged);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRUST_REGISTER_INVALID");
});

test("V28 rejects duplicate signer registration in a forged registry", async () => {
  const keys = await generatePolicyEvidenceKeyPair();
  const registry = await trustedRegistry(keys);
  const duplicateEvent = {
    ...registry.events[0],
    eventId: "T28-DUPLICATE",
    createdAt: "2026-10-05T01:00:00.000Z"
  };
  const forged = {
    ...registry,
    events: [...registry.events, duplicateEvent],
    headFingerprint: duplicateEvent.eventFingerprint
  };
  const result = await verifyTrustRegistry(forged);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRUST_DUPLICATE_EVENT");
});

test("V28 revocation invalidates a signature that was created before compromise", async () => {
  const keys = await generatePolicyEvidenceKeyPair();
  let registry = await trustedRegistry(keys);
  const evidence = await signedBundle(keys, now);
  const fingerprint = await buildTrustedSignerFingerprint(keys.publicKeyJwk);
  registry = (await revokeTrustedSigner(registry, {
    keyFingerprint: fingerprint,
    effectiveAt: "2026-10-06T00:00:00.000Z",
    actor: "security-owner",
    rationale: "key compromise discovered after signing",
    createdAt: "2026-10-06T00:00:00.000Z"
  })).registry;
  const result = await verifyTrustedPolicyEvidence(evidence.signed.bundle, { registry });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "SIGNER_REVOKED");
});

test("V28 exports and re-imports a verified trust registry", async () => {
  const keys = await generatePolicyEvidenceKeyPair();
  const registry = await trustedRegistry(keys);
  const exported = await exportTrustRegistry(registry);
  assert.equal(exported.valid, true, exported.reason);
  const imported = await importTrustRegistry(exported.json);
  assert.equal(imported.valid, true, imported.reason);
  assert.equal(imported.registry.headFingerprint, registry.headFingerprint);
});

test("V28 rejects a trust registry with a forged head", async () => {
  const keys = await generatePolicyEvidenceKeyPair();
  const registry = await trustedRegistry(keys);
  const forged = { ...registry, headFingerprint: "T28-forged" };
  const result = await verifyTrustRegistry(forged);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRUST_HEAD_MISMATCH");
});
