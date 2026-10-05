import assert from "node:assert/strict";

import {
  CERTIFICATE_VERSION,
  buildDecisionCertificate,
  verifyDecisionCertificate,
  fingerprintCertificate
} from "./decision-certificate-v32.mjs";

const certificate =
  buildDecisionCertificate({

    certificateId:
      "DC32-REVOPS",

    decision: {
      decisionId:
        "DEC32-001",
      result:
        "APPROVED",
      status:
        "APPROVED"
    },

    data: {
      datasetFingerprint:
        "DATA32",
      rowCount:
        1
    },

    policy: {
      policyFingerprint:
        "POLICY32",
      policyVersion:
        "V32"
    },

    replay: {
      replayFingerprint:
        "REPLAY32",
      reproducible:
        true
    },

    evidence: {
      evidenceFingerprint:
        "EVIDENCE32"
    },

    signature: {
      signatureFingerprint:
        "SIGNATURE32",
      trustedSignerId:
        "RF30-TEST"
    },

    trust: {
      rootSetFingerprint:
        "ROOT30",
      quorumFingerprint:
        "QUORUM30",
      threshold:
        "2/3"
    },

    transparency: {
      headSequence:
        1,
      headFingerprint:
        "TL31-001",
      transparencyFingerprint:
        "TL31"
    },

    witnesses: {
      required:
        1,
      observed:
        1,
      witnessFingerprints:
        ["W31-001"]
    }
  });

assert.equal(
  certificate.certificateVersion,
  CERTIFICATE_VERSION
);

assert.match(
  certificate.certificateFingerprint,
  /^[a-f0-9]{64}$/
);

assert.equal(
  fingerprintCertificate(
    certificate
  ),
  certificate.certificateFingerprint
);

const valid =
  verifyDecisionCertificate(
    certificate
  );

assert.equal(
  valid.valid,
  true
);

assert.equal(
  valid.status,
  "CERTIFICATE_VALID"
);

const fingerprintTamper =
  structuredClone(
    certificate
  );

fingerprintTamper.certificateFingerprint =
  "0000000000000000000000000000000000000000000000000000000000000000";

const fingerprintTamperResult =
  verifyDecisionCertificate(
    fingerprintTamper
  );

assert.equal(
  fingerprintTamperResult.valid,
  false
);

assert.ok(
  fingerprintTamperResult.failures.some(
    (item) =>
      item.code ===
      "CERTIFICATE_FINGERPRINT_EMBEDDED_MISMATCH"
  )
);

const dataTamper =
  structuredClone(
    certificate
  );

dataTamper.data.rowCount =
  999;

const dataTamperResult =
  verifyDecisionCertificate(
    dataTamper
  );

assert.equal(
  dataTamperResult.valid,
  false
);

const replayFailure =
  verifyDecisionCertificate(
    certificate,
    {
      replayVerifier: () => ({
        valid: false,
        reason:
          "REPLAY_MISMATCH"
      })
    }
  );

assert.equal(
  replayFailure.status,
  "CERTIFICATE_REPLAY_MISMATCH"
);

const trustFailure =
  verifyDecisionCertificate(
    certificate,
    {
      trustVerifier: () => ({
        valid: false,
        quorumValid:
          false,
        reason:
          "QUORUM_INVALID"
      })
    }
  );

assert.equal(
  trustFailure.status,
  "CERTIFICATE_UNTRUSTED"
);

const equivocationFailure =
  verifyDecisionCertificate(
    certificate,
    {
      transparencyVerifier: () => ({
        valid: false,
        status:
          "TRANSPARENCY_EQUIVOCATION"
      })
    }
  );

assert.equal(
  equivocationFailure.status,
  "CERTIFICATE_EQUIVOCATION"
);

console.log("");
console.log(
  "V32 SMOKE TEST: PASS"
);

console.log(
  "CERTIFICATE:",
  certificate.certificateFingerprint
);

console.log(
  "FINGERPRINT TAMPER: DETECTED"
);

console.log(
  "DATA TAMPER: DETECTED"
);

console.log(
  "REPLAY FAILURE: DETECTED"
);

console.log(
  "TRUST FAILURE: DETECTED"
);

console.log(
  "EQUIVOCATION: DETECTED"
);
