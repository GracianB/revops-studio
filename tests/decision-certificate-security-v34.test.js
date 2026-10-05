import test from "node:test";
import assert from "node:assert/strict";

import {
  SECURITY_HARDENING_VERSION,
  auditDecisionCertificateShape,
  verifyDecisionCertificateSecurityBoundary,
  classifySecurityFailure
} from "../assets/js/decision-certificate-security-v34.js";

function certificate() {
  return {
    certificateVersion: "32.0",
    certificateId: "DC32-TEST",
    decision: {},
    data: {},
    policy: {},
    replay: {},
    evidence: {},
    signature: {},
    trust: {},
    transparency: {},
    witnesses: {}
  };
}

test("V34 version is deterministic", () => {
  assert.equal(
    SECURITY_HARDENING_VERSION,
    "34.0"
  );
});

test("malformed certificate rejected", () => {
  const result = auditDecisionCertificateShape({});

  assert.equal(result.valid, false);
  assert.equal(result.failClosed, true);
});

test("complete certificate accepted", () => {
  const result = auditDecisionCertificateShape(
    certificate()
  );

  assert.equal(result.valid, true);
});

test("fingerprint mismatch rejected", () => {
  const result =
    verifyDecisionCertificateSecurityBoundary(
      certificate(),
      {
        expectedFingerprint: "A",
        actualFingerprint: "B"
      }
    );

  assert.equal(result.valid, false);
  assert.equal(
    result.reason,
    "FINGERPRINT_MISMATCH"
  );

  assert.equal(
    classifySecurityFailure(result),
    "INTEGRITY_FAILURE"
  );
});
