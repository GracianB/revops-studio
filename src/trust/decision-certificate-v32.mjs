import { createHash } from "node:crypto";

export const CERTIFICATE_VERSION = "V32";

export const CERTIFICATE_STATUS = Object.freeze({
  VALID: "CERTIFICATE_VALID",
  INVALID: "CERTIFICATE_INVALID",
  MALFORMED: "CERTIFICATE_MALFORMED",
  INCOMPLETE: "CERTIFICATE_INCOMPLETE",
  UNTRUSTED: "CERTIFICATE_UNTRUSTED",
  REPLAY_MISMATCH: "CERTIFICATE_REPLAY_MISMATCH",
  EQUIVOCATION: "CERTIFICATE_EQUIVOCATION"
});

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          canonicalize(value[key])
        ])
    );
  }

  return value;
}

export function canonicalizeCertificate(
  certificate
) {
  return JSON.stringify(
    canonicalize(certificate)
  );
}

function fingerprintBasis(certificate) {

  if (
    certificate === null ||
    typeof certificate !== "object" ||
    Array.isArray(certificate)
  ) {
    return certificate;
  }

  const basis = {
    ...certificate
  };

  delete basis.certificateFingerprint;

  return basis;
}

export function fingerprintCertificate(
  certificate
) {
  return createHash("sha256")
    .update(
      canonicalizeCertificate(
        fingerprintBasis(certificate)
      ),
      "utf8"
    )
    .digest("hex");
}

function failure(
  code,
  detail = {}
) {
  return {
    code,
    ...detail
  };
}

function validateShape(
  certificate
) {

  if (
    certificate === null ||
    typeof certificate !== "object" ||
    Array.isArray(certificate)
  ) {
    return [
      failure("CERTIFICATE_NOT_OBJECT")
    ];
  }

  if (
    certificate.certificateVersion !==
    CERTIFICATE_VERSION
  ) {
    return [
      failure("CERTIFICATE_VERSION_MISMATCH")
    ];
  }

  const required = [
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
  ];

  const missing = required.filter(
    (key) => !(key in certificate)
  );

  if (missing.length > 0) {
    return [
      failure(
        "CERTIFICATE_REQUIRED_FIELDS_MISSING",
        { missing }
      )
    ];
  }

  return [];
}

export function buildDecisionCertificate(
  input
) {

  const certificate = {
    certificateVersion:
      CERTIFICATE_VERSION,

    certificateId:
      input.certificateId,

    decision:
      input.decision,

    data:
      input.data,

    policy:
      input.policy,

    replay:
      input.replay,

    evidence:
      input.evidence,

    signature:
      input.signature,

    trust:
      input.trust,

    transparency:
      input.transparency,

    witnesses:
      input.witnesses,

    verification:
      input.verification ?? {}
  };

  return {
    ...certificate,

    certificateFingerprint:
      fingerprintCertificate(
        certificate
      )
  };
}

export function verifyDecisionCertificate(
  certificate,
  adapters = {}
) {

  const failures =
    validateShape(certificate);

  if (failures.length > 0) {
    return {
      valid: false,
      status:
        CERTIFICATE_STATUS.MALFORMED,
      failures,
      certificateFingerprint:
        null
    };
  }

  const fingerprint =
    fingerprintCertificate(
      certificate
    );

  if (
    typeof certificate.certificateFingerprint ===
      "string" &&
    certificate.certificateFingerprint !==
      fingerprint
  ) {

    failures.push(
      failure(
        "CERTIFICATE_FINGERPRINT_EMBEDDED_MISMATCH",
        {
          expected:
            fingerprint,
          actual:
            certificate.certificateFingerprint
        }
      )
    );
  }

  if (
    typeof adapters.expectedFingerprint ===
      "string" &&
    adapters.expectedFingerprint !==
      fingerprint
  ) {

    failures.push(
      failure(
        "CERTIFICATE_FINGERPRINT_MISMATCH",
        {
          expected:
            adapters.expectedFingerprint,
          actual:
            fingerprint
        }
      )
    );
  }

  const replayResult =
    typeof adapters.replayVerifier ===
      "function"
      ? adapters.replayVerifier(
          certificate.replay,
          certificate
        )
      : null;

  const trustResult =
    typeof adapters.trustVerifier ===
      "function"
      ? adapters.trustVerifier(
          certificate.trust,
          certificate
        )
      : null;

  const transparencyResult =
    typeof adapters.transparencyVerifier ===
      "function"
      ? adapters.transparencyVerifier(
          certificate.transparency,
          certificate
        )
      : null;

  const witnessResult =
    typeof adapters.witnessVerifier ===
      "function"
      ? adapters.witnessVerifier(
          certificate.witnesses,
          certificate
        )
      : null;

  if (replayResult?.valid === false) {

    failures.push(
      failure(
        "REPLAY_MISMATCH",
        {
          detail:
            replayResult
        }
      )
    );
  }

  if (trustResult?.valid === false) {

    failures.push(
      failure(
        "TRUST_INVALID",
        {
          detail:
            trustResult
        }
      )
    );
  }

  if (
    transparencyResult?.valid === false
  ) {

    const code =
      transparencyResult.status ===
        "TRANSPARENCY_EQUIVOCATION"
      ||
      transparencyResult.code ===
        "TRANSPARENCY_EQUIVOCATION"
        ? "TRANSPARENCY_EQUIVOCATION"
        : "TRANSPARENCY_INVALID";

    failures.push(
      failure(
        code,
        {
          detail:
            transparencyResult
        }
      )
    );
  }

  if (witnessResult?.valid === false) {

    failures.push(
      failure(
        "WITNESSES_INVALID",
        {
          detail:
            witnessResult
        }
      )
    );
  }

  if (
    !certificate.decision ||
    typeof certificate.decision !==
      "object"
  ) {

    failures.push(
      failure(
        "DECISION_INVALID"
      )
    );

  }
  else if (
    !certificate.decision.status
  ) {

    failures.push(
      failure(
        "DECISION_STATUS_MISSING"
      )
    );
  }

  if (failures.length > 0) {

    const replayFailure =
      failures.some(
        (item) =>
          item.code ===
          "REPLAY_MISMATCH"
      );

    const trustFailure =
      failures.some(
        (item) =>
          item.code ===
            "TRUST_INVALID"
          ||
          item.code ===
            "WITNESSES_INVALID"
      );

    const equivocation =
      failures.some(
        (item) =>
          item.code ===
          "TRANSPARENCY_EQUIVOCATION"
      );

    return {

      valid: false,

      status:
        equivocation
          ? CERTIFICATE_STATUS.EQUIVOCATION
          : replayFailure
            ? CERTIFICATE_STATUS.REPLAY_MISMATCH
            : trustFailure
              ? CERTIFICATE_STATUS.UNTRUSTED
              : CERTIFICATE_STATUS.INVALID,

      failures,

      certificateFingerprint:
        fingerprint
    };
  }

  return {

    valid: true,

    status:
      CERTIFICATE_STATUS.VALID,

    failures: [],

    certificateFingerprint:
      fingerprint,

    components: {

      decisionValid: true,
      policyValid: true,

      replayValid:
        replayResult?.valid ?? null,

      evidenceValid: true,
      signatureValid: true,

      trustValid:
        trustResult?.valid ?? null,

      quorumValid:
        trustResult?.quorumValid ?? null,

      transparencyValid:
        transparencyResult?.valid ?? null,

      witnessesValid:
        witnessResult?.valid ?? null
    }
  };
}

export function exportDecisionCertificate(
  certificate
) {

  return JSON.stringify(
    canonicalize(certificate),
    null,
    2
  );
}
