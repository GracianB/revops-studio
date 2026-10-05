import test from "node:test";
import assert from "node:assert/strict";

import {
  DECISION_CERTIFICATE_CONTROL_VERSION,
  normalizeDecisionCertificateControl,
  decisionCertificateBadge,
  decisionCertificateCanExport,
  decisionCertificateCanApprove
} from "../assets/js/decision-certificate-control-v33.js";

test("V33 exposes deterministic version", () => {
  assert.equal(
    DECISION_CERTIFICATE_CONTROL_VERSION,
    "33.0"
  );
});

test("valid certificate is VALID", () => {
  const result = normalizeDecisionCertificateControl({
    valid: true,
    certificateFingerprint: "FP-33"
  });

  assert.equal(result.valid, true);
  assert.equal(result.status, "VALID");
});

test("invalid certificate is terminal", () => {
  const result = normalizeDecisionCertificateControl({
    valid: false,
    status: "INVALID"
  });

  assert.equal(result.terminal, true);
  assert.equal(decisionCertificateCanExport(result), false);
  assert.equal(decisionCertificateCanApprove(result), false);
});

test("badge is deterministic", () => {
  assert.deepEqual(
    decisionCertificateBadge({ valid: true }),
    {
      label: "VALID",
      severity: "success"
    }
  );
});
