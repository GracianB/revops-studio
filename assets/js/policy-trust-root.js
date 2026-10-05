import {
  TRUST_REGISTRY_SCHEMA,
  TRUST_REGISTRY_VERSION,
  verifyTrustRegistry,
  verifyTrustedPolicyEvidence
} from "./policy-trust-registry.js";

export const TRUST_ROOT_VERSION = "29.0";
export const TRUST_ROOT_SCHEMA = "revops-policy-trust-root-snapshot";
export const TRUST_ROOT_ALGORITHM = "ECDSA-P256-SHA256";

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
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
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
  ) {
    return null;
  }
  return {
    crv: "P-256",
    kty: "EC",
    x: String(jwk.x),
    y: String(jwk.y)
  };
};

const canonicalEvent = (event = null) => {
  if (!event || typeof event !== "object") return null;
  return {
    eventId: event.eventId || null,
    action: event.action || null,
    keyFingerprint: event.keyFingerprint || null,
    publicKeyJwk: canonicalPublicJwk(event.publicKeyJwk),
    previousKeyFingerprint: event.previousKeyFingerprint || null,
    state: event.state || null,
    effectiveAt: event.effectiveAt || null,
    actor: event.actor || null,
    rationale: event.rationale || null,
    createdAt: event.createdAt || null,
    registryVersion: event.registryVersion || null,
    eventFingerprint: event.eventFingerprint || null
  };
};

const canonicalRegistry = (registry = null) => {
  if (
    !registry ||
    typeof registry !== "object" ||
    !Array.isArray(registry.events)
  ) {
    return null;
  }
  return {
    schema: registry.schema || null,
    registryVersion: registry.registryVersion || null,
    headFingerprint: registry.headFingerprint || null,
    events: registry.events.map(canonicalEvent)
  };
};

const canonicalSigningEnvelope = (registry) => ({
  schema: TRUST_ROOT_SCHEMA,
  rootVersion: TRUST_ROOT_VERSION,
  algorithm: TRUST_ROOT_ALGORITHM,
  trustRegistrySchema: TRUST_REGISTRY_SCHEMA,
  trustRegistryVersion: TRUST_REGISTRY_VERSION,
  registry: canonicalRegistry(registry)
});

const validatePublicKey = (jwk) => {
  const canonical = canonicalPublicJwk(jwk);
  if (!canonical) return { valid: false, reason: "ROOT_PUBLIC_KEY_INVALID" };
  return { valid: true, jwk: canonical };
};

export async function buildTrustRootKeyFingerprint(jwk = null) {
  const checked = validatePublicKey(jwk);
  if (!checked.valid) return null;
  return sha256(JSON.stringify(checked.jwk), "RK29-");
}

export async function generateTrustRootKeyPair() {
  const keys = await getCrypto().subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256"
    },
    true,
    ["sign", "verify"]
  );
  const publicKeyJwk = await getCrypto().subtle.exportKey("jwk", keys.publicKey);
  const privateKeyJwk = await getCrypto().subtle.exportKey("jwk", keys.privateKey);
  return Object.freeze({
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    publicKeyJwk: canonicalPublicJwk(publicKeyJwk),
    privateKeyJwk,
    rootKeyFingerprint: await buildTrustRootKeyFingerprint(publicKeyJwk)
  });
}

export async function importTrustRootPrivateKey(jwk = null) {
  const checked = validatePublicKey(jwk);
  if (!checked.valid) throw new Error(checked.reason);
  if (!jwk?.d) throw new Error("ROOT_PRIVATE_KEY_REQUIRED");
  const privateKey = await getCrypto().subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );
  return Object.freeze({
    privateKey,
    publicKeyJwk: checked.jwk,
    rootKeyFingerprint: await buildTrustRootKeyFingerprint(checked.jwk)
  });
}

export async function buildTrustRegistryRootPayload(registry = null) {
  const registryVerification = await verifyTrustRegistry(registry);
  if (!registryVerification.valid) {
    return {
      valid: false,
      reason: registryVerification.reason,
      verification: registryVerification
    };
  }

  const envelope = canonicalSigningEnvelope(registry);
  const payload = JSON.stringify(envelope);
  const fingerprint = await sha256(payload, "RS29-");
  return Object.freeze({
    valid: true,
    reason: "ROOT_PAYLOAD_READY",
    payload,
    fingerprint,
    headFingerprint: registryVerification.headFingerprint
  });
}

export async function signTrustRegistrySnapshot(
  registry = null,
  {
    privateKey,
    publicKeyJwk
  } = {}
) {
  if (!privateKey) return { valid: false, reason: "ROOT_PRIVATE_KEY_REQUIRED" };
  const checked = validatePublicKey(publicKeyJwk);
  if (!checked.valid) return checked;

  const payloadResult = await buildTrustRegistryRootPayload(registry);
  if (!payloadResult.valid) return payloadResult;

  const signatureBytes = await getCrypto().subtle.sign(
    {
      name: "ECDSA",
      hash: "SHA-256"
    },
    privateKey,
    encoder.encode(payloadResult.payload)
  );

  const rootKeyFingerprint = await buildTrustRootKeyFingerprint(checked.jwk);
  const snapshot = {
    schema: TRUST_ROOT_SCHEMA,
    rootVersion: TRUST_ROOT_VERSION,
    algorithm: TRUST_ROOT_ALGORITHM,
    signedAt: new Date().toISOString(),
    rootKeyFingerprint,
    payloadFingerprint: payloadResult.fingerprint,
    trustRegistryVersion: TRUST_REGISTRY_VERSION,
    trustRegistryHeadFingerprint: payloadResult.headFingerprint,
    registry: registry && typeof registry === "object"
      ? JSON.parse(JSON.stringify(registry))
      : null,
    publicKeyJwk: checked.jwk,
    signature: bytesToBase64Url(new Uint8Array(signatureBytes))
  };

  return Object.freeze({
    valid: true,
    reason: "TRUST_ROOT_SNAPSHOT_SIGNED",
    snapshot: Object.freeze(snapshot)
  });
}

export async function verifySignedTrustRegistrySnapshot(
  snapshot = null,
  {
    expectedRootKeyFingerprint = null,
    expectedPublicKeyJwk = null
  } = {}
) {
  if (!snapshot || typeof snapshot !== "object") {
    return { valid: false, reason: "ROOT_SNAPSHOT_INVALID" };
  }
  if (snapshot.schema !== TRUST_ROOT_SCHEMA) {
    return { valid: false, reason: "ROOT_SCHEMA_MISMATCH" };
  }
  if (snapshot.rootVersion !== TRUST_ROOT_VERSION) {
    return { valid: false, reason: "ROOT_VERSION_MISMATCH" };
  }
  if (snapshot.algorithm !== TRUST_ROOT_ALGORITHM) {
    return { valid: false, reason: "ROOT_ALGORITHM_MISMATCH" };
  }

  const checkedKey = validatePublicKey(snapshot.publicKeyJwk);
  if (!checkedKey.valid) return checkedKey;

  const expectedFingerprint = await buildTrustRootKeyFingerprint(checkedKey.jwk);
  if (expectedFingerprint !== snapshot.rootKeyFingerprint) {
    return { valid: false, reason: "ROOT_KEY_FINGERPRINT_MISMATCH" };
  }

  if (expectedRootKeyFingerprint &&
      String(expectedRootKeyFingerprint) !== expectedFingerprint) {
    return { valid: false, reason: "ROOT_KEY_PIN_MISMATCH" };
  }

  if (expectedPublicKeyJwk) {
    const pinnedFingerprint = await buildTrustRootKeyFingerprint(expectedPublicKeyJwk);
    if (!pinnedFingerprint || pinnedFingerprint !== expectedFingerprint) {
      return { valid: false, reason: "ROOT_PUBLIC_KEY_PIN_MISMATCH" };
    }
  }

  if (snapshot.trustRegistryVersion !== TRUST_REGISTRY_VERSION) {
    return { valid: false, reason: "TRUST_REGISTRY_VERSION_MISMATCH" };
  }

  const registryVerification = await verifyTrustRegistry(snapshot.registry);
  if (!registryVerification.valid) {
    return {
      valid: false,
      reason: "TRUST_REGISTRY_INVALID",
      registry: registryVerification
    };
  }

  if (snapshot.trustRegistryHeadFingerprint !== registryVerification.headFingerprint) {
    return { valid: false, reason: "ROOT_REGISTRY_HEAD_MISMATCH" };
  }

  const payloadResult = await buildTrustRegistryRootPayload(snapshot.registry);
  if (!payloadResult.valid) return payloadResult;

  if (payloadResult.fingerprint !== snapshot.payloadFingerprint) {
    return { valid: false, reason: "ROOT_PAYLOAD_FINGERPRINT_MISMATCH" };
  }

  let signatureBytes;
  try {
    signatureBytes = base64UrlToBytes(snapshot.signature);
  } catch {
    return { valid: false, reason: "ROOT_SIGNATURE_ENCODING_INVALID" };
  }

  let publicKey;
  try {
    publicKey = await getCrypto().subtle.importKey(
      "jwk",
      checkedKey.jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
  } catch {
    return { valid: false, reason: "ROOT_PUBLIC_KEY_IMPORT_FAILED" };
  }

  const validSignature = await getCrypto().subtle.verify(
    {
      name: "ECDSA",
      hash: "SHA-256"
    },
    publicKey,
    signatureBytes,
    encoder.encode(payloadResult.payload)
  );

  if (!validSignature) {
    return { valid: false, reason: "ROOT_SIGNATURE_INVALID" };
  }

  return {
    valid: true,
    reason: "TRUST_ROOT_SNAPSHOT_VERIFIED",
    rootKeyFingerprint: expectedFingerprint,
    payloadFingerprint: payloadResult.fingerprint,
    registryHeadFingerprint: registryVerification.headFingerprint,
    registry: snapshot.registry,
    registryVerification
  };
}

export async function verifyTrustedPolicyEvidenceViaRoot(
  signedEvidence = null,
  {
    signedRegistrySnapshot = null,
    expectedRootKeyFingerprint = null,
    expectedPublicKeyJwk = null,
    at = null,
    rows = null,
    expectedKeyFingerprint = null,
    verificationAt = null
  } = {}
) {
  const rootResult = await verifySignedTrustRegistrySnapshot(
    signedRegistrySnapshot,
    {
      expectedRootKeyFingerprint,
      expectedPublicKeyJwk
    }
  );
  if (!rootResult.valid) {
    return {
      valid: false,
      reason: "TRUST_ROOT_INVALID",
      root: rootResult
    };
  }

  const trustResult = await verifyTrustedPolicyEvidence(signedEvidence, {
    registry: rootResult.registry,
    at,
    rows,
    expectedKeyFingerprint,
    verificationAt
  });

  if (!trustResult.valid) {
    return {
      valid: false,
      reason: trustResult.reason,
      root: rootResult,
      trust: trustResult
    };
  }

  return {
    valid: true,
    reason: "ROOT_ANCHORED_" + trustResult.reason,
    rootKeyFingerprint: rootResult.rootKeyFingerprint,
    registryHeadFingerprint: rootResult.registryHeadFingerprint,
    signerKeyFingerprint: trustResult.keyFingerprint,
    signerStateAtSigning: trustResult.signerStateAtSigning,
    signerStateNow: trustResult.signerStateNow,
    root: rootResult,
    trust: trustResult
  };
}

export async function exportSignedTrustRegistrySnapshot(snapshot = null) {
  const verified = await verifySignedTrustRegistrySnapshot(snapshot);
  if (!verified.valid) return { valid: false, reason: verified.reason };
  return {
    valid: true,
    reason: "TRUST_ROOT_EXPORT_READY",
    json: JSON.stringify(snapshot, null, 2),
    rootKeyFingerprint: verified.rootKeyFingerprint,
    registryHeadFingerprint: verified.registryHeadFingerprint
  };
}

export async function importSignedTrustRegistrySnapshot(raw = null) {
  try {
    const snapshot = typeof raw === "string" ? JSON.parse(raw) : raw;
    const verified = await verifySignedTrustRegistrySnapshot(snapshot);
    return verified.valid
      ? {
          valid: true,
          reason: "TRUST_ROOT_IMPORTED",
          snapshot: Object.freeze(JSON.parse(JSON.stringify(snapshot))),
          verification: verified
        }
      : { valid: false, reason: verified.reason };
  } catch {
    return { valid: false, reason: "TRUST_ROOT_PARSE_ERROR" };
  }
}
