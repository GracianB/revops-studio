import test from "node:test";
import assert from "node:assert/strict";
import {
  TRUST_FABRIC_VERSION,
  TRUST_FABRIC_SCHEMA,
  TRUST_FABRIC_ALGORITHM,
  generateTrustFabricKeySet,
  createTrustFabric,
  buildTrustFabricPayload,
  signTrustFabricCheckpoint,
  verifyTrustFabricCheckpoint,
  verifyTrustFabricCheckpointSet,
  verifyTrustedPolicyEvidenceViaFabric,
  buildTrustFabricVerificationReceipt,
  exportTrustFabricCheckpoint,
  importTrustFabricCheckpoint
} from "../assets/js/policy-trust-fabric.js";
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

function rows(seed = 0) {
  return Array.from({ length: 10 }, (_, index) => ({
    leadId: "L" + (index + seed),
    probability: 0.9,
    observedSuccess: index < 2 ? 1 : 0
  }));
}

async function evidenceFixture(datasetFingerprint = "ds-v30") {
  const evidenceKeys = await generatePolicyEvidenceKeyPair();
  const observed = rows();
  const proposal = buildRecalibrationProposal({
    report: report(),
    rows: observed,
    datasetFingerprint,
    runId: "run-v30",
    now
  });
  const decision = decidePolicy({
    proposal,
    decision: "APPROVE",
    actor: "gracian-local",
    reason: "V30 quorum test",
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
  const signed = await signPolicyEvidenceBundle(bundle, {
    privateKey: evidenceKeys.privateKey,
    publicKeyJwk: evidenceKeys.publicKeyJwk
  });
  return { observed, signed, publicKeyJwk: evidenceKeys.publicKeyJwk };
}

async function registryFixture(publicKeyJwk = null) {
  const signerKeys = publicKeyJwk ? null : await generatePolicyEvidenceKeyPair();
  const signerPublicKey = publicKeyJwk || signerKeys.publicKeyJwk;
  const registered = await registerTrustedSigner(createTrustRegistry(), {
    publicKeyJwk: signerPublicKey,
    effectiveAt: now,
    actor: "security-owner",
    rationale: "V30 test signer",
    createdAt: now
  });
  assert.equal(registered.accepted, true, registered.reason);
  return {
    signerKeys,
    signerFingerprint: await buildTrustedSignerFingerprint(signerPublicKey),
    registry: registered.registry
  };
}

async function fabricFixture(registry = null) {
  const rootKeys = await generateTrustFabricKeySet(3);
  const fabricResult = await createTrustFabric({
    rootPublicKeys: rootKeys.map((key) => key.publicKeyJwk),
    threshold: 2
  });
  assert.equal(fabricResult.valid, true, fabricResult.reason);
  const signed = await signTrustFabricCheckpoint(registry, {
    fabric: fabricResult,
    rootSigners: rootKeys,
    actor: "security-owner",
    rationale: "V30 quorum checkpoint",
    signedAt: now
  });
  assert.equal(signed.valid, true, signed.reason);
  return { rootKeys, fabric: fabricResult, signed: signed.snapshot };
}

test("V30 exposes a quorum trust-fabric contract", () => {
  assert.equal(TRUST_FABRIC_VERSION, "30.0");
  assert.equal(TRUST_FABRIC_SCHEMA, "revops-policy-trust-fabric");
  assert.equal(TRUST_FABRIC_ALGORITHM, "ECDSA-P256-SHA256");
});

test("V30 generates distinct root identities", async () => {
  const keys = await generateTrustFabricKeySet(3);
  assert.equal(keys.length, 3);
  assert.equal(new Set(keys.map((key) => key.rootFingerprint)).size, 3);
  assert.ok(keys.every((key) => /^RF30-/.test(key.rootFingerprint)));
});

test("V30 builds a deterministic fabric with an explicit threshold", async () => {
  const keys = await generateTrustFabricKeySet(3);
  const a = await createTrustFabric({
    rootPublicKeys: keys.map((key) => key.publicKeyJwk),
    threshold: 2
  });
  const b = await createTrustFabric({
    rootPublicKeys: keys.map((key) => key.publicKeyJwk),
    threshold: 2
  });
  assert.equal(a.valid, true);
  assert.equal(a.fabricFingerprint, b.fabricFingerprint);
  assert.equal(a.threshold, 2);
});

test("V30 rejects duplicate roots and impossible thresholds", async () => {
  const keys = await generateTrustFabricKeySet(2);
  const duplicate = await createTrustFabric({
    rootPublicKeys: [keys[0].publicKeyJwk, keys[0].publicKeyJwk],
    threshold: 2
  });
  assert.equal(duplicate.valid, false);
  assert.equal(duplicate.reason, "TRUST_FABRIC_DUPLICATE_ROOT");

  const impossible = await createTrustFabric({
    rootPublicKeys: [keys[0].publicKeyJwk, keys[1].publicKeyJwk],
    threshold: 3
  });
  assert.equal(impossible.valid, false);
  assert.equal(impossible.reason, "TRUST_FABRIC_THRESHOLD_INVALID");
});

test("V30 signs one checkpoint with multiple roots", async () => {
  const { registry } = await registryFixture();
  const fixture = await fabricFixture(registry);
  assert.equal(fixture.signed.signatures.length, 3);
  assert.equal(fixture.signed.fabric.threshold, 2);
});

test("V30 verifies a valid 2-of-3 quorum", async () => {
  const { registry } = await registryFixture();
  const fixture = await fabricFixture(registry);
  const result = await verifyTrustFabricCheckpoint(fixture.signed, {
    expectedRootFingerprints: fixture.fabric.roots.map((root) => root.rootFingerprint),
    expectedThreshold: 2
  });
  assert.equal(result.valid, true, result.reason);
  assert.equal(result.quorum, 3);
  assert.equal(result.threshold, 2);
});

test("V30 rejects the wrong external root set pin", async () => {
  const { registry } = await registryFixture();
  const fixture = await fabricFixture(registry);
  const other = await generateTrustFabricKeySet(3);
  const result = await verifyTrustFabricCheckpoint(fixture.signed, {
    expectedRootFingerprints: other.map((key) => key.rootFingerprint),
    expectedThreshold: 2
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRUST_FABRIC_ROOT_PIN_MISMATCH");
});

test("V30 rejects the wrong quorum threshold pin", async () => {
  const { registry } = await registryFixture();
  const fixture = await fabricFixture(registry);
  const result = await verifyTrustFabricCheckpoint(fixture.signed, {
    expectedRootFingerprints: fixture.fabric.roots.map((root) => root.rootFingerprint),
    expectedThreshold: 3
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRUST_FABRIC_THRESHOLD_PIN_MISMATCH");
});

test("V30 fails closed below quorum", async () => {
  const { registry } = await registryFixture();
  const fixture = await fabricFixture(registry);
  const forged = {
    ...fixture.signed,
    signatures: fixture.signed.signatures.slice(0, 1)
  };
  const result = await verifyTrustFabricCheckpoint(forged);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRUST_FABRIC_QUORUM_NOT_REACHED");
});

test("V30 rejects a forged root signature", async () => {
  const { registry } = await registryFixture();
  const fixture = await fabricFixture(registry);
  const forged = {
    ...fixture.signed,
    signatures: fixture.signed.signatures.map((entry, index) =>
      index === 0
        ? { ...entry, signature: (entry.signature[0] === "A" ? "B" : "A") + entry.signature.slice(1) }
        : entry
    )
  };
  const result = await verifyTrustFabricCheckpoint(forged);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRUST_FABRIC_SIGNATURE_INVALID");
});

test("V30 rejects a forged registry payload", async () => {
  const { registry } = await registryFixture();
  const fixture = await fabricFixture(registry);
  const forged = {
    ...fixture.signed,
    registry: {
      ...fixture.signed.registry,
      headFingerprint: "T28-forged"
    }
  };
  const result = await verifyTrustFabricCheckpoint(forged);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRUST_REGISTRY_INVALID");
});

test("V30 detects a trust-fabric fork", async () => {
  const { registry } = await registryFixture();
  const rootKeys = await generateTrustFabricKeySet(4);
  const fabricResult = await createTrustFabric({
    rootPublicKeys: rootKeys.map((key) => key.publicKeyJwk),
    threshold: 2
  });
  assert.equal(fabricResult.valid, true, fabricResult.reason);

  const signerA = await signTrustFabricCheckpoint(registry, {
    fabric: fabricResult,
    rootSigners: rootKeys.slice(0, 2),
    actor: "security-owner",
    rationale: "checkpoint A",
    signedAt: now
  });
  assert.equal(signerA.valid, true, signerA.reason);

  const signer2 = await generatePolicyEvidenceKeyPair();
  const second = await registerTrustedSigner(registry, {
    publicKeyJwk: signer2.publicKeyJwk,
    effectiveAt: "2026-10-06T00:00:00.000Z",
    actor: "security-owner",
    rationale: "second registry state",
    createdAt: "2026-10-06T00:00:00.000Z"
  });
  assert.equal(second.accepted, true, second.reason);

  const signerB = await signTrustFabricCheckpoint(second.registry, {
    fabric: fabricResult,
    rootSigners: rootKeys.slice(2, 4),
    actor: "security-owner",
    rationale: "checkpoint B",
    signedAt: "2026-10-06T00:00:00.000Z"
  });
  assert.equal(signerB.valid, true, signerB.reason);

  const result = await verifyTrustFabricCheckpointSet([signerA.snapshot, signerB.snapshot], {
    expectedRootFingerprints: fabricResult.roots.map((root) => root.rootFingerprint),
    expectedThreshold: 2
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRUST_FABRIC_FORK_DETECTED");
});

test("V30 detects root double-signing across divergent checkpoints", async () => {
  const { registry } = await registryFixture();
  const fixture = await fabricFixture(registry);
  const second = { ...fixture.signed, registry: { ...fixture.signed.registry, rationale: "forged fork" } };
  const secondSigned = await signTrustFabricCheckpoint(second.registry, {
    fabric: fixture.fabric,
    rootSigners: fixture.rootKeys,
    actor: "security-owner",
    rationale: "same roots on second checkpoint",
    signedAt: "2026-10-06T00:00:00.000Z"
  });
  assert.equal(secondSigned.valid, true, secondSigned.reason);
  const result = await verifyTrustFabricCheckpointSet([fixture.signed, secondSigned.snapshot], {
    expectedRootFingerprints: fixture.fabric.roots.map((root) => root.rootFingerprint),
    expectedThreshold: 2
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRUST_FABRIC_FORK_DETECTED");
});

test("V30 anchors policy evidence through quorum trust", async () => {
  const evidence = await evidenceFixture("ds-v30-quorum");
  const { registry } = await registryFixture(evidence.publicKeyJwk);
  const fabric = await fabricFixture(registry);
  const result = await verifyTrustedPolicyEvidenceViaFabric(evidence.signed.bundle, {
    checkpoint: fabric.signed,
    expectedRootFingerprints: fabric.fabric.roots.map((root) => root.rootFingerprint),
    expectedThreshold: 2,
    rows: evidence.observed
  });
  assert.equal(result.valid, true, result.reason);
  assert.equal(result.reason, "QUORUM_ANCHORED_TRUSTED_ACTIVE_SIGNATURE");
  assert.equal(result.quorum, 3);
});

test("V30 creates a portable verification receipt", async () => {
  const evidence = await evidenceFixture("ds-v30-receipt");
  const { registry } = await registryFixture(evidence.publicKeyJwk);
  const fabric = await fabricFixture(registry);
  const verification = await verifyTrustedPolicyEvidenceViaFabric(evidence.signed.bundle, {
    checkpoint: fabric.signed,
    expectedRootFingerprints: fabric.fabric.roots.map((root) => root.rootFingerprint),
    expectedThreshold: 2,
    rows: evidence.observed
  });
  const receipt = await buildTrustFabricVerificationReceipt(verification, { issuedAt: now });
  assert.equal(receipt.valid, true, receipt.reason);
  assert.match(receipt.fingerprint, /^QR30-/);
  assert.equal(receipt.receipt.threshold, 2);
});

test("V30 exports and imports only verified checkpoints", async () => {
  const { registry } = await registryFixture();
  const fixture = await fabricFixture(registry);
  const exported = await exportTrustFabricCheckpoint(fixture.signed);
  assert.equal(exported.valid, true, exported.reason);
  const imported = await importTrustFabricCheckpoint(exported.json);
  assert.equal(imported.valid, true, imported.reason);
  assert.equal(imported.snapshot.checkpointFingerprint, fixture.signed.checkpointFingerprint);
});

test("V30 payload binds governance metadata", async () => {
  const { registry } = await registryFixture();
  const fixture = await fabricFixture(registry);
  const a = await buildTrustFabricPayload({
    fabric: fixture.fabric,
    registry,
    actor: "security-owner",
    rationale: "A",
    signedAt: now
  });
  const b = await buildTrustFabricPayload({
    fabric: fixture.fabric,
    registry,
    actor: "security-owner",
    rationale: "B",
    signedAt: now
  });
  assert.equal(a.valid, true);
  assert.equal(b.valid, true);
  assert.notEqual(a.payloadFingerprint, b.payloadFingerprint);
});
