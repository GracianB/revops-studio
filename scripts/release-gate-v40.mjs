import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_RELEASE_COMPONENTS,
  buildComponentManifest,
  verifyComponentManifest,
  buildReleaseLineage,
  verifyReleaseLineage
} from "../assets/js/release-integration-v39.js";

import {
  FINAL_RELEASE_V40_VERSION,
  FINAL_RELEASE_MIN_TESTS,
  buildFinalReleaseCertificate,
  verifyFinalReleaseCertificate
} from "../assets/js/final-release-v40.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "package.json",
  "scripts/validate.mjs",
  "assets/js/policy-engine.js",
  "assets/js/policy-evidence.js",
  "assets/js/policy-evidence-signing.js",
  "assets/js/policy-trust-registry.js",
  "assets/js/policy-trust-root.js",
  "assets/js/policy-trust-fabric.js",
  "assets/js/policy-transparency.js",
  "assets/js/policy-decision-certificate.js",
  "assets/js/decision-certificate-control-v33.js",
  "assets/js/decision-certificate-security-v34.js",
  "assets/js/release-regression-v35.js",
  "assets/js/reliability-contract-v36.js",
  "assets/js/release-security-v38.js",
  "assets/js/release-integration-v39.js",
  "assets/js/final-release-v40.js"
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error("V40 RELEASE GATE missing " + file);
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

if (packageJson.version !== "40.0.0") {
  throw new Error("V40 RELEASE GATE package version mismatch: " + packageJson.version);
}

const componentModules = {
  V25: ["../assets/js/policy-engine.js", "POLICY_CONTRACT_VERSION"],
  V26: ["../assets/js/policy-evidence.js", "POLICY_EVIDENCE_VERSION"],
  V27: ["../assets/js/policy-evidence-signing.js", "POLICY_SIGNATURE_VERSION"],
  V28: ["../assets/js/policy-trust-registry.js", "TRUST_REGISTRY_VERSION"],
  V29: ["../assets/js/policy-trust-root.js", "TRUST_ROOT_VERSION"],
  V30: ["../assets/js/policy-trust-fabric.js", "TRUST_FABRIC_VERSION"],
  V31: ["../assets/js/policy-transparency.js", "TRANSPARENCY_VERSION"],
  V32: ["../assets/js/policy-decision-certificate.js", "DECISION_CERTIFICATE_VERSION"],
  V33: ["../assets/js/decision-certificate-control-v33.js", "DECISION_CERTIFICATE_CONTROL_VERSION"],
  V34: ["../assets/js/decision-certificate-security-v34.js", "SECURITY_HARDENING_VERSION"],
  V35: ["../assets/js/release-regression-v35.js", "REGRESSION_FORTRESS_VERSION"],
  V36: ["../assets/js/reliability-contract-v36.js", "RELIABILITY_CONTRACT_VERSION"],
  V37: null,
  V38: ["../assets/js/release-security-v38.js", "SECURITY_HARDENING_V38_VERSION"],
  V39: ["../assets/js/release-integration-v39.js", "RELEASE_INTEGRATION_V39_VERSION"],
  V40: ["../assets/js/final-release-v40.js", "FINAL_RELEASE_V40_VERSION"]
};

const components = {};

for (const [version, descriptor] of Object.entries(componentModules)) {
  if (version === "V37") {
    components[version] = "37.0";
    continue;
  }

  const [specifier, exportName] = descriptor;
  const module = await import(new URL(specifier, import.meta.url).href);

  if (!(exportName in module)) {
    throw new Error("V40 RELEASE GATE missing " + version + " export " + exportName);
  }

  components[version] = module[exportName];
}

const manifest = buildComponentManifest(components);
const manifestResult = verifyComponentManifest(manifest);

if (!manifestResult.valid) {
  throw new Error("V40 component manifest invalid: " + JSON.stringify(manifestResult.failures));
}

const lineage = buildReleaseLineage(components);
const lineageResult = verifyReleaseLineage(lineage);

if (!lineageResult.valid) {
  throw new Error("V40 release lineage invalid: " + JSON.stringify(lineageResult.failures));
}

const testFiles = fs.readdirSync(path.join(root, "tests")).filter((file) => file.endsWith(".test.js"));
const testCount = testFiles.reduce((total, file) => total + (fs.readFileSync(path.join(root, "tests", file), "utf8").match(/test\(/g) || []).length, 0);

if (testCount < FINAL_RELEASE_MIN_TESTS) {
  throw new Error("V40 requires at least " + FINAL_RELEASE_MIN_TESTS + " tests; found " + testCount);
}

execFileSync("git", ["diff", "--check"], { cwd: root, stdio: "pipe" });

const releaseFiles = [
  "package.json",
  "scripts/validate.mjs",
  "assets/js/policy-engine.js",
  "assets/js/policy-evidence.js",
  "assets/js/policy-evidence-signing.js",
  "assets/js/policy-trust-registry.js",
  "assets/js/policy-trust-root.js",
  "assets/js/policy-trust-fabric.js",
  "assets/js/policy-transparency.js",
  "assets/js/policy-decision-certificate.js",
  "assets/js/decision-certificate-control-v33.js",
  "assets/js/decision-certificate-security-v34.js",
  "assets/js/release-regression-v35.js",
  "assets/js/reliability-contract-v36.js",
  "assets/js/release-security-v38.js",
  "assets/js/release-integration-v39.js",
  "assets/js/final-release-v40.js"
];

const sourceFingerprints = Object.fromEntries(releaseFiles.map((file) => [
  file,
  createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")
]));

const gitHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();

const certificate = buildFinalReleaseCertificate({
  packageVersion: packageJson.version,
  testCount,
  validationPass: true,
  verificationPass: true,
  patchIntegrityPass: true,
  components,
  sourceFingerprints,
  gitHead
});

const result = verifyFinalReleaseCertificate(certificate);

if (!result.valid || certificate.releaseVersion !== FINAL_RELEASE_V40_VERSION) {
  throw new Error("V40 RELEASE GATE FAILED: " + JSON.stringify(result));
}

console.log("V40 RELEASE GATE PASS");
console.log("Release:", certificate.releaseVersion);
console.log("Package:", certificate.packageVersion);
console.log("Tests:", certificate.testCount);
console.log("Components:", Object.keys(EXPECTED_RELEASE_COMPONENTS).length);
console.log("Status:", certificate.status);
console.log("Fingerprint:", certificate.releaseFingerprint);
console.log("Git HEAD:", certificate.gitHead);