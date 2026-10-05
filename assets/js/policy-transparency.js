import {
  verifyTrustFabricCheckpoint
} from "./policy-trust-fabric.js";

export const TRANSPARENCY_VERSION = "31.0";
export const TRANSPARENCY_SCHEMA = "revops-policy-transparency-log";
export const TRANSPARENCY_ALGORITHM = "ECDSA-P256-SHA256";
export const TRANSPARENCY_MIN_WITNESSES = 1;

const encoder = new TextEncoder();

const getCrypto = () => {
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.subtle) throw new Error("WEBCRYPTO_UNAVAILABLE");
  return cryptoObject;
};

const bytesToBase64Url = (bytes) => {
  let binary = "";
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let index = 0; index < source.length; index += 1) binary += String.fromCharCode(source[index]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlToBytes = (value = "") => {
  const normalised = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const sha256 = async (value, prefix) => {
  const digest = await getCrypto().subtle.digest("SHA-256", encoder.encode(String(value)));
  return prefix + bytesToBase64Url(new Uint8Array(digest));
};

const safeClone = (value) => JSON.parse(JSON.stringify(value));

const canonicalPublicJwk = (jwk = null) => {
  if (
    !jwk ||
    typeof jwk !== "object" ||
    jwk.kty !== "EC" ||
    jwk.crv !== "P-256" ||
    !jwk.x ||
    !jwk.y
  ) return null;

  return {
    crv: "P-256",
    kty: "EC",
    x: String(jwk.x),
    y: String(jwk.y)
  };
};

const canonicalCheckpointReference = (checkpoint = null) => {
  if (!checkpoint || typeof checkpoint !== "object") return null;
  return {
    checkpointFingerprint: checkpoint.checkpointFingerprint || null,
    fabricFingerprint: checkpoint.fabric?.fabricFingerprint || null,
    registryHeadFingerprint: checkpoint.registryHeadFingerprint || null,
    payloadFingerprint: checkpoint.payloadFingerprint || null,
    signedAt: checkpoint.signedAt || null
  };
};

const canonicalTransparencyEntry = (entry = null) => {
  if (!entry || typeof entry !== "object") return null;
  return {
    schema: entry.schema || null,
    transparencyVersion: entry.transparencyVersion || null,
    sequence: Number.isInteger(entry.sequence) ? entry.sequence : null,
    previousEntryFingerprint: entry.previousEntryFingerprint || null,
    checkpoint: canonicalCheckpointReference(entry.checkpoint),
    observedAt: entry.observedAt || null,
    eventFingerprint: entry.eventFingerprint || null
  };
};

const canonicalWitnessPayload = (attestation = null) => {
  if (!attestation || typeof attestation !== "object") return null;
  return {
    schema: TRANSPARENCY_SCHEMA,
    transparencyVersion: TRANSPARENCY_VERSION,
    algorithm: TRANSPARENCY_ALGORITHM,
    witnessFingerprint: attestation.witnessFingerprint || null,
    entryFingerprint: attestation.entryFingerprint || null,
    sequence: Number.isInteger(attestation.sequence) ? attestation.sequence : null,
    checkpointFingerprint: attestation.checkpointFingerprint || null,
    observedAt: attestation.observedAt || null
  };
};

async function deriveFingerprint(value, prefix) {
  return sha256(JSON.stringify(value), prefix);
}

async function verifyPublicKeyPair(privateKey, publicKeyJwk) {
  if (!privateKey || !canonicalPublicJwk(publicKeyJwk)) return false;
  const probe = encoder.encode("REVOPS_STUDIO_V31_WITNESS_PROBE");
  const signature = await getCrypto().subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    probe
  );
  const publicKey = await getCrypto().subtle.importKey(
    "jwk",
    canonicalPublicJwk(publicKeyJwk),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
  return getCrypto().subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    signature,
    probe
  );
}

export function createTransparencyLog() {
  return Object.freeze({
    schema: TRANSPARENCY_SCHEMA,
    transparencyVersion: TRANSPARENCY_VERSION,
    algorithm: TRANSPARENCY_ALGORITHM,
    entries: [],
    checkpoints: [],
    headSequence: 0,
    headEntryFingerprint: null
  });
}

export async function buildTransparencyEntry({
  sequence,
  previousEntryFingerprint = null,
  checkpoint = null,
  observedAt = new Date().toISOString()
} = {}) {
  if (!Number.isInteger(sequence) || sequence < 1) {
    return { valid: false, reason: "TRANSPARENCY_SEQUENCE_INVALID" };
  }
  const reference = canonicalCheckpointReference(checkpoint);
  if (!reference?.checkpointFingerprint) {
    return { valid: false, reason: "TRANSPARENCY_CHECKPOINT_REQUIRED" };
  }

  const base = {
    schema: TRANSPARENCY_SCHEMA,
    transparencyVersion: TRANSPARENCY_VERSION,
    sequence,
    previousEntryFingerprint: previousEntryFingerprint || null,
    checkpoint: reference,
    observedAt: new Date(observedAt).toISOString(),
    eventFingerprint: null
  };
  const eventFingerprint = await deriveFingerprint(base, "TL31-");
  return Object.freeze({
    valid: true,
    reason: "TRANSPARENCY_ENTRY_BUILT",
    entry: Object.freeze({ ...base, eventFingerprint })
  });
}

export async function appendTransparencyCheckpoint(
  log = null,
  checkpoint = null,
  { observedAt = new Date().toISOString() } = {}
) {
  if (!log || typeof log !== "object") return { valid: false, reason: "TRANSPARENCY_LOG_INVALID" };
  if (!checkpoint || typeof checkpoint !== "object") return { valid: false, reason: "TRANSPARENCY_CHECKPOINT_REQUIRED" };

  const checkpointVerification = await verifyTrustFabricCheckpoint(checkpoint);
  if (!checkpointVerification.valid) {
    return {
      valid: false,
      reason: "TRANSPARENCY_CHECKPOINT_INVALID",
      checkpoint: checkpointVerification
    };
  }

  const entries = Array.isArray(log.entries) ? log.entries : [];
  const checkpoints = Array.isArray(log.checkpoints) ? log.checkpoints : [];
  if (entries.length !== Number(log.headSequence || 0)) {
    return { valid: false, reason: "TRANSPARENCY_LOG_HEAD_MISMATCH" };
  }
  if (checkpoints.some((item) => item?.checkpointFingerprint === checkpoint.checkpointFingerprint)) {
    return { valid: false, reason: "TRANSPARENCY_DUPLICATE_CHECKPOINT" };
  }

  const entryResult = await buildTransparencyEntry({
    sequence: entries.length + 1,
    previousEntryFingerprint: entries.at(-1)?.eventFingerprint || null,
    checkpoint,
    observedAt
  });
  if (!entryResult.valid) return entryResult;

  const next = {
    ...log,
    schema: TRANSPARENCY_SCHEMA,
    transparencyVersion: TRANSPARENCY_VERSION,
    algorithm: TRANSPARENCY_ALGORITHM,
    entries: [...entries, safeClone(entryResult.entry)],
    checkpoints: [...checkpoints, safeClone(checkpoint)],
    headSequence: entryResult.entry.sequence,
    headEntryFingerprint: entryResult.entry.eventFingerprint
  };

  return Object.freeze({
    valid: true,
    reason: "TRANSPARENCY_CHECKPOINT_APPENDED",
    log: Object.freeze(next),
    entry: entryResult.entry
  });
}

export async function generateTransparencyWitnessKeyPair() {
  const generated = await getCrypto().subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicKeyJwk = await getCrypto().subtle.exportKey("jwk", generated.publicKey);
  const privateKeyJwk = await getCrypto().subtle.exportKey("jwk", generated.privateKey);
  const canonical = canonicalPublicJwk(publicKeyJwk);
  const witnessFingerprint = await deriveFingerprint(canonical, "WT31-");

  return Object.freeze({
    privateKey: generated.privateKey,
    publicKey: generated.publicKey,
    publicKeyJwk: canonical,
    privateKeyJwk,
    witnessFingerprint
  });
}

export async function buildTransparencyWitnessPayload({
  witnessFingerprint,
  entryFingerprint,
  sequence,
  checkpointFingerprint,
  observedAt
} = {}) {
  if (!String(witnessFingerprint || "").trim()) {
    return { valid: false, reason: "TRANSPARENCY_WITNESS_ID_REQUIRED" };
  }
  if (!String(entryFingerprint || "").trim()) {
    return { valid: false, reason: "TRANSPARENCY_ENTRY_REQUIRED" };
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    return { valid: false, reason: "TRANSPARENCY_SEQUENCE_INVALID" };
  }
  const payload = JSON.stringify(canonicalWitnessPayload({
    witnessFingerprint,
    entryFingerprint,
    sequence,
    checkpointFingerprint,
    observedAt
  }));
  return Object.freeze({
    valid: true,
    reason: "TRANSPARENCY_WITNESS_PAYLOAD_READY",
    payload,
    payloadFingerprint: await deriveFingerprint(payload, "WP31-")
  });
}

export async function signTransparencyWitnessAttestation(
  entry = null,
  {
    privateKey = null,
    publicKeyJwk = null,
    witnessId = null,
    observedAt = new Date().toISOString()
  } = {}
) {
  if (!entry?.eventFingerprint) return { valid: false, reason: "TRANSPARENCY_ENTRY_REQUIRED" };
  const canonicalPublic = canonicalPublicJwk(publicKeyJwk);
  if (!canonicalPublic || !(await verifyPublicKeyPair(privateKey, canonicalPublic))) {
    return { valid: false, reason: "TRANSPARENCY_WITNESS_KEY_PAIR_INVALID" };
  }

  const witnessFingerprint = await deriveFingerprint(canonicalPublic, "WT31-");
  if (witnessId && String(witnessId) !== witnessFingerprint) {
    return { valid: false, reason: "TRANSPARENCY_WITNESS_ID_MISMATCH" };
  }

  const payloadResult = await buildTransparencyWitnessPayload({
    witnessFingerprint,
    entryFingerprint: entry.eventFingerprint,
    sequence: entry.sequence,
    checkpointFingerprint: entry.checkpoint?.checkpointFingerprint,
    observedAt
  });
  if (!payloadResult.valid) return payloadResult;

  const signature = await getCrypto().subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    encoder.encode(payloadResult.payload)
  );
  const attestationBase = {
    schema: TRANSPARENCY_SCHEMA,
    transparencyVersion: TRANSPARENCY_VERSION,
    algorithm: TRANSPARENCY_ALGORITHM,
    witnessFingerprint,
    publicKeyJwk: canonicalPublic,
    entryFingerprint: entry.eventFingerprint,
    sequence: entry.sequence,
    checkpointFingerprint: entry.checkpoint?.checkpointFingerprint || null,
    observedAt: new Date(observedAt).toISOString(),
    payloadFingerprint: payloadResult.payloadFingerprint,
    signature: bytesToBase64Url(new Uint8Array(signature)),
    attestationFingerprint: null
  };
  const attestationFingerprint = await deriveFingerprint({
    ...attestationBase,
    attestationFingerprint: null
  }, "WA31-");

  return Object.freeze({
    valid: true,
    reason: "TRANSPARENCY_WITNESS_ATTESTED",
    attestation: Object.freeze({
      ...attestationBase,
      attestationFingerprint
    })
  });
}

export async function verifyTransparencyWitnessAttestation(
  attestation = null,
  { entry = null, expectedWitnessFingerprint = null } = {}
) {
  if (!attestation || typeof attestation !== "object") {
    return { valid: false, reason: "TRANSPARENCY_WITNESS_ATTESTATION_INVALID" };
  }
  if (attestation.schema !== TRANSPARENCY_SCHEMA) return { valid: false, reason: "TRANSPARENCY_WITNESS_SCHEMA_MISMATCH" };
  if (attestation.transparencyVersion !== TRANSPARENCY_VERSION) return { valid: false, reason: "TRANSPARENCY_WITNESS_VERSION_MISMATCH" };
  const canonicalPublic = canonicalPublicJwk(attestation.publicKeyJwk);
  if (!canonicalPublic) return { valid: false, reason: "TRANSPARENCY_WITNESS_PUBLIC_KEY_INVALID" };

  const expectedFingerprint = await deriveFingerprint(canonicalPublic, "WT31-");
  if (expectedFingerprint !== attestation.witnessFingerprint) {
    return { valid: false, reason: "TRANSPARENCY_WITNESS_FINGERPRINT_MISMATCH" };
  }
  if (expectedWitnessFingerprint && String(expectedWitnessFingerprint) !== expectedFingerprint) {
    return { valid: false, reason: "TRANSPARENCY_WITNESS_PIN_MISMATCH" };
  }
  if (entry) {
    if (entry.eventFingerprint !== attestation.entryFingerprint) {
      return { valid: false, reason: "TRANSPARENCY_WITNESS_ENTRY_MISMATCH" };
    }
    if (entry.sequence !== attestation.sequence) {
      return { valid: false, reason: "TRANSPARENCY_WITNESS_SEQUENCE_MISMATCH" };
    }
    if (entry.checkpoint?.checkpointFingerprint !== attestation.checkpointFingerprint) {
      return { valid: false, reason: "TRANSPARENCY_WITNESS_CHECKPOINT_MISMATCH" };
    }
  }

  const payloadResult = await buildTransparencyWitnessPayload({
    witnessFingerprint: attestation.witnessFingerprint,
    entryFingerprint: attestation.entryFingerprint,
    sequence: attestation.sequence,
    checkpointFingerprint: attestation.checkpointFingerprint,
    observedAt: attestation.observedAt
  });
  if (!payloadResult.valid || payloadResult.payloadFingerprint !== attestation.payloadFingerprint) {
    return { valid: false, reason: "TRANSPARENCY_WITNESS_PAYLOAD_FINGERPRINT_MISMATCH" };
  }

  let signatureBytes;
  try {
    signatureBytes = base64UrlToBytes(attestation.signature);
  } catch {
    return { valid: false, reason: "TRANSPARENCY_WITNESS_SIGNATURE_ENCODING_INVALID" };
  }

  let publicKey;
  try {
    publicKey = await getCrypto().subtle.importKey(
      "jwk",
      canonicalPublic,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
  } catch {
    return { valid: false, reason: "TRANSPARENCY_WITNESS_PUBLIC_KEY_IMPORT_FAILED" };
  }

  const validSignature = await getCrypto().subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    signatureBytes,
    encoder.encode(payloadResult.payload)
  );
  if (!validSignature) return { valid: false, reason: "TRANSPARENCY_WITNESS_SIGNATURE_INVALID" };

  const expectedAttestationFingerprint = await deriveFingerprint({
    schema: attestation.schema,
    transparencyVersion: attestation.transparencyVersion,
    algorithm: attestation.algorithm,
    witnessFingerprint: attestation.witnessFingerprint,
    publicKeyJwk: canonicalPublic,
    entryFingerprint: attestation.entryFingerprint,
    sequence: attestation.sequence,
    checkpointFingerprint: attestation.checkpointFingerprint,
    observedAt: attestation.observedAt,
    payloadFingerprint: attestation.payloadFingerprint,
    signature: attestation.signature,
    attestationFingerprint: null
  }, "WA31-");

  if (expectedAttestationFingerprint !== attestation.attestationFingerprint) {
    return { valid: false, reason: "TRANSPARENCY_WITNESS_FINGERPRINT_INVALID" };
  }

  return {
    valid: true,
    reason: "TRANSPARENCY_WITNESS_VERIFIED",
    witnessFingerprint: expectedFingerprint,
    entryFingerprint: attestation.entryFingerprint,
    sequence: attestation.sequence,
    checkpointFingerprint: attestation.checkpointFingerprint
  };
}

export async function verifyTransparencyLog(
  log = null,
  {
    expectedHeadFingerprint = null,
    verifyCheckpoints = true
  } = {}
) {
  if (!log || typeof log !== "object") return { valid: false, reason: "TRANSPARENCY_LOG_INVALID" };
  if (log.schema !== TRANSPARENCY_SCHEMA) return { valid: false, reason: "TRANSPARENCY_SCHEMA_MISMATCH" };
  if (log.transparencyVersion !== TRANSPARENCY_VERSION) return { valid: false, reason: "TRANSPARENCY_VERSION_MISMATCH" };
  if (log.algorithm !== TRANSPARENCY_ALGORITHM) return { valid: false, reason: "TRANSPARENCY_ALGORITHM_MISMATCH" };
  if (!Array.isArray(log.entries)) return { valid: false, reason: "TRANSPARENCY_ENTRIES_INVALID" };
  if (!Array.isArray(log.checkpoints)) return { valid: false, reason: "TRANSPARENCY_CHECKPOINTS_INVALID" };

  const checkpoints = new Map();
  for (const checkpoint of log.checkpoints) {
    const fingerprint = String(checkpoint?.checkpointFingerprint || "");
    if (!fingerprint || checkpoints.has(fingerprint)) {
      return { valid: false, reason: "TRANSPARENCY_CHECKPOINT_DUPLICATE" };
    }
    checkpoints.set(fingerprint, checkpoint);
  }

  const seenSequences = new Map();
  const seenCheckpoints = new Set();
  let previousFingerprint = null;
  let previousObservedAt = null;

  for (let index = 0; index < log.entries.length; index += 1) {
    const entry = log.entries[index];
    const expectedSequence = index + 1;
    if (!Number.isInteger(entry?.sequence) || entry.sequence !== expectedSequence) {
      if (seenSequences.has(entry?.sequence)) {
        const earlier = seenSequences.get(entry.sequence);
        if (earlier !== entry?.checkpoint?.checkpointFingerprint) {
          return {
            valid: false,
            reason: "TRANSPARENCY_EQUIVOCATION_DETECTED",
            sequence: entry.sequence,
            checkpointFingerprints: [earlier, entry?.checkpoint?.checkpointFingerprint]
          };
        }
      }
      return { valid: false, reason: "TRANSPARENCY_SEQUENCE_GAP" };
    }
    seenSequences.set(entry.sequence, entry?.checkpoint?.checkpointFingerprint || null);

    if ((entry.previousEntryFingerprint || null) !== previousFingerprint) {
      return { valid: false, reason: "TRANSPARENCY_PREVIOUS_FINGERPRINT_MISMATCH", sequence: entry.sequence };
    }

    const reference = entry.checkpoint;
    if (!reference?.checkpointFingerprint || !checkpoints.has(reference.checkpointFingerprint)) {
      return { valid: false, reason: "TRANSPARENCY_CHECKPOINT_REFERENCE_MISSING", sequence: entry.sequence };
    }
    if (seenCheckpoints.has(reference.checkpointFingerprint)) {
      return { valid: false, reason: "TRANSPARENCY_DUPLICATE_CHECKPOINT", sequence: entry.sequence };
    }
    seenCheckpoints.add(reference.checkpointFingerprint);

    const expectedEntryFingerprint = await deriveFingerprint({
      schema: entry.schema,
      transparencyVersion: entry.transparencyVersion,
      sequence: entry.sequence,
      previousEntryFingerprint: entry.previousEntryFingerprint || null,
      checkpoint: canonicalCheckpointReference(reference),
      observedAt: new Date(entry.observedAt).toISOString(),
      eventFingerprint: null
    }, "TL31-");

    if (expectedEntryFingerprint !== entry.eventFingerprint) {
      return { valid: false, reason: "TRANSPARENCY_ENTRY_FINGERPRINT_MISMATCH", sequence: entry.sequence };
    }

    const observedAt = new Date(entry.observedAt);
    if (Number.isNaN(observedAt.getTime())) {
      return { valid: false, reason: "TRANSPARENCY_TIMESTAMP_INVALID", sequence: entry.sequence };
    }
    if (previousObservedAt && observedAt.getTime() < previousObservedAt.getTime()) {
      return { valid: false, reason: "TRANSPARENCY_TIME_REGRESSION", sequence: entry.sequence };
    }
    previousObservedAt = observedAt;

    const checkpoint = checkpoints.get(reference.checkpointFingerprint);
    const canonicalCheckpoint = canonicalCheckpointReference(checkpoint);
    if (JSON.stringify(canonicalCheckpoint) !== JSON.stringify(reference)) {
      return { valid: false, reason: "TRANSPARENCY_CHECKPOINT_REFERENCE_MISMATCH", sequence: entry.sequence };
    }

    if (verifyCheckpoints) {
      const checkpointResult = await verifyTrustFabricCheckpoint(checkpoint);
      if (!checkpointResult.valid) {
        return {
          valid: false,
          reason: "TRANSPARENCY_CHECKPOINT_INVALID",
          sequence: entry.sequence,
          checkpoint: checkpointResult
        };
      }
    }

    previousFingerprint = entry.eventFingerprint;
  }

  const expectedHead = log.entries.at(-1)?.eventFingerprint || null;
  if (Number(log.headSequence || 0) !== log.entries.length) {
    return { valid: false, reason: "TRANSPARENCY_HEAD_SEQUENCE_MISMATCH" };
  }
  if ((log.headEntryFingerprint || null) !== expectedHead) {
    return { valid: false, reason: "TRANSPARENCY_HEAD_FINGERPRINT_MISMATCH" };
  }
  if (expectedHeadFingerprint && String(expectedHeadFingerprint) !== String(expectedHead)) {
    return {
      valid: false,
      reason: "TRANSPARENCY_EXTERNAL_HEAD_PIN_MISMATCH",
      expectedHeadFingerprint,
      actualHeadFingerprint: expectedHead
    };
  }

  return {
    valid: true,
    reason: "TRANSPARENCY_LOG_VERIFIED",
    headSequence: log.entries.length,
    headEntryFingerprint: expectedHead,
    checkpoints: log.checkpoints.length,
    latestCheckpointFingerprint: log.entries.at(-1)?.checkpoint?.checkpointFingerprint || null
  };
}

export async function verifyTransparencyLogSet(logs = [], options = {}) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return { valid: false, reason: "TRANSPARENCY_LOG_SET_EMPTY" };
  }

  const results = [];
  for (const log of logs) {
    const result = await verifyTransparencyLog(log, options);
    if (!result.valid) {
      return { valid: false, reason: "TRANSPARENCY_LOG_INVALID", failed: result };
    }
    results.push(result);
  }

  const observationsBySequence = new Map();
  for (const log of logs) {
    for (const entry of log.entries) {
      const values = observationsBySequence.get(entry.sequence) || new Set();
      values.add(entry.checkpoint.checkpointFingerprint);
      observationsBySequence.set(entry.sequence, values);
    }
  }

  const conflicts = [...observationsBySequence.entries()]
    .filter(([, fingerprints]) => fingerprints.size > 1)
    .map(([sequence, fingerprints]) => ({
      sequence,
      checkpointFingerprints: [...fingerprints]
    }));

  if (conflicts.length) {
    return {
      valid: false,
      reason: "TRANSPARENCY_EQUIVOCATION_DETECTED",
      conflicts
    };
  }

  return {
    valid: true,
    reason: "TRANSPARENCY_LOG_SET_VERIFIED",
    logs: logs.length,
    heads: results.map((result) => ({
      sequence: result.headSequence,
      headEntryFingerprint: result.headEntryFingerprint
    }))
  };
}

export async function verifyTransparencyWitnessSet(
  attestations = [],
  {
    entries = [],
    minWitnesses = TRANSPARENCY_MIN_WITNESSES,
    expectedWitnessFingerprints = null
  } = {}
) {
  if (!Array.isArray(attestations)) return { valid: false, reason: "TRANSPARENCY_WITNESS_SET_INVALID" };
  const entryMap = new Map(
    (Array.isArray(entries) ? entries : []).map((entry) => [entry.eventFingerprint, entry])
  );
  const results = [];
  const witnesses = new Set();
  const seenByWitnessAndSequence = new Map();

  for (const attestation of attestations) {
    const entry = entryMap.get(attestation?.entryFingerprint);
    const result = await verifyTransparencyWitnessAttestation(attestation, { entry });
    if (!result.valid) {
      return { valid: false, reason: "TRANSPARENCY_WITNESS_INVALID", failed: result };
    }

    const conflictKey = result.witnessFingerprint + ":" + result.sequence;
    const previous = seenByWitnessAndSequence.get(conflictKey);
    if (previous) {
      if (previous.checkpointFingerprint !== result.checkpointFingerprint) {
        return {
          valid: false,
          reason: "TRANSPARENCY_WITNESS_EQUIVOCATION_DETECTED",
          witnessFingerprint: result.witnessFingerprint,
          sequence: result.sequence,
          checkpointFingerprints: [previous.checkpointFingerprint, result.checkpointFingerprint]
        };
      }
      return { valid: false, reason: "TRANSPARENCY_WITNESS_DUPLICATE" };
    }

    seenByWitnessAndSequence.set(conflictKey, result);
    witnesses.add(result.witnessFingerprint);
    results.push(result);
  }

  if (expectedWitnessFingerprints) {
    const expected = [...new Set(
      (Array.isArray(expectedWitnessFingerprints)
        ? expectedWitnessFingerprints
        : String(expectedWitnessFingerprints).split(/[\s,]+/))
        .map((value) => String(value).trim())
        .filter(Boolean)
    )].sort();
    const actual = [...witnesses].sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      return { valid: false, reason: "TRANSPARENCY_WITNESS_PIN_MISMATCH" };
    }
  }

  if (witnesses.size < Math.max(TRANSPARENCY_MIN_WITNESSES, Number(minWitnesses) || 0)) {
    return {
      valid: false,
      reason: "TRANSPARENCY_WITNESS_QUORUM_NOT_REACHED",
      witnesses: [...witnesses],
      required: Math.max(TRANSPARENCY_MIN_WITNESSES, Number(minWitnesses) || 0)
    };
  }

  const seenByWitnessAndSequence = new Map();
  for (const attestation of attestations) {
    const key = attestation.witnessFingerprint + ":" + attestation.sequence;
    const previous = seenByWitnessAndSequence.get(key);
    if (previous && previous !== attestation.checkpointFingerprint) {
      return {
        valid: false,
        reason: "TRANSPARENCY_WITNESS_EQUIVOCATION_DETECTED",
        witnessFingerprint: attestation.witnessFingerprint,
        sequence: attestation.sequence,
        checkpointFingerprints: [previous, attestation.checkpointFingerprint]
      };
    }
    seenByWitnessAndSequence.set(key, attestation.checkpointFingerprint);
  }

  return {
    valid: true,
    reason: "TRANSPARENCY_WITNESSES_VERIFIED",
    witnesses: [...witnesses],
    quorum: witnesses.size,
    attestations: attestations.length,
    results
  };
}

export async function buildTransparencyReceipt(
  logVerification = null,
  witnessVerification = null,
  { issuedAt = new Date().toISOString() } = {}
) {
  if (!logVerification?.valid) return { valid: false, reason: "TRANSPARENCY_LOG_NOT_VERIFIED" };
  if (witnessVerification && !witnessVerification.valid) {
    return { valid: false, reason: "TRANSPARENCY_WITNESSES_NOT_VERIFIED" };
  }

  const receipt = {
    schema: TRANSPARENCY_SCHEMA,
    transparencyVersion: TRANSPARENCY_VERSION,
    algorithm: TRANSPARENCY_ALGORITHM,
    issuedAt: new Date(issuedAt).toISOString(),
    headSequence: logVerification.headSequence,
    headEntryFingerprint: logVerification.headEntryFingerprint,
    latestCheckpointFingerprint: logVerification.latestCheckpointFingerprint,
    logStatus: logVerification.reason,
    witnessStatus: witnessVerification?.reason || "NO_WITNESS_SUPPLIED",
    witnessFingerprints: witnessVerification?.witnesses || [],
    witnessQuorum: witnessVerification?.quorum || 0,
    receiptFingerprint: null
  };

  const receiptFingerprint = await deriveFingerprint({
    ...receipt,
    receiptFingerprint: null
  }, "TR31-");

  return Object.freeze({
    valid: true,
    reason: "TRANSPARENCY_RECEIPT_BUILT",
    fingerprint: receiptFingerprint,
    receipt: Object.freeze({
      ...receipt,
      receiptFingerprint
    })
  });
}

export async function exportTransparencyLog(log = null) {
  const verification = await verifyTransparencyLog(log);
  if (!verification.valid) return { valid: false, reason: verification.reason };
  return {
    valid: true,
    reason: "TRANSPARENCY_LOG_EXPORTED",
    json: JSON.stringify(log, null, 2),
    headEntryFingerprint: verification.headEntryFingerprint
  };
}

export async function importTransparencyLog(json = "") {
  let parsed;
  try {
    parsed = JSON.parse(String(json));
  } catch {
    return { valid: false, reason: "TRANSPARENCY_IMPORT_JSON_INVALID" };
  }
  const verification = await verifyTransparencyLog(parsed);
  if (!verification.valid) {
    return { valid: false, reason: verification.reason };
  }
  return {
    valid: true,
    reason: "TRANSPARENCY_LOG_IMPORTED",
    log: parsed,
    verification
  };
}

