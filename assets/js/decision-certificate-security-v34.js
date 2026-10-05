export const SECURITY_HARDENING_VERSION = "34.0";

const REQUIRED_CERTIFICATE_FIELDS = Object.freeze([
  "certificateVersion",
  "certificateId",
  "decision",
  "data",
  "policy",
  "replay",
  "evidence",
  "signature",
  "trust",
  "transparency",
  "witnesses"
]);

function isObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

export function auditDecisionCertificateShape(certificate) {
  const failures = [];

  if (!isObject(certificate)) {
    return {
      valid: false,
      failClosed: true,
      failures: [
        { code: "CERTIFICATE_NOT_OBJECT" }
      ]
    };
  }

  for (const field of REQUIRED_CERTIFICATE_FIELDS) {
    if (!(field in certificate)) {
      failures.push({
        code: "CERTIFICATE_REQUIRED_FIELD_MISSING",
        field
      });
    }
  }

  if (
    certificate.certificateVersion == null ||
    certificate.certificateVersion === ""
  ) {
    failures.push({
      code: "CERTIFICATE_VERSION_MISSING"
    });
  }

  if (
    certificate.certificateId == null ||
    certificate.certificateId === ""
  ) {
    failures.push({
      code: "CERTIFICATE_ID_MISSING"
    });
  }

  return {
    valid: failures.length === 0,
    failClosed: true,
    failures
  };
}

export function verifyDecisionCertificateSecurityBoundary(
  certificate,
  {
    expectedFingerprint = null,
    actualFingerprint = null
  } = {}
) {
  const shape = auditDecisionCertificateShape(certificate);

  if (!shape.valid) {
    return {
      valid: false,
      status: "SECURITY_REJECTED",
      reason: "MALFORMED_CERTIFICATE",
      failures: shape.failures
    };
  }

  if (
    expectedFingerprint &&
    actualFingerprint &&
    expectedFingerprint !== actualFingerprint
  ) {
    return {
      valid: false,
      status: "SECURITY_REJECTED",
      reason: "FINGERPRINT_MISMATCH",
      failures: [
        {
          code: "CERTIFICATE_FINGERPRINT_MISMATCH",
          expected: expectedFingerprint,
          actual: actualFingerprint
        }
      ]
    };
  }

  return {
    valid: true,
    status: "SECURITY_ACCEPTED",
    failures: []
  };
}

export function classifySecurityFailure(result = {}) {
  if (result.valid === true) {
    return "SECURE";
  }

  if (result.reason === "FINGERPRINT_MISMATCH") {
    return "INTEGRITY_FAILURE";
  }

  if (result.reason === "MALFORMED_CERTIFICATE") {
    return "MALFORMED";
  }

  return "SECURITY_FAILURE";
}
