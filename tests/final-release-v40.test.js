import test from "node:test";
import assert from "node:assert/strict";

import {
  FINAL_RELEASE_V40_VERSION,
  FINAL_RELEASE_SCHEMA,
  FINAL_RELEASE_MIN_TESTS,
  buildFinalReleaseCertificate,
  verifyFinalReleaseCertificate,
  fingerprintFinalRelease,
  canonicalizeFinalRelease,
  exportFinalReleaseCertificate
} from "../assets/js/final-release-v40.js";

const components = {
  V25: "25.0", V26: "26.0", V27: "27.0", V28: "28.0",
  V29: "29.0", V30: "30.0", V31: "31.0", V32: "32.0",
  V33: "33.0", V34: "34.0", V35: "35.0", V36: "36.0",
  V37: "37.0", V38: "38.0", V39: "39.0", V40: "40.0"
};

function input() {
  return {
    packageVersion: "40.0.0",
    testCount: FINAL_RELEASE_MIN_TESTS,
    validationPass: true,
    verificationPass: true,
    patchIntegrityPass: true,
    components,
    sourceFingerprints: {
      "package.json": "sha256:test"
    },
    gitHead: "abc123"
  };
}

test("V40 exposes the definitive contract", () => {
  assert.equal(FINAL_RELEASE_V40_VERSION, "40.0");
  assert.equal(FINAL_RELEASE_SCHEMA, "revops-studio-final-release");
});

test("V40 canonicalization sorts object keys", () => {
  assert.equal(
    canonicalizeFinalRelease({ b: 2, a: 1 }),
    '{"a":1,"b":2}'
  );
});

test("V40 fingerprint is deterministic", () => {
  const a = buildFinalReleaseCertificate(input());
  const b = buildFinalReleaseCertificate(input());
  assert.equal(a.releaseFingerprint, b.releaseFingerprint);
});

test("V40 fingerprint changes when release data changes", () => {
  const a = buildFinalReleaseCertificate(input());
  const changed = input();
  changed.gitHead = "different";
  const b = buildFinalReleaseCertificate(changed);
  assert.notEqual(a.releaseFingerprint, b.releaseFingerprint);
});

test("V40 builds a certified release", () => {
  const certificate = buildFinalReleaseCertificate(input());
  assert.equal(certificate.status, "CERTIFIED");
});

test("V40 verifies a certified release", () => {
  const certificate = buildFinalReleaseCertificate(input());
  const result = verifyFinalReleaseCertificate(certificate);
  assert.equal(result.valid, true);
  assert.equal(result.status, "FINAL_RELEASE_CERTIFIED");
});

test("V40 detects fingerprint tampering", () => {
  const certificate = buildFinalReleaseCertificate(input());
  certificate.releaseFingerprint = "tampered";
  const result = verifyFinalReleaseCertificate(certificate);
  assert.equal(result.valid, false);
  assert.ok(
    result.failures.some(
      (failure) => failure.code === "RELEASE_FINGERPRINT_MISMATCH"
    )
  );
});

test("V40 rejects package version downgrade", () => {
  const data = input();
  data.packageVersion = "39.0.0";
  const certificate = buildFinalReleaseCertificate(data);
  assert.equal(
    verifyFinalReleaseCertificate(certificate).valid,
    false
  );
});

test("V40 rejects insufficient tests", () => {
  const data = input();
  data.testCount = FINAL_RELEASE_MIN_TESTS - 1;
  const certificate = buildFinalReleaseCertificate(data);
  assert.equal(
    verifyFinalReleaseCertificate(certificate).valid,
    false
  );
});

test("V40 rejects a failed gate", () => {
  const data = input();
  data.validationPass = false;
  const certificate = buildFinalReleaseCertificate(data);
  assert.equal(certificate.status, "BLOCKED");
});

test("V40 rejects component substitution", () => {
  const data = input();
  data.components = { ...components, V31: "30.0" };
  const certificate = buildFinalReleaseCertificate(data);
  assert.equal(
    verifyFinalReleaseCertificate(certificate).valid,
    false
  );
});

test("V40 export is valid JSON", () => {
  const certificate = buildFinalReleaseCertificate(input());
  const exported = exportFinalReleaseCertificate(certificate);
  assert.deepEqual(JSON.parse(exported), certificate);
});

test("V40 fingerprint ignores embedded fingerprint", () => {
  const certificate = buildFinalReleaseCertificate(input());
  const fingerprint = fingerprintFinalRelease(certificate);
  certificate.releaseFingerprint = "different";
  assert.equal(
    fingerprintFinalRelease(certificate),
    fingerprint
  );
});
