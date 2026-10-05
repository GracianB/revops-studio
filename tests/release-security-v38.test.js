import test from "node:test";
import assert from "node:assert/strict";

import {
  SECURITY_HARDENING_V38_VERSION,
  calculateJsonDepth,
  findForbiddenKeys,
  safeParseDecisionCertificate,
  validateCertificateBoundary
} from "../assets/js/release-security-v38.js";

test("V38 version is fixed", () => {
  assert.equal(SECURITY_HARDENING_V38_VERSION, "38.0");
});
test("V38 calculates depth deterministically", () => {
  assert.equal(calculateJsonDepth({ a: { b: 1 } }), 2);
});
test("V38 finds forbidden prototype keys", () => {
  assert.ok(findForbiddenKeys({ safe: { constructor: {} } }).includes("safe.constructor"));
});
test("V38 accepts safe JSON", () => {
  assert.equal(safeParseDecisionCertificate('{"certificateVersion":"32.0"}').valid, true);
});
test("V38 rejects non-string input", () => {
  const result = safeParseDecisionCertificate({});
  assert.equal(result.reason, "INPUT_NOT_STRING");
});
test("V38 rejects invalid JSON", () => {
  assert.equal(safeParseDecisionCertificate("{").reason, "INVALID_JSON");
});
test("V38 rejects oversized payload", () => {
  const input = '{"x":"' + "a".repeat(100) + '"}';
  assert.equal(safeParseDecisionCertificate(input, { maxBytes: 20 }).reason, "PAYLOAD_TOO_LARGE");
});
test("V38 rejects excessive depth", () => {
  const result = safeParseDecisionCertificate(JSON.stringify({ a: { b: { c: { d: 1 } } } }), { maxDepth: 2 });
  assert.equal(result.reason, "DEPTH_LIMIT");
});
test("V38 rejects prototype pollution keys", () => {
  const result = safeParseDecisionCertificate('{"a":{"__proto__":{"polluted":true}}}');
  assert.equal(result.reason, "FORBIDDEN_KEYS");
});
test("V38 boundary accepts a valid V32 identity", () => {
  const result = validateCertificateBoundary({ certificateVersion: "32.0", certificateId: "DC32-TEST", certificateFingerprint: "DC32-" + "A".repeat(43) });
  assert.equal(result.valid, true);
});
test("V38 boundary rejects version substitution", () => {
  const result = validateCertificateBoundary({ certificateVersion: "31.0", certificateId: "DC32-TEST", certificateFingerprint: "DC32-" + "A".repeat(43) });
  assert.equal(result.valid, false);
});
test("V38 boundary rejects malformed fingerprint", () => {
  const result = validateCertificateBoundary({ certificateVersion: "32.0", certificateId: "DC32-TEST", certificateFingerprint: "FAKE" });
  assert.equal(result.valid, false);
});