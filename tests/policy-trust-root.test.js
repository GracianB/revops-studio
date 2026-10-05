import test from "node:test";
import assert from "node:assert/strict";
import {
  TRUST_ROOT_VERSION,
  TRUST_ROOT_SCHEMA,
  TRUST_ROOT_ALGORITHM,
  buildTrustRootKeyFingerprint,
  generateTrustRootKeyPair,
  importTrustRootPrivateKey,
  buildTrustRegistryRootPayload,
  signTrustRegistrySnapshot,
  verifySignedTrustRegistrySnapshot,
  verifyTrustedPolicyEvidenceViaRoot,
  exportSignedTrustRegistrySnapshot,
  importSignedTrustRegistrySnapshot
} from "../assets/js/policy-trust-root.js";
import {
  createTrustRegistry,
  registerTrustedSigner,
  buildTrustedSignerFingerprint
} from "../assets/js/policy-trust-registry.js";
import {
  generatePolicyEvidenceKeyPair,
  signPolicyEvidenceBundle
} from "../assets/js/policy-evidence-signing.js";
import {
  buildRecalibrationProposal,
  decidePolicy
} from "../assets/js/policy-engine.js";
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
  return Array.from({ length: 10 }, (_, index) => ({
    leadId: "L" + index,
    probability: 0.9,
    observedSuccess: index < 2 ? 1 : 0
  }));
}

async function buildFixture() {
  const evidenceKeys = await generatePolicyEvidenceKeyPair();
  const observed = rows();
  const datasetFingerprint = "ds-v29";
  const proposal = buildRecalibrationProposal({
    report: report(),
    rows: observed,
    datasetFingerprint,
    runId: "run-v29",
    now
  });
  const decision = decidePolicy({
    proposal,
    decision: "APPROVE",
    actor: "gracian-local",
    reason: "V29 root anchor test",
    datasetFingerprint,
    rows: observed,
    now
  });
  const evidence = await signPolicyEvidenceBundle(
    buildPolicyEvidenceBundle({
      datasetFingerprint,
      proposal,
      ledger: decision.ledger,
      rows: observed,
      exportedAt: now
    }),
    {
      privateKey: evidenceKeys.privateKey,
      publicKeyJwk: evidenceKeys.publicKeyJwk
    }
  );
  const signerFingerprint = await buildTrustedSignerFingerprint(evidenceKeys.publicKeyJwk);
  const registered = await registerTrustedSigner(createTrustRegistry(), {
    publicKeyJwk: evidenceKeys.publicKeyJwk,
    effectiveAt: now,
    actor: "security-owner",
    rationale: "V29 root anchor fixture",
    createdAt: now
  });
  assert.equal(registered.accepted, true, registered.reason);

  const rootKeys = await generateTrustRootKeyPair();
  const signedRegistry = await signTrustRegistrySnapshot(registered.registry, {
    privateKey: rootKeys.privateKey,
    publicKeyJwk: rootKeys.publicKeyJwk
  });
  assert.equal(signedRegistry.valid, true, signedRegistry.reason);

  return {
    observed,
    evidence,
    evidenceKeys,
    signerFingerprint,
    registry: registered.registry,
    rootKeys,
    signedRegistry: signedRegistry.snapshot
  };
}

test("V29 exposes a dedicated portable trust-root contract", () => {
  assert.equal(TRUST_ROOT_VERSION, "29.0");
  assert.equal(TRUST_ROOT_SCHEMA, "revops-policy-trust-root-snapshot");
  assert.equal(TRUST_ROOT_ALGORITHM, "ECDSA-P256-SHA256");
});

test("V29 creates deterministic RK29 root-key fingerprints", async () => {
  const keys = await generateTrustRootKeyPair();
  const a = await buildTrustRootKeyFingerprint(keys.publicKeyJwk);
  const b = await buildTrustRootKeyFingerprint(keys.publicKeyJwk);
  assert.equal(a, b);
  assert.match(a, /^RK29-/);
});

test("V29 can import a portable root private key without changing identity", async () => {
  const keys = await generateTrustRootKeyPair();
  const imported = await importTrustRootPrivateKey(keys.privateKeyJwk);
  assert.equal(imported.rootKeyFingerprint, keys.rootKeyFingerprint);
});

test("V29 binds the exact V28 registry into a canonical root payload", async () => {
  const fixture = await buildFixture();
  const payload = await buildTrustRegistryRootPayload(fixture.registry);
  assert.equal(payload.valid, true, payload.reason);
  assert.match(payload.fingerprint, /^RS29-/);
  assert.equal(payload.headFingerprint, fixture.registry.headFingerprint);
});

test("V29 signs and verifies a complete trust-registry snapshot", async () => {
  const fixture = await buildFixture();
  const result = await verifySignedTrustRegistrySnapshot(fixture.signedRegistry, {
    expectedRootKeyFingerprint: fixture.rootKeys.rootKeyFingerprint
  });
  assert.equal(result.valid, true, result.reason);
  assert.equal(result.reason, "TRUST_ROOT_SNAPSHOT_VERIFIED");
});

test("V29 rejects a tampered registry even when the root signature is otherwise present", async () => {
  const fixture = await buildFixture();
  const forged = {
    ...fixture.signedRegistry,
    registry: {
      ...fixture.signedRegistry.registry,
      headFingerprint: "T28-forged"
    }
  };
  const result = await verifySignedTrustRegistrySnapshot(forged, {
    expectedRootKeyFingerprint: fixture.rootKeys.rootKeyFingerprint
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRUST_REGISTRY_INVALID");
});

test("V29 rejects a tampered root signature", async () => {
  const fixture = await buildFixture();
  const original = fixture.signedRegistry.signature;
  const first = original[0] === "A" ? "B" : "A";
  const forged = {
    ...fixture.signedRegistry,
    signature: first + original.slice(1)
  };
  const result = await verifySignedTrustRegistrySnapshot(forged);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "ROOT_SIGNATURE_INVALID");
});

test("V29 rejects an unpinned root key when a different root is expected", async () => {
  const fixture = await buildFixture();
  const other = await generateTrustRootKeyPair();
  const result = await verifySignedTrustRegistrySnapshot(fixture.signedRegistry, {
    expectedRootKeyFingerprint: other.rootKeyFingerprint
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "ROOT_KEY_PIN_MISMATCH");
});

test("V29 verifies the complete chain: root -> registry -> signer -> evidence", async () => {
  const fixture = await buildFixture();
  const result = await verifyTrustedPolicyEvidenceViaRoot(
    fixture.evidence.bundle,
    {
      signedRegistrySnapshot: fixture.signedRegistry,
      expectedRootKeyFingerprint: fixture.rootKeys.rootKeyFingerprint,
      rows: fixture.observed
    }
  );
  assert.equal(result.valid, true, result.reason);
  assert.equal(result.reason, "ROOT_ANCHORED_TRUSTED_ACTIVE_SIGNATURE");
  assert.equal(result.rootKeyFingerprint, fixture.rootKeys.rootKeyFingerprint);
  assert.equal(result.signerKeyFingerprint, fixture.signerFingerprint);
});

test("V29 fails closed when the anchored registry is forged after signing", async () => {
  const fixture = await buildFixture();
  const forged = {
    ...fixture.signedRegistry,
    registry: {
      ...fixture.signedRegistry.registry,
      events: fixture.signedRegistry.registry.events.map((event) => ({
        ...event,
        rationale: "forged"
      }))
    }
  };
  const result = await verifyTrustedPolicyEvidenceViaRoot(
    fixture.evidence.bundle,
    {
      signedRegistrySnapshot: forged,
      expectedRootKeyFingerprint: fixture.rootKeys.rootKeyFingerprint,
      rows: fixture.observed
    }
  );
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRUST_ROOT_INVALID");
});

test("V29 exports and re-imports only after root verification", async () => {
  const fixture = await buildFixture();
  const exported = await exportSignedTrustRegistrySnapshot(fixture.signedRegistry);
  assert.equal(exported.valid, true, exported.reason);
  const imported = await importSignedTrustRegistrySnapshot(exported.json);
  assert.equal(imported.valid, true, imported.reason);
  assert.equal(imported.snapshot.rootKeyFingerprint, fixture.rootKeys.rootKeyFingerprint);
  assert.equal(imported.snapshot.trustRegistryHeadFingerprint, fixture.registry.headFingerprint);
});
