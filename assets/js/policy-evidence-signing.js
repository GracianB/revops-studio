import {
  POLICY_CONTRACT_VERSION
} from "./policy-engine.js";
import {
  POLICY_EVIDENCE_SCHEMA,
  POLICY_EVIDENCE_VERSION,
  verifyPolicyEvidenceBundle
} from "./policy-evidence.js";

export const POLICY_SIGNATURE_VERSION = "27.0";
export const POLICY_SIGNATURE_ALGORITHM = "ECDSA-P256-SHA256";

const encoder = new TextEncoder();

const getCrypto = () => {
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.subtle) throw new Error("WEBCRYPTO_UNAVAILABLE");
  return cryptoObject;
};

const canonicalPublicJwk = (jwk = null) => {
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

const bytesToBase64Url = (bytes) => {
  let binary = "";
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let index = 0; index < source.length; index += 1) binary += String.fromCharCode(source[index]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlToBytes = (value = "") => {
  const normalised = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const sha256Base64Url = async (value, prefix = "S27-") => {
  const digest = await getCrypto().subtle.digest("SHA-256", encoder.encode(String(value)));
  return prefix + bytesToBase64Url(new Uint8Array(digest));
};

const canonicalPayload = (bundle = null) => {
  if (!bundle || typeof bundle !== "object") return null;
  return {
    schema: bundle.schema || null,
    evidenceVersion: bundle.evidenceVersion || null,
    policyContractVersion: bundle.policyContractVersion || null,
    exportedAt: bundle.exportedAt || null,
    datasetFingerprint: bundle.datasetFingerprint || null,
    manifest: bundle.manifest || null,
    manifestFingerprint: bundle.manifestFingerprint || null,
    proposal: bundle.proposal || null,
    ledger: Array.isArray(bundle.ledger) ? bundle.ledger : []
  };
};

const serialiseCanonical = (value) => JSON.stringify(value);

const buildSigningInput = ({
  publicKeyJwk,
  keyFingerprint,
  payloadFingerprint,
  payload
} = {}) => serialiseCanonical({
  signatureVersion: POLICY_SIGNATURE_VERSION,
  algorithm: POLICY_SIGNATURE_ALGORITHM,
  keyFingerprint,
  payloadFingerprint,
  publicKeyJwk,
  payload
});

export async function generatePolicyEvidenceKeyPair() {
  const cryptoObject = getCrypto();
  const keyPair = await cryptoObject.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicKeyJwk = canonicalPublicJwk(
    await cryptoObject.subtle.exportKey("jwk", keyPair.publicKey)
  );
  const privateKeyJwk = await cryptoObject.subtle.exportKey("jwk", keyPair.privateKey);
  if (!publicKeyJwk || !privateKeyJwk) throw new Error("KEY_EXPORT_FAILED");
  const keyFingerprint = await sha256Base64Url(serialiseCanonical(publicKeyJwk), "K27-");
  return Object.freeze({
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicKeyJwk,
    privateKeyJwk,
    keyFingerprint
  });
}

export async function importPolicyEvidencePrivateKey(jwk = null) {
  const cryptoObject = getCrypto();
  if (!jwk || typeof jwk !== "object" || jwk.kty !== "EC" || jwk.crv !== "P-256" ||
      !jwk.d || !jwk.x || !jwk.y) {
    throw new Error("PRIVATE_KEY_JWK_INVALID");
  }
  const privateKey = await cryptoObject.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );
  const publicKeyJwk = canonicalPublicJwk(jwk);
  const keyFingerprint = await sha256Base64Url(serialiseCanonical(publicKeyJwk), "K27-");
  return Object.freeze({ privateKey, publicKeyJwk, keyFingerprint });
}

export async function buildPolicyEvidenceSigningPayload(bundle = null) {
  const payload = canonicalPayload(bundle);
  if (!payload || payload.schema !== POLICY_EVIDENCE_SCHEMA ||
      payload.evidenceVersion !== POLICY_EVIDENCE_VERSION ||
      payload.policyContractVersion !== POLICY_CONTRACT_VERSION) {
    return { valid: false, reason: "EVIDENCE_PAYLOAD_INVALID" };
  }
  return Object.freeze({
    valid: true,
    reason: "SIGNING_PAYLOAD_READY",
    payload,
    serialised: serialiseCanonical(payload),
    fingerprint: await sha256Base64Url(serialiseCanonical(payload))
  });
}

export async function signPolicyEvidenceBundle(bundle = null, { privateKey, publicKeyJwk = null } = {}) {
  if (!privateKey) return { valid: false, reason: "PRIVATE_KEY_REQUIRED" };
  const baseVerification = verifyPolicyEvidenceBundle(bundle);
  if (!baseVerification.valid) {
    return { valid: false, reason: "EVIDENCE_NOT_VERIFIED", verification: baseVerification };
  }

  const keyData = publicKeyJwk
    ? { publicKeyJwk: canonicalPublicJwk(publicKeyJwk) }
    : await (async () => {
        const cryptoObject = getCrypto();
        const exported = await cryptoObject.subtle.exportKey("jwk", privateKey);
        return { publicKeyJwk: canonicalPublicJwk(exported) };
      })();

  if (!keyData.publicKeyJwk) return { valid: false, reason: "PUBLIC_KEY_REQUIRED" };

  const keyFingerprint = await sha256Base64Url(serialiseCanonical(keyData.publicKeyJwk), "K27-");
  const payloadResult = await buildPolicyEvidenceSigningPayload(bundle);
  if (!payloadResult.valid) return payloadResult;

  const signingInput = buildSigningInput({
    publicKeyJwk: keyData.publicKeyJwk,
    keyFingerprint,
    payloadFingerprint: payloadResult.fingerprint,
    payload: payloadResult.payload
  });

  const signature = await getCrypto().subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    encoder.encode(signingInput)
  );

  return Object.freeze({
    valid: true,
    reason: "EVIDENCE_SIGNED",
    bundle: Object.freeze({
      ...bundle,
      signature: Object.freeze({
        signatureVersion: POLICY_SIGNATURE_VERSION,
        algorithm: POLICY_SIGNATURE_ALGORITHM,
        publicKeyJwk: keyData.publicKeyJwk,
        keyFingerprint,
        payloadFingerprint: payloadResult.fingerprint,
        signature: bytesToBase64Url(new Uint8Array(signature))
      })
    }),
    keyFingerprint,
    payloadFingerprint: payloadResult.fingerprint
  });
}

export async function verifyPolicyEvidenceSignature(
  signedBundle = null,
  { expectedKeyFingerprint = null, expectedPublicKeyJwk = null, datasetFingerprint = null, rows = null } = {}
) {
  const baseVerification = verifyPolicyEvidenceBundle(signedBundle, {
    datasetFingerprint,
    rows
  });
  if (!baseVerification.valid) {
    return { valid: false, reason: "EVIDENCE_NOT_VERIFIED", verification: baseVerification };
  }

  const signature = signedBundle?.signature;
  if (!signature || typeof signature !== "object") {
    return { valid: false, reason: "SIGNATURE_MISSING" };
  }
  if (signature.signatureVersion !== POLICY_SIGNATURE_VERSION) {
    return { valid: false, reason: "SIGNATURE_VERSION_MISMATCH" };
  }
  if (signature.algorithm !== POLICY_SIGNATURE_ALGORITHM) {
    return { valid: false, reason: "SIGNATURE_ALGORITHM_MISMATCH" };
  }

  const publicKeyJwk = canonicalPublicJwk(signature.publicKeyJwk);
  if (!publicKeyJwk) return { valid: false, reason: "PUBLIC_KEY_INVALID" };

  const keyFingerprint = await sha256Base64Url(serialiseCanonical(publicKeyJwk), "K27-");
  if (keyFingerprint !== signature.keyFingerprint) {
    return { valid: false, reason: "KEY_FINGERPRINT_MISMATCH" };
  }
  if (expectedKeyFingerprint && String(expectedKeyFingerprint) !== keyFingerprint) {
    return { valid: false, reason: "SIGNER_KEY_MISMATCH" };
  }
  if (expectedPublicKeyJwk) {
    const expected = canonicalPublicJwk(expectedPublicKeyJwk);
    if (!expected) return { valid: false, reason: "EXPECTED_PUBLIC_KEY_INVALID" };
    const expectedFingerprint = await sha256Base64Url(serialiseCanonical(expected), "K27-");
    if (expectedFingerprint !== keyFingerprint) {
      return { valid: false, reason: "SIGNER_KEY_MISMATCH" };
    }
  }

  const payloadResult = await buildPolicyEvidenceSigningPayload(signedBundle);
  if (!payloadResult.valid) return payloadResult;
  if (payloadResult.fingerprint !== signature.payloadFingerprint) {
    return { valid: false, reason: "PAYLOAD_FINGERPRINT_MISMATCH" };
  }

  let verified = false;
  try {
    const publicKey = await getCrypto().subtle.importKey(
      "jwk",
      publicKeyJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"]
    );
    const signingInput = buildSigningInput({
      publicKeyJwk,
      keyFingerprint,
      payloadFingerprint: payloadResult.fingerprint,
      payload: payloadResult.payload
    });
    verified = await getCrypto().subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      base64UrlToBytes(signature.signature),
      encoder.encode(signingInput)
    );
  } catch {
    return { valid: false, reason: "SIGNATURE_VERIFICATION_ERROR" };
  }

  return verified
    ? {
        valid: true,
        reason: "SIGNATURE_VERIFIED",
        keyFingerprint,
        payloadFingerprint: payloadResult.fingerprint,
        evidence: baseVerification.reason
      }
    : {
        valid: false,
        reason: "SIGNATURE_INVALID",
        keyFingerprint,
        payloadFingerprint: payloadResult.fingerprint
      };
}

export function serialiseSignedPolicyEvidenceBundle(bundle = null) {
  return bundle && typeof bundle === "object"
    ? JSON.stringify(bundle, null, 2)
    : null;
}
