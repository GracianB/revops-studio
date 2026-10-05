import { verifyPolicyEvidenceSignature } from "./policy-evidence-signing.js";

export const TRUST_REGISTRY_VERSION = "28.0";
export const TRUST_REGISTRY_SCHEMA = "revops-policy-trust-registry";
export const TRUST_STATES = Object.freeze({
  ACTIVE: "ACTIVE",
  RETIRED: "RETIRED",
  REVOKED: "REVOKED"
});
export const TRUST_ACTIONS = Object.freeze({
  REGISTER: "REGISTER",
  ROTATE: "ROTATE",
  RETIRE: "RETIRE",
  REVOKE: "REVOKE"
});

const encoder = new TextEncoder();

const getCrypto = () => {
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.subtle) throw new Error("WEBCRYPTO_UNAVAILABLE");
  return cryptoObject;
};

const base64Url = (bytes) => {
  let binary = "";
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < source.length; i += 1) binary += String.fromCharCode(source[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const sha256 = async (value, prefix = "T28-") => {
  const digest = await getCrypto().subtle.digest("SHA-256", encoder.encode(String(value)));
  return prefix + base64Url(new Uint8Array(digest));
};

const publicJwk = (jwk = null) => {
  if (!jwk || typeof jwk !== "object" || jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.x || !jwk.y) {
    return null;
  }
  return Object.freeze({
    crv: "P-256",
    kty: "EC",
    x: String(jwk.x),
    y: String(jwk.y)
  });
};

const iso = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const canonicalKey = (jwk) => JSON.stringify(publicJwk(jwk));

export async function buildTrustedSignerFingerprint(jwk = null) {
  const canonical = canonicalKey(jwk);
  if (!canonical || canonical === "null") return null;
  const keyDigest = await sha256(canonical, "K28-");
  return keyDigest;
}

const canonicalEvent = (event = null) => {
  if (!event || typeof event !== "object") return null;
  return {
    eventId: event.eventId || null,
    action: event.action || null,
    keyFingerprint: event.keyFingerprint || null,
    publicKeyJwk: publicJwk(event.publicKeyJwk),
    previousKeyFingerprint: event.previousKeyFingerprint || null,
    state: event.state || null,
    effectiveAt: iso(event.effectiveAt),
    actor: event.actor || null,
    rationale: event.rationale || null,
    createdAt: iso(event.createdAt),
    registryVersion: event.registryVersion || null
  };
};

const canonicalRegistry = (registry = null) => {
  if (!registry || typeof registry !== "object") return null;
  return {
    schema: registry.schema || null,
    registryVersion: registry.registryVersion || null,
    events: Array.isArray(registry.events)
      ? registry.events.map(canonicalEvent)
      : [],
    headFingerprint: registry.headFingerprint || null
  };
};

export function createTrustRegistry() {
  return Object.freeze({
    schema: TRUST_REGISTRY_SCHEMA,
    registryVersion: TRUST_REGISTRY_VERSION,
    events: [],
    headFingerprint: "T28-EMPTY"
  });
}

async function buildEventFingerprint(event) {
  return sha256(JSON.stringify(canonicalEvent(event)));
}

async function appendTrustEvent(
  registry,
  {
    action,
    publicKeyJwk: jwk,
    previousKeyFingerprint = null,
    state,
    effectiveAt,
    actor,
    rationale,
    createdAt = new Date().toISOString()
  } = {}
) {
  const current = registry && typeof registry === "object" ? registry : createTrustRegistry();
  const safeKey = publicJwk(jwk);
  const keyFingerprint = await buildTrustedSignerFingerprint(safeKey);
  const effective = iso(effectiveAt);
  const created = iso(createdAt);
  if (!safeKey || !keyFingerprint) return { accepted: false, reason: "PUBLIC_KEY_REQUIRED" };
  if (!Object.values(TRUST_ACTIONS).includes(action)) return { accepted: false, reason: "TRUST_ACTION_INVALID" };
  if (!Object.values(TRUST_STATES).includes(state)) return { accepted: false, reason: "TRUST_STATE_INVALID" };
  if (!effective || !created) return { accepted: false, reason: "TRUST_TIME_INVALID" };
  if (!String(actor || "").trim()) return { accepted: false, reason: "TRUST_ACTOR_REQUIRED" };
  if (!String(rationale || "").trim()) return { accepted: false, reason: "TRUST_RATIONALE_REQUIRED" };

  const everSeen = current.events.find((event) => event.keyFingerprint === keyFingerprint);
  if (action === TRUST_ACTIONS.REGISTER && everSeen) {
    return { accepted: false, reason: "SIGNER_ALREADY_REGISTERED" };
  }
  if (action === TRUST_ACTIONS.ROTATE && everSeen) {
    return { accepted: false, reason: "ROTATION_TARGET_ALREADY_REGISTERED" };
  }

  const event = {
    eventId: "T28-" + (current.events.length + 1) + "-" + keyFingerprint.slice(-10),
    action,
    keyFingerprint,
    publicKeyJwk: safeKey,
    previousKeyFingerprint: previousKeyFingerprint || null,
    state,
    effectiveAt: effective,
    actor: String(actor).trim().slice(0, 80),
    rationale: String(rationale).trim().slice(0, 500),
    createdAt: created,
    registryVersion: TRUST_REGISTRY_VERSION
  };
  const eventFingerprint = await buildEventFingerprint(event);
  const next = {
    schema: TRUST_REGISTRY_SCHEMA,
    registryVersion: TRUST_REGISTRY_VERSION,
    events: [...(Array.isArray(current.events) ? current.events.map(canonicalEvent) : []), {
      ...event,
      eventFingerprint
    }],
    headFingerprint: eventFingerprint
  };
  return { accepted: true, reason: action + "_ACCEPTED", registry: Object.freeze(next), event: Object.freeze(next.events.at(-1)) };
}

export async function registerTrustedSigner(registry, options = {}) {
  return appendTrustEvent(registry, {
    ...options,
    action: TRUST_ACTIONS.REGISTER,
    state: TRUST_STATES.ACTIVE
  });
}

export async function retireTrustedSigner(registry, { keyFingerprint, effectiveAt, actor, rationale, createdAt } = {}) {
  const signer = resolveTrustedSigner(registry, keyFingerprint, effectiveAt || new Date().toISOString());
  if (!signer) return { accepted: false, reason: "SIGNER_NOT_FOUND" };
  if (signer.state === TRUST_STATES.REVOKED) return { accepted: false, reason: "SIGNER_REVOKED" };
  if (signer.state === TRUST_STATES.RETIRED) return { accepted: false, reason: "SIGNER_ALREADY_RETIRED" };
  return appendTrustEvent(registry, {
    action: TRUST_ACTIONS.RETIRE,
    publicKeyJwk: signer.publicKeyJwk,
    previousKeyFingerprint: signer.keyFingerprint,
    state: TRUST_STATES.RETIRED,
    effectiveAt,
    actor,
    rationale,
    createdAt
  });
}

export async function revokeTrustedSigner(registry, { keyFingerprint, effectiveAt, actor, rationale, createdAt } = {}) {
  const signer = resolveTrustedSigner(registry, keyFingerprint, effectiveAt || new Date().toISOString());
  if (!signer) return { accepted: false, reason: "SIGNER_NOT_FOUND" };
  if (signer.state === TRUST_STATES.REVOKED) return { accepted: false, reason: "SIGNER_ALREADY_REVOKED" };
  return appendTrustEvent(registry, {
    action: TRUST_ACTIONS.REVOKE,
    publicKeyJwk: signer.publicKeyJwk,
    previousKeyFingerprint: signer.keyFingerprint,
    state: TRUST_STATES.REVOKED,
    effectiveAt,
    actor,
    rationale,
    createdAt
  });
}

export async function rotateTrustedSigner(
  registry,
  {
    previousKeyFingerprint,
    newPublicKeyJwk,
    effectiveAt,
    actor,
    rationale,
    createdAt
  } = {}
) {
  const at = effectiveAt || new Date().toISOString();
  const predecessor = resolveTrustedSigner(registry, previousKeyFingerprint, at);
  if (!predecessor) return { accepted: false, reason: "PREDECESSOR_NOT_FOUND" };
  if (predecessor.state !== TRUST_STATES.ACTIVE) {
    return { accepted: false, reason: "PREDECESSOR_NOT_ACTIVE" };
  }
  const newFingerprint = await buildTrustedSignerFingerprint(newPublicKeyJwk);
  if (!newFingerprint) return { accepted: false, reason: "NEW_PUBLIC_KEY_INVALID" };
  if (newFingerprint === previousKeyFingerprint) {
    return { accepted: false, reason: "ROTATION_TARGET_SAME_KEY" };
  }
  if (registry?.events?.some((event) => event.keyFingerprint === newFingerprint)) {
    return { accepted: false, reason: "ROTATION_TARGET_ALREADY_REGISTERED" };
  }

  const retired = await appendTrustEvent(registry, {
    action: TRUST_ACTIONS.RETIRE,
    publicKeyJwk: predecessor.publicKeyJwk,
    previousKeyFingerprint,
    state: TRUST_STATES.RETIRED,
    effectiveAt: at,
    actor,
    rationale,
    createdAt
  });
  if (!retired.accepted) return retired;

  return appendTrustEvent(retired.registry, {
    action: TRUST_ACTIONS.ROTATE,
    publicKeyJwk: newPublicKeyJwk,
    previousKeyFingerprint,
    state: TRUST_STATES.ACTIVE,
    effectiveAt: at,
    actor,
    rationale,
    createdAt
  });
}

export function resolveTrustedSigner(registry = null, keyFingerprint = null, at = new Date().toISOString()) {
  if (!registry || !Array.isArray(registry.events) || !keyFingerprint) return null;
  const point = new Date(at).getTime();
  if (Number.isNaN(point)) return null;
  const events = registry.events
    .filter((event) => event.keyFingerprint === String(keyFingerprint))
    .sort((a, b) => new Date(a.effectiveAt).getTime() - new Date(b.effectiveAt).getTime());
  let state = null;
  let latest = null;
  for (const event of events) {
    const effective = new Date(event.effectiveAt).getTime();
    if (Number.isNaN(effective) || effective > point) continue;
    state = event.state;
    latest = event;
  }
  if (!latest || !state) return null;
  return Object.freeze({
    ...latest,
    state,
    keyFingerprint: latest.keyFingerprint,
    publicKeyJwk: publicJwk(latest.publicKeyJwk)
  });
}

export async function verifyTrustRegistry(registry = null) {
  if (!registry || typeof registry !== "object") return { valid: false, reason: "TRUST_REGISTRY_INVALID" };
  if (registry.schema !== TRUST_REGISTRY_SCHEMA) return { valid: false, reason: "TRUST_SCHEMA_MISMATCH" };
  if (registry.registryVersion !== TRUST_REGISTRY_VERSION) return { valid: false, reason: "TRUST_VERSION_MISMATCH" };
  if (!Array.isArray(registry.events)) return { valid: false, reason: "TRUST_EVENTS_INVALID" };

  const seen = new Set();
  let previousCreated = null;
  let head = "T28-EMPTY";

  for (let index = 0; index < registry.events.length; index += 1) {
    const raw = registry.events[index];
    const event = canonicalEvent(raw);
    if (!event || !event.eventId || !event.eventFingerprint) {
      return { valid: false, reason: "TRUST_EVENT_INVALID", index };
    }
    if (seen.has(event.eventId)) return { valid: false, reason: "TRUST_DUPLICATE_EVENT", index };
    seen.add(event.eventId);

    const createdAt = new Date(event.createdAt).getTime();
    if (previousCreated !== null && createdAt < previousCreated) {
      return { valid: false, reason: "TRUST_CHRONOLOGY_INVALID", index };
    }
    previousCreated = createdAt;

    const expectedKey = await buildTrustedSignerFingerprint(event.publicKeyJwk);
    if (expectedKey !== event.keyFingerprint) {
      return { valid: false, reason: "TRUST_KEY_FINGERPRINT_MISMATCH", index };
    }

    const expectedEvent = await buildEventFingerprint(event);
    if (expectedEvent !== event.eventFingerprint) {
      return { valid: false, reason: "TRUST_EVENT_FINGERPRINT_MISMATCH", index };
    }

    if (event.action === TRUST_ACTIONS.ROTATE) {
      if (!event.previousKeyFingerprint || event.previousKeyFingerprint === event.keyFingerprint) {
        return { valid: false, reason: "TRUST_ROTATION_INVALID", index };
      }
      const effectiveMs = new Date(event.effectiveAt).getTime();
      const beforeEffective = new Date(effectiveMs - 1).toISOString();
      const predecessor = resolveTrustedSigner(
        { ...registry, events: registry.events.slice(0, index) },
        event.previousKeyFingerprint,
        beforeEffective
      );
      if (!predecessor || predecessor.state !== TRUST_STATES.ACTIVE) {
        return { valid: false, reason: "TRUST_ROTATION_PREDECESSOR_INVALID", index };
      }
    }

    if (event.action === TRUST_ACTIONS.REVOKE && event.state !== TRUST_STATES.REVOKED) {
      return { valid: false, reason: "TRUST_REVOKE_STATE_INVALID", index };
    }
    if (event.action === TRUST_ACTIONS.RETIRE && event.state !== TRUST_STATES.RETIRED) {
      return { valid: false, reason: "TRUST_RETIRE_STATE_INVALID", index };
    }
    if (event.action === TRUST_ACTIONS.REVOKE || event.action === TRUST_ACTIONS.RETIRE) {
      const effectiveState = resolveTrustedSigner(
        { ...registry, events: registry.events.slice(0, index) },
        event.keyFingerprint,
        event.effectiveAt
      );
      if (!effectiveState || effectiveState.state === TRUST_STATES.REVOKED ||
          (event.action === TRUST_ACTIONS.RETIRE && effectiveState.state !== TRUST_STATES.ACTIVE) ||
          (event.action === TRUST_ACTIONS.REVOKE && effectiveState.state !== TRUST_STATES.ACTIVE && effectiveState.state !== TRUST_STATES.RETIRED)) {
        return { valid: false, reason: "TRUST_TRANSITION_INVALID", index };
      }
    }

    head = event.eventFingerprint;
  }

  if (registry.headFingerprint !== head) {
    return { valid: false, reason: "TRUST_HEAD_MISMATCH" };
  }

  const live = new Map();
  for (const event of registry.events) {
    if (event.action === TRUST_ACTIONS.REVOKE) {
      live.set(event.keyFingerprint, TRUST_STATES.REVOKED);
    } else if (event.action === TRUST_ACTIONS.RETIRE) {
      live.set(event.keyFingerprint, TRUST_STATES.RETIRED);
    } else if (event.state === TRUST_STATES.ACTIVE) {
      live.set(event.keyFingerprint, TRUST_STATES.ACTIVE);
    }
  }

  return {
    valid: true,
    reason: "TRUST_REGISTRY_VERIFIED",
    eventCount: registry.events.length,
    headFingerprint: head,
    signers: [...live.entries()].map(([keyFingerprint, state]) => ({ keyFingerprint, state }))
  };
}

export async function verifyTrustedPolicyEvidence(
  signedBundle = null,
  {
    registry = null,
    at = null,
    rows = null,
    expectedKeyFingerprint = null
  } = {}
) {
  const registryResult = await verifyTrustRegistry(registry);
  if (!registryResult.valid) {
    return { valid: false, reason: "TRUST_REGISTRY_INVALID", registry: registryResult };
  }

  const signedAt = iso(at || signedBundle?.exportedAt);
  if (!signedAt) return { valid: false, reason: "EVIDENCE_TIME_INVALID" };

  const cryptoResult = await verifyPolicyEvidenceSignature(signedBundle, {
    rows,
    datasetFingerprint: signedBundle?.datasetFingerprint || null,
    expectedKeyFingerprint: null
  });
  if (!cryptoResult.valid) {
    return { valid: false, reason: cryptoResult.reason, cryptographic: cryptoResult };
  }

  const fingerprint = cryptoResult.keyFingerprint;
  if (expectedKeyFingerprint && String(expectedKeyFingerprint) !== fingerprint) {
    return { valid: false, reason: "TRUST_SIGNER_KEY_MISMATCH", keyFingerprint: fingerprint };
  }

  const trusted = resolveTrustedSigner(registry, fingerprint, signedAt);
  if (!trusted) return { valid: false, reason: "SIGNER_NOT_TRUSTED", keyFingerprint: fingerprint };
  if (trusted.state === TRUST_STATES.REVOKED) {
    return { valid: false, reason: "SIGNER_REVOKED", keyFingerprint: fingerprint };
  }

  const current = resolveTrustedSigner(registry, fingerprint, new Date().toISOString());
  if (current?.state === TRUST_STATES.REVOKED) {
    return {
      valid: false,
      reason: "SIGNER_REVOKED",
      keyFingerprint: fingerprint,
      signerStateAtSigning: trusted.state,
      signerStateNow: current.state
    };
  }

  const historical = trusted.state === TRUST_STATES.ACTIVE && current?.state === TRUST_STATES.RETIRED;
  return {
    valid: true,
    reason: historical ? "TRUSTED_HISTORICAL_SIGNATURE" : "TRUSTED_ACTIVE_SIGNATURE",
    keyFingerprint: fingerprint,
    signerStateAtSigning: trusted.state,
    signerStateNow: current?.state || trusted.state,
    registryHeadFingerprint: registryResult.headFingerprint,
    cryptographic: cryptoResult
  };
}

export async function exportTrustRegistry(registry = null) {
  const verification = await verifyTrustRegistry(registry);
  if (!verification.valid) return { valid: false, reason: verification.reason };
  return {
    valid: true,
    reason: "TRUST_REGISTRY_EXPORT_READY",
    json: JSON.stringify(registry, null, 2),
    headFingerprint: verification.headFingerprint
  };
}

export async function importTrustRegistry(raw = null) {
  try {
    const registry = typeof raw === "string" ? JSON.parse(raw) : raw;
    const verification = await verifyTrustRegistry(registry);
    return verification.valid
      ? { valid: true, reason: "TRUST_REGISTRY_IMPORTED", registry: Object.freeze(JSON.parse(JSON.stringify(registry))) }
      : { valid: false, reason: verification.reason };
  } catch {
    return { valid: false, reason: "TRUST_REGISTRY_PARSE_ERROR" };
  }
}
