export const SECURITY_HARDENING_V38_VERSION = "38.0";

export const SECURITY_V38_LIMITS = Object.freeze({
  maxBytes: 5_000_000,
  maxDepth: 12
});

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function utf8Bytes(value) {
  return new TextEncoder().encode(value).byteLength;
}

export function calculateJsonDepth(value, depth = 0) {
  if (value === null || typeof value !== "object") return depth;
  const children = Array.isArray(value) ? value : Object.values(value);
  if (!children.length) return depth + 1;
  return Math.max(...children.map((child) => calculateJsonDepth(child, depth + 1)));
}

export function findForbiddenKeys(value, path = "") {
  const hits = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      hits.push(...findForbiddenKeys(item, path + "[" + index + "]"));
    });
    return hits;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const current = path ? path + "." + key : key;
      if (FORBIDDEN_KEYS.has(key)) hits.push(current);
      hits.push(...findForbiddenKeys(child, current));
    }
  }

  return hits;
}

export function safeParseDecisionCertificate(
  input,
  {
    maxBytes = SECURITY_V38_LIMITS.maxBytes,
    maxDepth = SECURITY_V38_LIMITS.maxDepth
  } = {}
) {
  if (typeof input !== "string") {
    return {
      valid: false,
      status: "SECURITY_REJECTED",
      reason: "INPUT_NOT_STRING",
      certificate: null,
      failures: [{ code: "INPUT_NOT_STRING" }]
    };
  }

  const bytes = utf8Bytes(input);

  if (bytes > maxBytes) {
    return {
      valid: false,
      status: "SECURITY_REJECTED",
      reason: "PAYLOAD_TOO_LARGE",
      certificate: null,
      failures: [{ code: "PAYLOAD_TOO_LARGE", bytes, maxBytes }]
    };
  }

  let certificate;

  try {
    certificate = JSON.parse(input);
  } catch {
    return {
      valid: false,
      status: "SECURITY_REJECTED",
      reason: "INVALID_JSON",
      certificate: null,
      failures: [{ code: "INVALID_JSON" }]
    };
  }

  if (!certificate || typeof certificate !== "object" || Array.isArray(certificate)) {
    return {
      valid: false,
      status: "SECURITY_REJECTED",
      reason: "ROOT_NOT_OBJECT",
      certificate: null,
      failures: [{ code: "ROOT_NOT_OBJECT" }]
    };
  }

  const depth = calculateJsonDepth(certificate);

  if (depth > maxDepth) {
    return {
      valid: false,
      status: "SECURITY_REJECTED",
      reason: "DEPTH_LIMIT",
      certificate: null,
      failures: [{ code: "DEPTH_LIMIT", depth, maxDepth }]
    };
  }

  const forbidden = findForbiddenKeys(certificate);

  if (forbidden.length) {
    return {
      valid: false,
      status: "SECURITY_REJECTED",
      reason: "FORBIDDEN_KEYS",
      certificate: null,
      failures: [{ code: "FORBIDDEN_KEYS", keys: forbidden }]
    };
  }

  return {
    valid: true,
    status: "SECURITY_ACCEPTED",
    reason: "INPUT_SAFE",
    certificate,
    failures: []
  };
}

export function validateCertificateBoundary(
  certificate,
  {
    expectedVersion = "32.0",
    requiredFingerprintPattern = /^DC32-[A-Za-z0-9_-]{43,44}$/
  } = {}
) {
  const failures = [];

  if (!certificate || typeof certificate !== "object" || Array.isArray(certificate)) {
    failures.push({ code: "ROOT_NOT_OBJECT" });
  } else {
    if (certificate.certificateVersion !== expectedVersion) {
      failures.push({
        code: "CERTIFICATE_VERSION_MISMATCH",
        expected: expectedVersion,
        actual: certificate.certificateVersion ?? null
      });
    }

    if (
      typeof certificate.certificateId !== "string" ||
      certificate.certificateId.trim() === ""
    ) {
      failures.push({ code: "CERTIFICATE_ID_INVALID" });
    }

    if (
      typeof certificate.certificateFingerprint !== "string" ||
      !requiredFingerprintPattern.test(certificate.certificateFingerprint)
    ) {
      failures.push({ code: "CERTIFICATE_FINGERPRINT_INVALID" });
    }
  }

  return {
    valid: failures.length === 0,
    failClosed: true,
    failures
  };
}
