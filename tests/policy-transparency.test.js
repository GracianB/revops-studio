import test from "node:test";
import assert from "node:assert/strict";
import {
  TRANSPARENCY_VERSION,
  TRANSPARENCY_SCHEMA,
  TRANSPARENCY_ALGORITHM,
  createTransparencyLog,
  buildTransparencyEntry,
  appendTransparencyCheckpoint,
  generateTransparencyWitnessKeyPair,
  buildTransparencyWitnessPayload,
  signTransparencyWitnessAttestation,
  verifyTransparencyWitnessAttestation,
  verifyTransparencyLog,
  verifyTransparencyLogSet,
  verifyTransparencyWitnessSet,
  buildTransparencyReceipt,
  exportTransparencyLog,
  importTransparencyLog
} from "../assets/js/policy-transparency.js";
import { generateTrustFabricKeySet, createTrustFabric, signTrustFabricCheckpoint } from "../assets/js/policy-trust-fabric.js";
import { createTrustRegistry, registerTrustedSigner } from "../assets/js/policy-trust-registry.js";

const now = "2026-10-05T00:00:00.000Z";

async function checkpointFixture() {
  const signer = await generateTrustFabricKeySet(3);
  const fabric = await createTrustFabric({
    rootPublicKeys: signer.map((key) => key.publicKeyJwk),
    threshold: 2
  });
  assert.equal(fabric.valid, true, fabric.reason);

  const registrySigner = await import("../assets/js/policy-evidence-signing.js").then(({ generatePolicyEvidenceKeyPair }) => generatePolicyEvidenceKeyPair());
  const registered = await registerTrustedSigner(createTrustRegistry(), {
    publicKeyJwk: registrySigner.publicKeyJwk,
    effectiveAt: now,
    actor: "security-owner",
    rationale: "V31 transparency fixture",
    createdAt: now
  });
  assert.equal(registered.accepted, true, registered.reason);

  const signed = await signTrustFabricCheckpoint(registered.registry, {
    fabric,
    rootSigners: signer,
    actor: "security-owner",
    rationale: "V31 transparency checkpoint",
    signedAt: now
  });
  assert.equal(signed.valid, true, signed.reason);
  return signed.snapshot;
}

async function logFixture() {
  const checkpointA = await checkpointFixture();
  const checkpointB = await checkpointFixture();
  const first = await appendTransparencyCheckpoint(
    createTransparencyLog(),
    checkpointA,
    { observedAt: now }
  );
  assert.equal(first.valid, true, first.reason);

  const second = await appendTransparencyCheckpoint(
    first.log,
    checkpointB,
    { observedAt: "2026-10-05T00:01:00.000Z" }
  );
  assert.equal(second.valid, true, second.reason);
  return { checkpointA, checkpointB, log: second.log };
}

test("V31 exposes the transparency contract", () => {
  assert.equal(TRANSPARENCY_VERSION, "31.0");
  assert.equal(TRANSPARENCY_SCHEMA, "revops-policy-transparency-log");
  assert.equal(TRANSPARENCY_ALGORITHM, "ECDSA-P256-SHA256");
});

test("V31 creates an empty append-only log", () => {
  const log = createTransparencyLog();
  assert.equal(log.headSequence, 0);
  assert.equal(log.headEntryFingerprint, null);
  assert.deepEqual(log.entries, []);
  assert.deepEqual(log.checkpoints, []);
});

test("V31 builds deterministic entry fingerprints for the same observation", async () => {
  const checkpoint = await checkpointFixture();
  const a = await buildTransparencyEntry({
    sequence: 1,
    checkpoint,
    observedAt: now
  });
  const b = await buildTransparencyEntry({
    sequence: 1,
    checkpoint,
    observedAt: now
  });
  assert.equal(a.valid, true);
  assert.equal(a.entry.eventFingerprint, b.entry.eventFingerprint);
  assert.match(a.entry.eventFingerprint, /^TL31-/);
});

test("V31 appends verified checkpoints and advances the head", async () => {
  const { log } = await logFixture();
  assert.equal(log.entries.length, 2);
  assert.equal(log.headSequence, 2);
  assert.equal(log.headEntryFingerprint, log.entries[1].eventFingerprint);
});

test("V31 rejects a duplicate checkpoint anchor", async () => {
  const checkpoint = await checkpointFixture();
  const first = await appendTransparencyCheckpoint(createTransparencyLog(), checkpoint, { observedAt: now });
  const duplicate = await appendTransparencyCheckpoint(first.log, checkpoint, { observedAt: "2026-10-05T00:01:00.000Z" });
  assert.equal(duplicate.valid, false);
  assert.equal(duplicate.reason, "TRANSPARENCY_DUPLICATE_CHECKPOINT");
});

test("V31 verifies the complete chained log", async () => {
  const { log } = await logFixture();
  const result = await verifyTransparencyLog(log);
  assert.equal(result.valid, true, result.reason);
  assert.equal(result.headSequence, 2);
  assert.equal(result.checkpoints, 2);
});

test("V31 rejects tampering with an entry fingerprint", async () => {
  const { log } = await logFixture();
  const forged = {
    ...log,
    entries: log.entries.map((entry, index) => index === 1 ? { ...entry, observedAt: now } : entry)
  };
  const result = await verifyTransparencyLog(forged);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRANSPARENCY_ENTRY_FINGERPRINT_MISMATCH");
});

test("V31 rejects a broken previous-entry link", async () => {
  const { log } = await logFixture();
  const forged = {
    ...log,
    entries: log.entries.map((entry, index) => index === 1 ? { ...entry, previousEntryFingerprint: "TL31-forged" } : entry)
  };
  const result = await verifyTransparencyLog(forged);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRANSPARENCY_PREVIOUS_FINGERPRINT_MISMATCH");
});

test("V31 rejects a head pin mismatch", async () => {
  const { log } = await logFixture();
  const result = await verifyTransparencyLog(log, { expectedHeadFingerprint: "TH31-external-pin" });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRANSPARENCY_EXTERNAL_HEAD_PIN_MISMATCH");
});

test("V31 detects time regression", async () => {
  const checkpointA = await checkpointFixture();
  const checkpointB = await checkpointFixture();
  const first = await appendTransparencyCheckpoint(createTransparencyLog(), checkpointA, { observedAt: "2026-10-05T01:00:00.000Z" });
  const second = await appendTransparencyCheckpoint(first.log, checkpointB, { observedAt: "2026-10-05T00:59:00.000Z" });
  assert.equal(second.valid, true);
  const result = await verifyTransparencyLog(second.log);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRANSPARENCY_TIME_REGRESSION");
});

test("V31 detects forked observations across two valid logs", async () => {
  const checkpointA = await checkpointFixture();
  const checkpointB = await checkpointFixture();
  const a = await appendTransparencyCheckpoint(createTransparencyLog(), checkpointA, { observedAt: now });
  const b = await appendTransparencyCheckpoint(createTransparencyLog(), checkpointB, { observedAt: now });
  const result = await verifyTransparencyLogSet([a.log, b.log]);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRANSPARENCY_EQUIVOCATION_DETECTED");
  assert.equal(result.conflicts[0].sequence, 1);
});

test("V31 generates a distinct witness identity", async () => {
  const witness = await generateTransparencyWitnessKeyPair();
  assert.match(witness.witnessFingerprint, /^WT31-/);
  assert.equal(witness.publicKeyJwk.kty, "EC");
  assert.equal(witness.publicKeyJwk.crv, "P-256");
});

test("V31 builds a witness payload bound to a log entry", async () => {
  const { log } = await logFixture();
  const result = await buildTransparencyWitnessPayload({
    witnessFingerprint: "WT31-test",
    entryFingerprint: log.entries[1].eventFingerprint,
    sequence: 2,
    checkpointFingerprint: log.entries[1].checkpoint.checkpointFingerprint,
    observedAt: log.entries[1].observedAt
  });
  assert.equal(result.valid, true, result.reason);
  assert.match(result.payloadFingerprint, /^WP31-/);
});

test("V31 signs and verifies a witness attestation", async () => {
  const { log } = await logFixture();
  const witness = await generateTransparencyWitnessKeyPair();
  const signed = await signTransparencyWitnessAttestation(log.entries[1], {
    privateKey: witness.privateKey,
    publicKeyJwk: witness.publicKeyJwk,
    witnessId: witness.witnessFingerprint,
    observedAt: now
  });
  assert.equal(signed.valid, true, signed.reason);
  assert.match(signed.attestation.attestationFingerprint, /^WA31-/);

  const verified = await verifyTransparencyWitnessAttestation(signed.attestation, {
    entry: log.entries[1],
    expectedWitnessFingerprint: witness.witnessFingerprint
  });
  assert.equal(verified.valid, true, verified.reason);
});

test("V31 rejects a forged witness signature", async () => {
  const { log } = await logFixture();
  const witness = await generateTransparencyWitnessKeyPair();
  const signed = await signTransparencyWitnessAttestation(log.entries[1], {
    privateKey: witness.privateKey,
    publicKeyJwk: witness.publicKeyJwk,
    observedAt: now
  });
  const forged = {
    ...signed.attestation,
    signature: (signed.attestation.signature[0] === "A" ? "B" : "A") + signed.attestation.signature.slice(1)
  };
  const verified = await verifyTransparencyWitnessAttestation(forged, { entry: log.entries[1] });
  assert.equal(verified.valid, false);
  assert.equal(verified.reason, "TRANSPARENCY_WITNESS_SIGNATURE_INVALID");
});

test("V31 verifies a witness set", async () => {
  const { log } = await logFixture();
  const witnessA = await generateTransparencyWitnessKeyPair();
  const witnessB = await generateTransparencyWitnessKeyPair();
  const a = await signTransparencyWitnessAttestation(log.entries[1], {
    privateKey: witnessA.privateKey,
    publicKeyJwk: witnessA.publicKeyJwk,
    observedAt: now
  });
  const b = await signTransparencyWitnessAttestation(log.entries[1], {
    privateKey: witnessB.privateKey,
    publicKeyJwk: witnessB.publicKeyJwk,
    observedAt: now
  });
  const result = await verifyTransparencyWitnessSet(
    [a.attestation, b.attestation],
    { entries: log.entries, minWitnesses: 2 }
  );
  assert.equal(result.valid, true, result.reason);
  assert.equal(result.quorum, 2);
});

test("V31 detects witness equivocation for the same sequence", async () => {
  const { log } = await logFixture();
  const witness = await generateTransparencyWitnessKeyPair();
  const conflictEntry = {
    ...log.entries[1],
    sequence: 1,
    eventFingerprint: "TL31-conflicting-entry"
  };
  const a = await signTransparencyWitnessAttestation(log.entries[0], {
    privateKey: witness.privateKey,
    publicKeyJwk: witness.publicKeyJwk,
    observedAt: now
  });
  const b = await signTransparencyWitnessAttestation(conflictEntry, {
    privateKey: witness.privateKey,
    publicKeyJwk: witness.publicKeyJwk,
    observedAt: now
  });
  const result = await verifyTransparencyWitnessSet(
    [a.attestation, b.attestation],
    { entries: [log.entries[0], conflictEntry], minWitnesses: 1 }
  );
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRANSPARENCY_WITNESS_EQUIVOCATION_DETECTED");
});

test("V31 rejects witness-count insufficiency", async () => {
  const { log } = await logFixture();
  const witness = await generateTransparencyWitnessKeyPair();
  const signed = await signTransparencyWitnessAttestation(log.entries[1], {
    privateKey: witness.privateKey,
    publicKeyJwk: witness.publicKeyJwk,
    observedAt: now
  });
  const result = await verifyTransparencyWitnessSet(
    [signed.attestation],
    { entries: log.entries, minWitnesses: 2 }
  );
  assert.equal(result.valid, false);
  assert.equal(result.reason, "TRANSPARENCY_WITNESS_QUORUM_NOT_REACHED");
});

test("V31 builds a portable transparency receipt", async () => {
  const { log } = await logFixture();
  const witness = await generateTransparencyWitnessKeyPair();
  const signed = await signTransparencyWitnessAttestation(log.entries[1], {
    privateKey: witness.privateKey,
    publicKeyJwk: witness.publicKeyJwk,
    observedAt: now
  });
  const verification = await verifyTransparencyLog(log);
  const witnessVerification = await verifyTransparencyWitnessSet(
    [signed.attestation],
    { entries: log.entries }
  );
  const receipt = await buildTransparencyReceipt(verification, witnessVerification, { issuedAt: now });
  assert.equal(receipt.valid, true, receipt.reason);
  assert.match(receipt.fingerprint, /^TR31-/);
  assert.equal(receipt.receipt.headSequence, 2);
  assert.equal(receipt.receipt.witnessQuorum, 1);
});

test("V31 exports and imports only verified logs", async () => {
  const { log } = await logFixture();
  const exported = await exportTransparencyLog(log);
  assert.equal(exported.valid, true, exported.reason);
  const imported = await importTransparencyLog(exported.json);
  assert.equal(imported.valid, true, imported.reason);
  assert.equal(imported.log.headEntryFingerprint, log.headEntryFingerprint);
});

test("V31 fails closed on malformed imported JSON", async () => {
  const imported = await importTransparencyLog("{broken");
  assert.equal(imported.valid, false);
  assert.equal(imported.reason, "TRANSPARENCY_IMPORT_JSON_INVALID");
});
