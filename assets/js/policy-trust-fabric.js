import {
  buildTrustedSignerFingerprint,
  verifyTrustedPolicyEvidence,
  verifyTrustRegistry
} from "./policy-trust-registry.js";

export const TRUST_FABRIC_VERSION = "30.0";
export const TRUST_FABRIC_SCHEMA = "revops-policy-trust-fabric";
export const TRUST_FABRIC_ALGORITHM = "ECDSA-P256-SHA256";
export const TRUST_FABRIC_MIN_ROOTS = 2;
export const TRUST_FABRIC_MAX_ROOTS = 7;

const encoder = new TextEncoder();

const getCrypto = () => {
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.subtle) throw new Error("WEBCRYPTO_UNAVAILABLE");
  return cryptoObject;
};

const bytesToBase64Url = (bytes) => {
  let binary = "";
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let index = 0; index < source.length; index += 1) {
    binary += String.fromCharCode(source[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlToBytes = (value = "") => {
  const normalised = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const sha256 = async (value, prefix) => {
  const digest = await getCrypto().subtle.digest(
    "SHA-256",
    encoder.encode(String(value))
  );
  return prefix + bytesToBase64Url(new Uint8Array(digest));
};

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

const canonicalRoots = (roots = []) =>
  Array.isArray(roots)
    ? roots
        .map((root) => ({
          rootFingerprint: root?.rootFingerprint || null,
          publicKeyJwk: canonicalPublicJwk(root?.publicKeyJwk)
        }))
        .sort((a, b) => String(a.rootFingerprint).localeCompare(String(b.rootFingerprint)))
    : [];

const canonicalFabric = (fabric = null) => {
  if (!fabric || typeof fabric !== "object") return null;
  return {
    schema: fabric.schema || null,
    fabricVersion: fabric.fabricVersion || null,
    algorithm: fabric.algorithm || null,
    threshold: Number.isInteger(fabric.threshold) ? fabric.threshold : null,
    roots: canonicalRoots(fabric.roots),
    fabricFingerprint: fabric.fabricFingerprint || null
  };
};

const canonicalSigningEnvelope = ({
  fabric,
  registry,
  actor = null,
  rationale = null,
  signedAt = null
} = {}) => ({
  schema: TRUST_FABRIC_SCHEMA,
  fabricVersion: TRUST_FABRIC_VERSION,
  algorithm: TRUST_FABRIC_ALGORITHM,
  fabric: canonicalFabric(fabric),
  registrySchema: registry?.schema || null,
  registryVersion: registry?.registryVersion || null,
  registryHeadFingerprint: registry?.headFingerprint || null,
  registry,
  actor: actor || null,
  rationale: rationale || null,
  signedAt: signedAt || null
});

const safeClone = (value) => JSON.parse(JSON.stringify(value));

async function deriveRootFingerprint(jwk) {
  const canonical = canonicalPublicJwk(jwk);
  if (!canonical) return null;
  return sha256(JSON.stringify(canonical), "RF30-");
}

async function deriveFabricFingerprint(fabric) {
  const canonical = canonicalFabric(fabric);
  if (!canonical) return null;
  const withoutFingerprint = { ...canonical, fabricFingerprint: null };
  return sha256(JSON.stringify(withoutFingerprint), "FT30-");
}

async function verifyPublicKeyPair(privateKey, publicKeyJwk) {
  if (!privateKey || !publicKeyJwk?.x) return false;
  const probe = encoder.encode("REVOPS_STUDIO_V30_KEY_PROBE");
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

export async function generateTrustFabricKeySet(count = 3) {
  const safeCount = Math.max(
    TRUST_FABRIC_MIN_ROOTS,
    Math.min(TRUST_FABRIC_MAX_ROOTS, Number(count) || 3)
  );
  const keys = [];
  for (let index = 0; index < safeCount; index += 1) {
    const generated = await getCrypto().subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );
    const publicKeyJwk = await getCrypto().subtle.exportKey("jwk", generated.publicKey);
    const privateKeyJwk = await getCrypto().subtle.exportKey("jwk", generated.privateKey);
    const rootFingerprint = await deriveRootFingerprint(publicKeyJwk);
    keys.push(Object.freeze({
      index: index + 1,
      privateKey: generated.privateKey,
      publicKey: generated.publicKey,
      publicKeyJwk: canonicalPublicJwk(publicKeyJwk),
      privateKeyJwk,
      rootFingerprint
    }));
  }
  return Object.freeze(keys);
}

export async function createTrustFabric({
  rootPublicKeys = [],
  threshold = 2
} = {}) {
  if (!Array.isArray(rootPublicKeys)) {
    return { valid: false, reason: "TRUST_FABRIC_ROOTS_INVALID" };
  }
  if (rootPublicKeys.length < TRUST_FABRIC_MIN_ROOTS ||
      rootPublicKeys.length > TRUST_FABRIC_MAX_ROOTS) {
    return { valid: false, reason: "TRUST_FABRIC_ROOT_COUNT_INVALID" };
  }
  if (!Number.isInteger(threshold) || threshold < TRUST_FABRIC_MIN_ROOTS ||
      threshold > rootPublicKeys.length) {
    return { valid: false, reason: "TRUST_FABRIC_THRESHOLD_INVALID" };
  }

  const roots = [];
  for (const publicKeyJwk of rootPublicKeys) {
    const canonical = canonicalPublicJwk(publicKeyJwk);
    if (!canonical) return { valid: false, reason: "TRUST_FABRIC_PUBLIC_KEY_INVALID" };
    const rootFingerprint = await deriveRootFingerprint(canonical);
    if (!rootFingerprint) return { valid: false, reason: "TRUST_FABRIC_ROOT_FINGERPRINT_INVALID" };
    if (roots.some((root) => root.rootFingerprint === rootFingerprint)) {
      return { valid: false, reason: "TRUST_FABRIC_DUPLICATE_ROOT" };
    }
    roots.push({ rootFingerprint, publicKeyJwk: canonical });
  }

  const base = {
    schema: TRUST_FABRIC_SCHEMA,
    fabricVersion: TRUST_FABRIC_VERSION,
    algorithm: TRUST_FABRIC_ALGORITHM,
    threshold,
    roots: canonicalRoots(roots),
    fabricFingerprint: null
  };
  const fabricFingerprint = await deriveFabricFingerprint(base);
  return Object.freeze({
    ...base,
    valid: true,
    reason: "TRUST_FABRIC_CREATED",
    fabricFingerprint
  });
}

export async function buildTrustFabricPayload({
  fabric = null,
  registry = null,
  actor = null,
  rationale = null,
  signedAt = null
} = {}) {
  const registryVerification = await verifyTrustRegistry(registry);
  if (!registryVerification.valid) {
    return {
      valid: false,
      reason: "TRUST_REGISTRY_INVALID",
      registry: registryVerification
    };
  }

  const canonical = canonicalFabric(fabric);
  if (!canonical) return { valid: false, reason: "TRUST_FABRIC_INVALID" };
  if (canonical.schema !== TRUST_FABRIC_SCHEMA) {
    return { valid: false, reason: "TRUST_FABRIC_SCHEMA_MISMATCH" };
  }
  if (canonical.fabricVersion !== TRUST_FABRIC_VERSION) {
    return { valid: false, reason: "TRUST_FABRIC_VERSION_MISMATCH" };
  }
  if (canonical.algorithm !== TRUST_FABRIC_ALGORITHM) {
    return { valid: false, reason: "TRUST_FABRIC_ALGORITHM_MISMATCH" };
  }

  const expectedFabricFingerprint = await deriveFabricFingerprint(canonical);
  if (expectedFabricFingerprint !== canonical.fabricFingerprint) {
    return { valid: false, reason: "TRUST_FABRIC_FINGERPRINT_MISMATCH" };
  }

  const payload = JSON.stringify(canonicalSigningEnvelope({
    fabric: canonical,
    registry,
    actor,
    rationale,
    signedAt: signedAt || null
  }));
  return Object.freeze({
    valid: true,
    reason: "TRUST_FABRIC_PAYLOAD_READY",
    payload,
    payloadFingerprint: await sha256(payload, "FP30-"),
    registryHeadFingerprint: registryVerification.headFingerprint,
    fabricFingerprint: canonical.fabricFingerprint
  });
}

export async function signTrustFabricCheckpoint(
  registry = null,
  {
    fabric = null,
    rootSigners = [],
    actor = null,
    rationale = null,
    signedAt = new Date().toISOString()
  } = {}
) {
  if (!Array.isArray(rootSigners)) return { valid: false, reason: "TRUST_FABRIC_SIGNERS_INVALID" };
  if (rootSigners.length < TRUST_FABRIC_MIN_ROOTS) {
    return { valid: false, reason: "TRUST_FABRIC_SIGNERS_INSUFFICIENT" };
  }
  if (!String(actor || "").trim()) return { valid: false, reason: "TRUST_FABRIC_ACTOR_REQUIRED" };
  if (!String(rationale || "").trim()) return { valid: false, reason: "TRUST_FABRIC_RATIONALE_REQUIRED" };

  const canonical = canonicalFabric(fabric);
  if (!canonical) return { valid: false, reason: "TRUST_FABRIC_REQUIRED" };

  const signerMap = new Map();
  for (const signer of rootSigners) {
    if (!(await verifyPublicKeyPair(signer?.privateKey, signer?.publicKeyJwk))) {
      return { valid: false, reason: "TRUST_FABRIC_KEY_PAIR_INVALID" };
    }
    const rootFingerprint = await deriveRootFingerprint(signer.publicKeyJwk);
    const pinned = canonical.roots.find((root) => root.rootFingerprint === rootFingerprint);
    if (!pinned) return { valid: false, reason: "TRUST_FABRIC_SIGNER_NOT_PINNED" };
    if (signerMap.has(rootFingerprint)) {
      return { valid: false, reason: "TRUST_FABRIC_DUPLICATE_SIGNER" };
    }
    signerMap.set(rootFingerprint, signer);
  }

  if (signerMap.size < canonical.threshold) {
    return { valid: false, reason: "TRUST_FABRIC_QUORUM_INSUFFICIENT" };
  }

  const payloadResult = await buildTrustFabricPayload({
    fabric: canonical,
    registry,
    actor: String(actor).trim().slice(0, 80),
    rationale: String(rationale).trim().slice(0, 500),
    signedAt
  });
  if (!payloadResult.valid) return payloadResult;

  const signatures = [];
  for (const rootFingerprint of canonical.roots.map((root) => root.rootFingerprint)) {
    const signer = signerMap.get(rootFingerprint);
    if (!signer) continue;
    const signature = await getCrypto().subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      signer.privateKey,
      encoder.encode(payloadResult.payload)
    );
    signatures.push({
      rootFingerprint,
      signature: bytesToBase64Url(new Uint8Array(signature))
    });
  }

  const snapshot = {
    schema: TRUST_FABRIC_SCHEMA,
    fabricVersion: TRUST_FABRIC_VERSION,
    algorithm: TRUST_FABRIC_ALGORITHM,
    fabric: safeClone(canonical),
    registry: safeClone(registry),
    actor: String(actor).trim().slice(0, 80),
    rationale: String(rationale).trim().slice(0, 500),
    signedAt: new Date(signedAt).toISOString(),
    payloadFingerprint: payloadResult.payloadFingerprint,
    registryHeadFingerprint: payloadResult.registryHeadFingerprint,
    signatures,
    checkpointFingerprint: await sha256(
      JSON.stringify({
        fabricFingerprint: canonical.fabricFingerprint,
        registryHeadFingerprint: payloadResult.registryHeadFingerprint,
        payloadFingerprint: payloadResult.payloadFingerprint,
        signatures: signatures.map((item) => ({
          rootFingerprint: item.rootFingerprint,
          signature: item.signature
        }))
      }),
      "CP30-"
    )
  };

  return Object.freeze({
    valid: true,
    reason: "TRUST_FABRIC_CHECKPOINT_SIGNED",
    snapshot: Object.freeze(snapshot)
  });
}

export async function verifyTrustFabricCheckpoint(
  snapshot = null,
  {
    expectedRootFingerprints = null,
    expectedThreshold = null,
    verificationAt = null
  } = {}
) {
  if (!snapshot || typeof snapshot !== "object") return { valid: false, reason: "TRUST_FABRIC_SNAPSHOT_INVALID" };
  if (snapshot.schema !== TRUST_FABRIC_SCHEMA) return { valid: false, reason: "TRUST_FABRIC_SCHEMA_MISMATCH" };
  if (snapshot.fabricVersion !== TRUST_FABRIC_VERSION) return { valid: false, reason: "TRUST_FABRIC_VERSION_MISMATCH" };
  if (snapshot.algorithm !== TRUST_FABRIC_ALGORITHM) return { valid: false, reason: "TRUST_FABRIC_ALGORITHM_MISMATCH" };

  const fabric = canonicalFabric(snapshot.fabric);
  if (!fabric) return { valid: false, reason: "TRUST_FABRIC_INVALID" };

  const expectedFabricFingerprint = await deriveFabricFingerprint(fabric);
  if (expectedFabricFingerprint !== fabric.fabricFingerprint) {
    return { valid: false, reason: "TRUST_FABRIC_FINGERPRINT_MISMATCH" };
  }

  const configuredRoots = fabric.roots.map((root) => root.rootFingerprint);
  if (new Set(configuredRoots).size !== configuredRoots.length) {
    return { valid: false, reason: "TRUST_FABRIC_DUPLICATE_ROOT" };
  }

  if (expectedThreshold !== null && Number(expectedThreshold) !== fabric.threshold) {
    return { valid: false, reason: "TRUST_FABRIC_THRESHOLD_PIN_MISMATCH" };
  }

  if (expectedRootFingerprints) {
    const expected = [...new Set(
      (Array.isArray(expectedRootFingerprints)
        ? expectedRootFingerprints
        : String(expectedRootFingerprints).split(/[,\s]+/))
        .map((value) => String(value).trim())
        .filter(Boolean)
    )].sort();
    const actual = [...configuredRoots].sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      return { valid: false, reason: "TRUST_FABRIC_ROOT_PIN_MISMATCH" };
    }
  }

  const payloadResult = await buildTrustFabricPayload({
    fabric,
    registry: snapshot.registry,
    actor: snapshot.actor,
    rationale: snapshot.rationale,
    signedAt: snapshot.signedAt
  });
  if (!payloadResult.valid) return payloadResult;

  if (payloadResult.payloadFingerprint !== snapshot.payloadFingerprint) {
    return { valid: false, reason: "TRUST_FABRIC_PAYLOAD_FINGERPRINT_MISMATCH" };
  }
  if (payloadResult.registryHeadFingerprint !== snapshot.registryHeadFingerprint) {
    return { valid: false, reason: "TRUST_FABRIC_REGISTRY_HEAD_MISMATCH" };
  }

  if (!Array.isArray(snapshot.signatures)) {
    return { valid: false, reason: "TRUST_FABRIC_SIGNATURES_INVALID" };
  }

  const seen = new Set();
  const verifiedRoots = [];
  for (const entry of snapshot.signatures) {
    const rootFingerprint = String(entry?.rootFingerprint || "");
    if (!rootFingerprint || seen.has(rootFingerprint)) {
      return { valid: false, reason: "TRUST_FABRIC_DUPLICATE_SIGNATURE" };
    }
    seen.add(rootFingerprint);

    const root = fabric.roots.find((item) => item.rootFingerprint === rootFingerprint);
    if (!root) return { valid: false, reason: "TRUST_FABRIC_UNPINNED_SIGNATURE" };

    let signatureBytes;
    try {
      signatureBytes = base64UrlToBytes(entry.signature);
    } catch {
      return { valid: false, reason: "TRUST_FABRIC_SIGNATURE_ENCODING_INVALID" };
    }

    let publicKey;
    try {
      publicKey = await getCrypto().subtle.importKey(
        "jwk",
        root.publicKeyJwk,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"]
      );
    } catch {
      return { valid: false, reason: "TRUST_FABRIC_PUBLIC_KEY_IMPORT_FAILED" };
    }

    const validSignature = await getCrypto().subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      signatureBytes,
      encoder.encode(payloadResult.payload)
    );
    if (!validSignature) return { valid: false, reason: "TRUST_FABRIC_SIGNATURE_INVALID", rootFingerprint };

    verifiedRoots.push(rootFingerprint);
  }

  if (verifiedRoots.length < fabric.threshold) {
    return {
      valid: false,
      reason: "TRUST_FABRIC_QUORUM_NOT_REACHED",
      verifiedRoots,
      threshold: fabric.threshold
    };
  }

  const checkpointFingerprint = await sha256(
    JSON.stringify({
      fabricFingerprint: fabric.fabricFingerprint,
      registryHeadFingerprint: payloadResult.registryHeadFingerprint,
      payloadFingerprint: payloadResult.payloadFingerprint,
      signatures: snapshot.signatures.map((item) => ({
        rootFingerprint: item.rootFingerprint,
        signature: item.signature
      }))
    }),
    "CP30-"
  );

  if (checkpointFingerprint !== snapshot.checkpointFingerprint) {
    return { valid: false, reason: "TRUST_FABRIC_CHECKPOINT_FINGERPRINT_MISMATCH" };
  }

  return {
    valid: true,
    reason: "TRUST_FABRIC_QUORUM_VERIFIED",
    fabricFingerprint: fabric.fabricFingerprint,
    registryHeadFingerprint: payloadResult.registryHeadFingerprint,
    payloadFingerprint: payloadResult.payloadFingerprint,
    threshold: fabric.threshold,
    totalRoots: configuredRoots.length,
    verifiedRoots,
    quorum: verifiedRoots.length,
    verificationAt: verificationAt || null,
    registry: snapshot.registry
  };
}

export async function verifyTrustFabricCheckpointSet(
  snapshots = [],
  options = {}
) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return { valid: false, reason: "TRUST_FABRIC_CHECKPOINT_SET_EMPTY" };
  }

  const results = [];
  for (const snapshot of snapshots) {
    const result = await verifyTrustFabricCheckpoint(snapshot, options);
    if (!result.valid) {
      return { valid: false, reason: "TRUST_FABRIC_CHECKPOINT_INVALID", failed: result };
    }
    results.push(result);
  }

  const heads = [...new Set(results.map((result) => result.registryHeadFingerprint))];
  if (heads.length > 1) {
    return {
      valid: false,
      reason: "TRUST_FABRIC_FORK_DETECTED",
      registryHeads: heads
    };
  }

  const signerByHead = new Map();
  for (let index = 0; index < results.length; index += 1) {
    const head = results[index].registryHeadFingerprint;
    for (const rootFingerprint of results[index].verifiedRoots) {
      if (!signerByHead.has(rootFingerprint)) signerByHead.set(rootFingerprint, new Set());
      signerByHead.get(rootFingerprint).add(head);
    }
  }

  const doubleSigners = [...signerByHead.entries()]
    .filter(([, signedHeads]) => signedHeads.size > 1)
    .map(([rootFingerprint]) => rootFingerprint);

  if (doubleSigners.length) {
    return {
      valid: false,
      reason: "TRUST_FABRIC_DOUBLE_SIGN_DETECTED",
      doubleSigners
    };
  }

  return {
    valid: true,
    reason: "TRUST_FABRIC_CHECKPOINT_SET_VERIFIED",
    registryHeadFingerprint: heads[0],
    checkpoints: results.length,
    threshold: results[0].threshold,
    verifiedRoots: results[0].verifiedRoots,
    quorum: results[0].quorum
  };
}

export async function verifyTrustedPolicyEvidenceViaFabric(
  signedEvidence = null,
  {
    checkpoint = null,
    expectedRootFingerprints = null,
    expectedThreshold = null,
    at = null,
    rows = null,
    expectedKeyFingerprint = null,
    verificationAt = null
  } = {}
) {
  const checkpointResult = await verifyTrustFabricCheckpoint(checkpoint, {
    expectedRootFingerprints,
    expectedThreshold,
    verificationAt
  });

  if (!checkpointResult.valid) {
    return {
      valid: false,
      reason: "TRUST_FABRIC_INVALID",
      fabric: checkpointResult
    };
  }

  const trustResult = await verifyTrustedPolicyEvidence(signedEvidence, {
    registry: checkpointResult.registry,
    at,
    rows,
    expectedKeyFingerprint,
    verificationAt
  });

  if (!trustResult.valid) {
    return {
      valid: false,
      reason: trustResult.reason,
      fabric: checkpointResult,
      trust: trustResult
    };
  }

  return {
    valid: true,
    reason: "QUORUM_ANCHORED_" + trustResult.reason,
    fabricFingerprint: checkpointResult.fabricFingerprint,
    registryHeadFingerprint: checkpointResult.registryHeadFingerprint,
    quorum: checkpointResult.quorum,
    threshold: checkpointResult.threshold,
    verifiedRoots: checkpointResult.verifiedRoots,
    signerKeyFingerprint: trustResult.keyFingerprint,
    signerStateAtSigning: trustResult.signerStateAtSigning,
    signerStateNow: trustResult.signerStateNow,
    fabric: checkpointResult,
    trust: trustResult
  };
}

export async function buildTrustFabricVerificationReceipt(
  verification = null,
  {
    issuedAt = new Date().toISOString()
  } = {}
) {
  if (!verification?.valid) {
    return { valid: false, reason: "TRUST_FABRIC_VERIFICATION_REQUIRED" };
  }
  const receipt = {
    schema: "revops-policy-trust-receipt",
    receiptVersion: TRUST_FABRIC_VERSION,
    issuedAt: new Date(issuedAt).toISOString(),
    fabricFingerprint: verification.fabricFingerprint || null,
    registryHeadFingerprint: verification.registryHeadFingerprint || null,
    threshold: verification.threshold ?? null,
    quorum: verification.quorum ?? null,
    verifiedRoots: Array.isArray(verification.verifiedRoots)
      ? [...verification.verifiedRoots].sort()
      : [],
    signerKeyFingerprint: verification.signerKeyFingerprint || null,
    signerStateAtSigning: verification.signerStateAtSigning || null,
    signerStateNow: verification.signerStateNow || null,
    reason: verification.reason || null
  };
  return Object.freeze({
    valid: true,
    reason: "TRUST_FABRIC_RECEIPT_READY",
    fingerprint: await sha256(JSON.stringify(receipt), "QR30-"),
    receipt: Object.freeze(receipt)
  });
}

export async function exportTrustFabricCheckpoint(snapshot = null) {
  const verification = await verifyTrustFabricCheckpoint(snapshot);
  if (!verification.valid) return { valid: false, reason: verification.reason };
  return {
    valid: true,
    reason: "TRUST_FABRIC_EXPORT_READY",
    json: JSON.stringify(snapshot, null, 2),
    checkpointFingerprint: snapshot.checkpointFingerprint,
    fabricFingerprint: verification.fabricFingerprint
  };
}

export async function importTrustFabricCheckpoint(raw = null) {
  try {
    const snapshot = typeof raw === "string" ? JSON.parse(raw) : raw;
    const verification = await verifyTrustFabricCheckpoint(snapshot);
    return verification.valid
      ? {
          valid: true,
          reason: "TRUST_FABRIC_IMPORTED",
          snapshot: Object.freeze(safeClone(snapshot)),
          verification
        }
      : { valid: false, reason: verification.reason };
  } catch {
    return { valid: false, reason: "TRUST_FABRIC_PARSE_ERROR" };
  }
}
