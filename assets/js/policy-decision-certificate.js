import {
  verifyPolicyEvidenceLineage
} from "./policy-evidence.js";
import {
  verifyPolicyEvidenceSignature
} from "./policy-evidence-signing.js";
import {
  verifyTrustedPolicyEvidenceViaFabric
} from "./policy-trust-fabric.js";
import {
  verifyTransparencyLog,
  verifyTransparencyWitnessSet
} from "./policy-transparency.js";

export const DECISION_CERTIFICATE_VERSION = "32.0";
export const DECISION_CERTIFICATE_SCHEMA = "revops-policy-decision-certificate";
export const DECISION_CERTIFICATE_ALGORITHM = "SHA-256";
export const DECISION_CERTIFICATE_MIN_WITNESSES = 1;

export const DECISION_CERTIFICATE_STATUS = Object.freeze({
  VALID: "CERTIFICATE_VALID",
  INVALID: "CERTIFICATE_INVALID",
  MALFORMED: "CERTIFICATE_MALFORMED",
  INCOMPLETE: "CERTIFICATE_INCOMPLETE",
  UNTRUSTED: "CERTIFICATE_UNTRUSTED",
  REPLAY_MISMATCH: "CERTIFICATE_REPLAY_MISMATCH",
  EQUIVOCATION: "CERTIFICATE_EQUIVOCATION"
});

const encoder = new TextEncoder();

const getCrypto = () => {
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.subtle) {
    throw new Error("WEBCRYPTO_UNAVAILABLE");
  }
  return cryptoObject;
};

const bytesToBase64Url = (bytes) => {
  let binary = "";
  const source = bytes instanceof Uint8Array
    ? bytes
    : new Uint8Array(bytes);

  for (let index = 0; index < source.length; index += 1) {
    binary += String.fromCharCode(source[index]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const sha256 = async (value, prefix = "") => {
  const digest = await getCrypto().subtle.digest(
    "SHA-256",
    encoder.encode(String(value))
  );

  return prefix +
    bytesToBase64Url(new Uint8Array(digest));
};

const isObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value);

const canonicalize = (value) => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (isObject(value)) {
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
};

const clone = (value) => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
};

const normaliseTimestamp = (value) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
};

const certificateFingerprintBasis = (certificate) => {
  if (!isObject(certificate)) {
    return certificate;
  }

  const basis = clone(certificate);

  if (isObject(basis)) {
    delete basis.certificateFingerprint;
  }

  return basis;
};

export function canonicalizeDecisionCertificate(
  certificate
) {
  return JSON.stringify(
    canonicalize(
      certificateFingerprintBasis(certificate)
    )
  );
}

export async function fingerprintDecisionCertificate(
  certificate
) {
  return sha256(
    canonicalizeDecisionCertificate(certificate),
    "DC32-"
  );
}

function fail(code, detail = {}) {
  return {
    code,
    ...detail
  };
}

function requiredFieldsMissing(certificate) {
  return [
    "certificateVersion",
    "certificateId",
    "issuedAt",
    "decision",
    "evidence",
    "trust",
    "transparency",
    "witnesses"
  ].filter(
    (key) => !(key in certificate)
  );
}

function deriveDecisionMetadata(
  signedEvidenceBundle,
  explicitDecision = null
) {
  const active =
    signedEvidenceBundle?.manifest?.active ||
    null;

  return {
    decisionId:
      explicitDecision?.decisionId ??
      active?.decisionId ??
      null,

    policyId:
      explicitDecision?.policyId ??
      active?.policyId ??
      null,

    proposalId:
      explicitDecision?.proposalId ??
      active?.proposalId ??
      signedEvidenceBundle?.proposal?.proposalId ??
      null,

    runId:
      explicitDecision?.runId ??
      active?.runId ??
      signedEvidenceBundle?.proposal?.runId ??
      null,

    datasetFingerprint:
      explicitDecision?.datasetFingerprint ??
      signedEvidenceBundle?.datasetFingerprint ??
      null,

    status:
      explicitDecision?.status ??
      "APPROVED",

    result:
      explicitDecision?.result ??
      "APPROVED",

    actor:
      explicitDecision?.actor ??
      active?.actor ??
      null,

    rationale:
      explicitDecision?.rationale ??
      active?.rationale ??
      null
  };
}

const statusFromTransparencyReason = (reason) =>
  String(reason || "").includes("EQUIVOCATION")
    ? DECISION_CERTIFICATE_STATUS.EQUIVOCATION
    : DECISION_CERTIFICATE_STATUS.INVALID;

export async function buildDecisionCertificate({
  certificateId = null,
  issuedAt = new Date().toISOString(),
  decision = null,
  signedEvidenceBundle = null,
  trustFabricCheckpoint = null,
  transparencyLog = null,
  minWitnesses =
    DECISION_CERTIFICATE_MIN_WITNESSES
} = {}) {
  const timestamp =
    normaliseTimestamp(issuedAt);

  if (!timestamp) {
    return {
      valid: false,
      status:
        DECISION_CERTIFICATE_STATUS.MALFORMED,
      reason:
        "CERTIFICATE_TIMESTAMP_INVALID"
    };
  }

  if (!isObject(signedEvidenceBundle)) {
    return {
      valid: false,
      status:
        DECISION_CERTIFICATE_STATUS.INCOMPLETE,
      reason:
        "SIGNED_EVIDENCE_REQUIRED"
    };
  }

  if (!isObject(trustFabricCheckpoint)) {
    return {
      valid: false,
      status:
        DECISION_CERTIFICATE_STATUS.INCOMPLETE,
      reason:
        "TRUST_FABRIC_CHECKPOINT_REQUIRED"
    };
  }

  if (!isObject(transparencyLog)) {
    return {
      valid: false,
      status:
        DECISION_CERTIFICATE_STATUS.INCOMPLETE,
      reason:
        "TRANSPARENCY_LOG_REQUIRED"
    };
  }

  const effectiveDecision =
    deriveDecisionMetadata(
      signedEvidenceBundle,
      decision
    );

  const transparencyVerification =
    await verifyTransparencyLog(
      transparencyLog,
      {
        verifyCheckpoints: true
      }
    );

  if (!transparencyVerification.valid) {
    return {
      valid: false,
      status:
        statusFromTransparencyReason(
          transparencyVerification.reason
        ),
      reason:
        "TRANSPARENCY_NOT_VERIFIED",
      transparency:
        transparencyVerification
    };
  }

  const witnessAttestations =
    Array.isArray(
      transparencyLog.witnesses
    )
      ? transparencyLog.witnesses
      : [];

  const requiredWitnesses =
    Math.max(
      DECISION_CERTIFICATE_MIN_WITNESSES,
      Number(minWitnesses) || 0
    );

  const witnessVerification =
    await verifyTransparencyWitnessSet(
      witnessAttestations,
      {
        entries:
          transparencyLog.entries,
        minWitnesses:
          requiredWitnesses
      }
    );

  if (!witnessVerification.valid) {
    return {
      valid: false,
      status:
        String(
          witnessVerification.reason || ""
        ).includes("EQUIVOCATION")
          ? DECISION_CERTIFICATE_STATUS.EQUIVOCATION
          : DECISION_CERTIFICATE_STATUS.UNTRUSTED,
      reason:
        "WITNESS_QUORUM_NOT_VERIFIED",
      witnesses:
        witnessVerification
    };
  }

  const headSequence =
    transparencyVerification.headSequence;

  const headWitnesses =
    witnessAttestations.filter(
      (attestation) =>
        Number(attestation?.sequence) ===
        Number(headSequence)
    );

  const headWitnessVerification =
    await verifyTransparencyWitnessSet(
      headWitnesses,
      {
        entries:
          transparencyLog.entries,
        minWitnesses:
          requiredWitnesses
      }
    );

  if (!headWitnessVerification.valid) {
    return {
      valid: false,
      status:
        DECISION_CERTIFICATE_STATUS.UNTRUSTED,
      reason:
        "HEAD_WITNESS_QUORUM_NOT_REACHED",
      witnesses:
        headWitnessVerification
    };
  }

  if (
    transparencyVerification
      .latestCheckpointFingerprint !==
    trustFabricCheckpoint
      .checkpointFingerprint
  ) {
    return {
      valid: false,
      status:
        DECISION_CERTIFICATE_STATUS.INVALID,
      reason:
        "TRANSPARENCY_CHECKPOINT_MISMATCH",
      transparency:
        transparencyVerification
    };
  }

  const evidenceVerification =
    await verifyPolicyEvidenceLineage(
      signedEvidenceBundle,
      {
        datasetFingerprint:
          effectiveDecision.datasetFingerprint
      }
    );

  if (!evidenceVerification.valid) {
    const reason =
      String(
        evidenceVerification.reason || ""
      );

    return {
      valid: false,
      status:
        reason.includes("REPLAY")
          ? DECISION_CERTIFICATE_STATUS.REPLAY_MISMATCH
          : DECISION_CERTIFICATE_STATUS.INVALID,
      reason:
        "EVIDENCE_NOT_VERIFIED",
      evidence:
        evidenceVerification
    };
  }

  const trustVerification =
    await verifyTrustedPolicyEvidenceViaFabric(
      signedEvidenceBundle,
      {
        checkpoint:
          trustFabricCheckpoint,

        at:
          timestamp,

        verificationAt:
          timestamp
      }
    );

  if (!trustVerification.valid) {
    return {
      valid: false,
      status:
        DECISION_CERTIFICATE_STATUS.UNTRUSTED,
      reason:
        "TRUST_NOT_VERIFIED",
      trust:
        trustVerification
    };
  }

  const signatureVerification =
    await verifyPolicyEvidenceSignature(
      signedEvidenceBundle,
      {
        datasetFingerprint:
          effectiveDecision.datasetFingerprint
      }
    );

  if (!signatureVerification.valid) {
    return {
      valid: false,
      status:
        DECISION_CERTIFICATE_STATUS.INVALID,
      reason:
        "EVIDENCE_SIGNATURE_NOT_VERIFIED",
      signature:
        signatureVerification
    };
  }

  const certificate = {
    schema:
      DECISION_CERTIFICATE_SCHEMA,

    certificateVersion:
      DECISION_CERTIFICATE_VERSION,

    algorithm:
      DECISION_CERTIFICATE_ALGORITHM,

    certificateId:
      certificateId ||
      "DC32-" +
        await sha256(
          timestamp +
          ":" +
          (
            effectiveDecision.runId ||
            "RUN"
          ),
          ""
        ),

    issuedAt:
      timestamp,

    decision:
      effectiveDecision,

    evidence: {
      bundle:
        clone(signedEvidenceBundle),

      manifestFingerprint:
        signedEvidenceBundle
          .manifestFingerprint ||
        null,

      datasetFingerprint:
        signedEvidenceBundle
          .datasetFingerprint ||
        null,

      signerKeyFingerprint:
        signedEvidenceBundle
          .signature
          ?.keyFingerprint ||
        null,

      signaturePayloadFingerprint:
        signedEvidenceBundle
          .signature
          ?.payloadFingerprint ||
        null
    },

    trust: {
      checkpoint:
        clone(
          trustFabricCheckpoint
        ),

      fabricFingerprint:
        trustVerification
          .fabricFingerprint ||
        null,

      registryHeadFingerprint:
        trustVerification
          .registryHeadFingerprint ||
        null,

      threshold:
        trustVerification.threshold ??
        null,

      quorum:
        trustVerification.quorum ??
        null,

      verifiedRoots:
        Array.isArray(
          trustVerification
            .verifiedRoots
        )
          ? [
              ...trustVerification
                .verifiedRoots
            ]
          : []
    },

    transparency: {
      log:
        clone(transparencyLog),

      headSequence:
        transparencyVerification
          .headSequence,

      headEntryFingerprint:
        transparencyVerification
          .headEntryFingerprint,

      latestCheckpointFingerprint:
        transparencyVerification
          .latestCheckpointFingerprint
    },

    witnesses: {
      required:
        requiredWitnesses,

      total:
        witnessVerification
          .witnesses?.length ||
        0,

      headQuorum:
        headWitnessVerification
          .quorum ||
        0,

      fingerprints:
        Array.isArray(
          headWitnessVerification
            .witnesses
        )
          ? [
              ...headWitnessVerification
                .witnesses
            ].sort()
          : []
    },

    verification: {
      evidence:
        evidenceVerification,

      signature:
        signatureVerification,

      trust:
        trustVerification,

      transparency:
        transparencyVerification,

      witnesses:
        headWitnessVerification
    },

    certificateFingerprint:
      null
  };

  certificate.certificateFingerprint =
    await fingerprintDecisionCertificate(
      certificate
    );

  return Object.freeze({
    valid: true,
    status:
      DECISION_CERTIFICATE_STATUS.VALID,
    reason:
      "DECISION_CERTIFICATE_BUILT",
    certificate:
      Object.freeze(certificate)
  });
}

export async function verifyDecisionCertificate(
  certificate = null,
  {
    rows = null,
    expectedCertificateFingerprint = null,
    expectedHeadFingerprint = null,
    expectedRootFingerprints = null,
    expectedThreshold = null,
    minWitnesses =
      DECISION_CERTIFICATE_MIN_WITNESSES,
    verificationAt = null
  } = {}
) {
  const failures = [];

  if (!isObject(certificate)) {
    return {
      valid: false,
      status:
        DECISION_CERTIFICATE_STATUS.MALFORMED,
      reason:
        "CERTIFICATE_NOT_OBJECT",
      failures: [
        fail(
          "CERTIFICATE_NOT_OBJECT"
        )
      ],
      certificateFingerprint:
        null
    };
  }

  if (
    certificate.schema !==
    DECISION_CERTIFICATE_SCHEMA
  ) {
    failures.push(
      fail("CERTIFICATE_SCHEMA_MISMATCH")
    );
  }

  if (
    certificate.certificateVersion !==
    DECISION_CERTIFICATE_VERSION
  ) {
    failures.push(
      fail(
        "CERTIFICATE_VERSION_MISMATCH"
      )
    );
  }

  const missing =
    requiredFieldsMissing(
      certificate
    );

  if (missing.length) {
    return {
      valid: false,
      status:
        DECISION_CERTIFICATE_STATUS.INCOMPLETE,
      reason:
        "CERTIFICATE_REQUIRED_FIELDS_MISSING",
      failures: [
        fail(
          "CERTIFICATE_REQUIRED_FIELDS_MISSING",
          { missing }
        )
      ],
      certificateFingerprint:
        null
    };
  }

  const actualFingerprint =
    await fingerprintDecisionCertificate(
      certificate
    );

  if (
    typeof
      certificate.certificateFingerprint ===
      "string" &&
    certificate.certificateFingerprint !==
      actualFingerprint
  ) {
    failures.push(
      fail(
        "CERTIFICATE_FINGERPRINT_EMBEDDED_MISMATCH",
        {
          expected:
            actualFingerprint,

          actual:
            certificate.certificateFingerprint
        }
      )
    );
  }

  if (
    expectedCertificateFingerprint &&
    String(
      expectedCertificateFingerprint
    ) !== actualFingerprint
  ) {
    failures.push(
      fail(
        "CERTIFICATE_FINGERPRINT_MISMATCH",
        {
          expected:
            String(
              expectedCertificateFingerprint
            ),

          actual:
            actualFingerprint
        }
      )
    );
  }

  const evidence =
    certificate.evidence?.bundle;

  const trustCheckpoint =
    certificate.trust?.checkpoint;

  const transparencyLog =
    certificate.transparency?.log;

  const datasetFingerprint =
    certificate.decision
      ?.datasetFingerprint ||
    evidence?.datasetFingerprint ||
    null;

  if (
    evidence?.datasetFingerprint !==
    datasetFingerprint
  ) {
    failures.push(
      fail(
        "CERTIFICATE_DATASET_SCOPE_MISMATCH",
        {
          decision:
            datasetFingerprint,

          evidence:
            evidence?.datasetFingerprint ||
            null
        }
      )
    );
  }

  let evidenceVerification = null;
  let signatureVerification = null;
  let trustVerification = null;
  let transparencyVerification = null;
  let witnessVerification = null;
  let headWitnessVerification = null;

  try {

    evidenceVerification =
      await verifyPolicyEvidenceLineage(
        evidence,
        {
          rows,

          datasetFingerprint
        }
      );

    if (!evidenceVerification.valid) {
      failures.push(
        fail(
          "EVIDENCE_INVALID",
          {
            reason:
              evidenceVerification.reason
          }
        )
      );
    }

    signatureVerification =
      await verifyPolicyEvidenceSignature(
        evidence,
        {
          rows,

          datasetFingerprint
        }
      );

    if (!signatureVerification.valid) {
      failures.push(
        fail(
          "EVIDENCE_SIGNATURE_INVALID",
          {
            reason:
              signatureVerification.reason
          }
        )
      );
    }

    trustVerification =
      await verifyTrustedPolicyEvidenceViaFabric(
        evidence,
        {
          checkpoint:
            trustCheckpoint,

          at:
            verificationAt ||
            certificate.issuedAt,

          verificationAt:
            verificationAt ||
            certificate.issuedAt,

          expectedRootFingerprints,

          expectedThreshold,

          rows
        }
      );

    if (!trustVerification.valid) {
      failures.push(
        fail(
          "TRUST_INVALID",
          {
            reason:
              trustVerification.reason
          }
        )
      );
    }

    transparencyVerification =
      await verifyTransparencyLog(
        transparencyLog,
        {
          expectedHeadFingerprint:
            expectedHeadFingerprint ||
            certificate.transparency
              ?.headEntryFingerprint ||
            null,

          verifyCheckpoints:
            true
        }
      );

    if (
      !transparencyVerification.valid
    ) {
      const code =
        String(
          transparencyVerification.reason ||
          ""
        ).includes("EQUIVOCATION")
          ? "TRANSPARENCY_EQUIVOCATION"
          : "TRANSPARENCY_INVALID";

      failures.push(
        fail(
          code,
          {
            reason:
              transparencyVerification.reason
          }
        )
      );
    }

    witnessVerification =
      await verifyTransparencyWitnessSet(
        Array.isArray(
          transparencyLog?.witnesses
        )
          ? transparencyLog.witnesses
          : [],

        {
          entries:
            Array.isArray(
              transparencyLog?.entries
            )
              ? transparencyLog.entries
              : [],

          minWitnesses:
            Math.max(
              DECISION_CERTIFICATE_MIN_WITNESSES,
              Number(minWitnesses) || 0
            )
        }
      );

    if (!witnessVerification.valid) {
      failures.push(
        fail(
          witnessVerification.reason
            .includes("EQUIVOCATION")
            ? "TRANSPARENCY_EQUIVOCATION"
            : "WITNESSES_INVALID",

          {
            reason:
              witnessVerification.reason
          }
        )
      );
    }

    const headSequence =
      transparencyVerification
        ?.headSequence ??
      transparencyLog?.headSequence ??
      0;

    const headWitnesses =
      Array.isArray(
        transparencyLog?.witnesses
      )
        ? transparencyLog.witnesses.filter(
            (attestation) =>
              Number(
                attestation?.sequence
              ) ===
              Number(headSequence)
          )
        : [];

    headWitnessVerification =
      await verifyTransparencyWitnessSet(
        headWitnesses,
        {
          entries:
            Array.isArray(
              transparencyLog?.entries
            )
              ? transparencyLog.entries
              : [],

          minWitnesses:
            Math.max(
              DECISION_CERTIFICATE_MIN_WITNESSES,
              Number(minWitnesses) || 0
            )
        }
      );

    if (
      !headWitnessVerification.valid
    ) {
      failures.push(
        fail(
          headWitnessVerification.reason
            .includes("EQUIVOCATION")
            ? "TRANSPARENCY_EQUIVOCATION"
            : "HEAD_WITNESS_QUORUM_NOT_REACHED",

          {
            reason:
              headWitnessVerification.reason
          }
        )
      );
    }

  } catch (error) {

    failures.push(
      fail(
        "CERTIFICATE_VERIFICATION_ERROR",
        {
          message:
            error instanceof Error
              ? error.message
              : String(error)
        }
      )
    );
  }

  if (
    transparencyVerification?.valid &&
    trustCheckpoint &&
    transparencyVerification
      .latestCheckpointFingerprint !==
    trustCheckpoint
      .checkpointFingerprint
  ) {
    failures.push(
      fail(
        "TRANSPARENCY_CHECKPOINT_MISMATCH",
        {
          transparency:
            transparencyVerification
              .latestCheckpointFingerprint,

          trust:
            trustCheckpoint
              .checkpointFingerprint
        }
      )
    );
  }

  if (
    certificate.trust?.fabricFingerprint &&
    trustVerification?.fabricFingerprint &&
    certificate.trust.fabricFingerprint !==
    trustVerification.fabricFingerprint
  ) {
    failures.push(
      fail(
        "TRUST_FINGERPRINT_METADATA_MISMATCH"
      )
    );
  }

  if (
    certificate.transparency
      ?.headEntryFingerprint &&
    transparencyVerification
      ?.headEntryFingerprint &&
    certificate.transparency
      .headEntryFingerprint !==
    transparencyVerification
      .headEntryFingerprint
  ) {
    failures.push(
      fail(
        "TRANSPARENCY_HEAD_METADATA_MISMATCH"
      )
    );
  }

  const active =
    evidence?.manifest?.active ||
    null;

  if (
    active?.policyId &&
    certificate.decision?.policyId &&
    active.policyId !==
    certificate.decision.policyId
  ) {
    failures.push(
      fail(
        "DECISION_POLICY_MISMATCH"
      )
    );
  }

  if (
    active?.decisionId &&
    certificate.decision?.decisionId &&
    active.decisionId !==
    certificate.decision.decisionId
  ) {
    failures.push(
      fail(
        "DECISION_ID_MISMATCH"
      )
    );
  }

  if (!failures.length) {
    return {
      valid: true,

      status:
        DECISION_CERTIFICATE_STATUS.VALID,

      reason:
        "DECISION_CERTIFICATE_VERIFIED",

      failures: [],

      certificateFingerprint:
        actualFingerprint,

      components: {
        evidenceValid:
          Boolean(
            evidenceVerification?.valid
          ),

        signatureValid:
          Boolean(
            signatureVerification?.valid
          ),

        trustValid:
          Boolean(
            trustVerification?.valid
          ),

        quorumValid:
          Boolean(
            trustVerification?.quorum >=
            trustVerification?.threshold
          ),

        transparencyValid:
          Boolean(
            transparencyVerification?.valid
          ),

        witnessesValid:
          Boolean(
            witnessVerification?.valid
          ),

        headWitnessesValid:
          Boolean(
            headWitnessVerification?.valid
          )
      },

      evidence:
        evidenceVerification,

      signature:
        signatureVerification,

      trust:
        trustVerification,

      transparency:
        transparencyVerification,

      witnesses:
        headWitnessVerification
    };
  }

  const equivocation =
    failures.some(
      (item) =>
        item.code ===
        "TRANSPARENCY_EQUIVOCATION"
    );

  const replay =
    failures.some(
      (item) =>
        item.code ===
          "EVIDENCE_INVALID" &&
        String(
          item.reason || ""
        ).includes("REPLAY")
    );

  const untrusted =
    failures.some(
      (item) =>
        item.code ===
          "TRUST_INVALID" ||
        item.code ===
          "WITNESSES_INVALID" ||
        item.code ===
          "HEAD_WITNESS_QUORUM_NOT_REACHED"
    );

  return {
    valid: false,

    status:
      equivocation
        ? DECISION_CERTIFICATE_STATUS.EQUIVOCATION
        : replay
          ? DECISION_CERTIFICATE_STATUS.REPLAY_MISMATCH
          : untrusted
            ? DECISION_CERTIFICATE_STATUS.UNTRUSTED
            : DECISION_CERTIFICATE_STATUS.INVALID,

    reason:
      "DECISION_CERTIFICATE_REJECTED",

    failures,

    certificateFingerprint:
      actualFingerprint,

    evidence:
      evidenceVerification,

    signature:
      signatureVerification,

    trust:
      trustVerification,

    transparency:
      transparencyVerification,

    witnesses:
      headWitnessVerification
  };
}

export async function exportDecisionCertificate(
  certificate
) {
  if (!isObject(certificate)) {
    return {
      valid: false,
      reason:
        "CERTIFICATE_INVALID"
    };
  }

  const verification =
    await verifyDecisionCertificate(
      certificate
    );

  if (!verification.valid) {
    return {
      valid: false,
      reason:
        verification.status,

      verification
    };
  }

  return {
    valid: true,

    reason:
      "DECISION_CERTIFICATE_EXPORTED",

    json:
      JSON.stringify(
        canonicalize(certificate),
        null,
        2
      ),

    certificateFingerprint:
      certificate.certificateFingerprint
  };
}

export async function importDecisionCertificate(
  raw
) {
  let parsed;

  try {
    parsed =
      typeof raw === "string"
        ? JSON.parse(raw)
        : raw;

  } catch {
    return {
      valid: false,
      reason:
        "CERTIFICATE_IMPORT_JSON_INVALID"
    };
  }

  const verification =
    await verifyDecisionCertificate(
      parsed
    );

  if (!verification.valid) {
    return {
      valid: false,
      reason:
        verification.status,

      verification
    };
  }

  return {
    valid: true,

    reason:
      "DECISION_CERTIFICATE_IMPORTED",

    certificate:
      Object.freeze(parsed),

    verification
  };
}
