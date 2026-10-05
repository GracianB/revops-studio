import { createHash } from "node:crypto";

import {
  EXPECTED_RELEASE_COMPONENTS,
  buildComponentManifest,
  verifyComponentManifest,
  buildReleaseLineage,
  verifyReleaseLineage
} from "./release-integration-v39.js";

export const FINAL_RELEASE_V40_VERSION = "40.0";
export const FINAL_RELEASE_SCHEMA = "revops-studio-final-release";
export const FINAL_RELEASE_MIN_TESTS = 300;

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }

  return value;
}

export function canonicalizeFinalRelease(release) {
  return JSON.stringify(canonicalize(release));
}

export function fingerprintFinalRelease(release) {
  const copy = structuredClone(release);
  delete copy.releaseFingerprint;

  return createHash("sha256")
    .update(canonicalizeFinalRelease(copy), "utf8")
    .digest("hex");
}

export function buildFinalReleaseCertificate({
  packageVersion,
  testCount,
  validationPass,
  verificationPass,
  patchIntegrityPass,
  components = {},
  sourceFingerprints = {},
  gitHead = null
} = {}) {
  const componentManifest = buildComponentManifest(components);
  const lineage = buildReleaseLineage(components);

  const certified =
    packageVersion === "40.0.0" &&
    Number.isInteger(testCount) &&
    testCount >= FINAL_RELEASE_MIN_TESTS &&
    validationPass === true &&
    verificationPass === true &&
    patchIntegrityPass === true &&
    verifyComponentManifest(componentManifest).valid === true &&
    verifyReleaseLineage(lineage).valid === true;

  const certificate = {
    schema: FINAL_RELEASE_SCHEMA,
    releaseVersion: FINAL_RELEASE_V40_VERSION,
    packageVersion,
    testCount,
    gates: {
      validationPass: validationPass === true,
      verificationPass: verificationPass === true,
      patchIntegrityPass: patchIntegrityPass === true
    },
    componentManifest,
    lineage,
    sourceFingerprints: Object.fromEntries(
      Object.entries(sourceFingerprints).sort()
    ),
    gitHead,
    status: certified ? "CERTIFIED" : "BLOCKED"
  };

  return {
    ...certificate,
    releaseFingerprint: fingerprintFinalRelease(certificate)
  };
}

export function verifyFinalReleaseCertificate(certificate) {
  if (!certificate || typeof certificate !== "object") {
    return {
      valid: false,
      status: "FINAL_RELEASE_MALFORMED",
      failures: [{ code: "ROOT_NOT_OBJECT" }],
      releaseFingerprint: null
    };
  }

  const actualFingerprint = fingerprintFinalRelease(certificate);
  const failures = [];

  if (certificate.schema !== FINAL_RELEASE_SCHEMA) {
    failures.push({ code: "SCHEMA_MISMATCH" });
  }

  if (certificate.releaseVersion !== FINAL_RELEASE_V40_VERSION) {
    failures.push({ code: "RELEASE_VERSION_MISMATCH" });
  }

  if (certificate.packageVersion !== "40.0.0") {
    failures.push({ code: "PACKAGE_VERSION_MISMATCH" });
  }

  if (
    !Number.isInteger(certificate.testCount) ||
    certificate.testCount < FINAL_RELEASE_MIN_TESTS
  ) {
    failures.push({
      code: "TEST_COUNT_INSUFFICIENT",
      minimum: FINAL_RELEASE_MIN_TESTS,
      actual: certificate.testCount
    });
  }

  if (certificate.gates?.validationPass !== true) {
    failures.push({ code: "VALIDATION_GATE_FAILED" });
  }

  if (certificate.gates?.verificationPass !== true) {
    failures.push({ code: "VERIFICATION_GATE_FAILED" });
  }

  if (certificate.gates?.patchIntegrityPass !== true) {
    failures.push({ code: "PATCH_INTEGRITY_GATE_FAILED" });
  }

  if (!verifyComponentManifest(certificate.componentManifest).valid) {
    failures.push({ code: "COMPONENT_MANIFEST_INVALID" });
  }

  if (!verifyReleaseLineage(certificate.lineage).valid) {
    failures.push({ code: "RELEASE_LINEAGE_INVALID" });
  }

  if (
    certificate.releaseFingerprint &&
    certificate.releaseFingerprint !== actualFingerprint
  ) {
    failures.push({
      code: "RELEASE_FINGERPRINT_MISMATCH",
      expected: certificate.releaseFingerprint,
      actual: actualFingerprint
    });
  }

  const valid =
    failures.length === 0 &&
    certificate.status === "CERTIFIED";

  return {
    valid,
    status: valid
      ? "FINAL_RELEASE_CERTIFIED"
      : "FINAL_RELEASE_BLOCKED",
    failures,
    releaseFingerprint: actualFingerprint
  };
}

export function exportFinalReleaseCertificate(certificate) {
  return JSON.stringify(certificate, null, 2);
}

export const FINAL_RELEASE_COMPONENT_COUNT =
  Object.keys(EXPECTED_RELEASE_COMPONENTS).length;
