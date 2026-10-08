import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "index.html",
  "laboratorio.html",
  "assets/js/site.js",
  "gracias.html",
  "README.md",
  "assets/css/main.css",
  "assets/js/app.js",
  "assets/js/thanks.js",
  "assets/js/revops-engine.js",
  "assets/js/csv-utils.js",
  "tests/revops-engine.test.js",
  "tests/outcome-engine.test.js",
  "assets/js/execution-adapter.js",
  "assets/js/outcome-engine.js",
  "assets/js/calibration-engine.js",
  "assets/js/adaptive-calibration-engine.js",
  "tests/adaptive-calibration-engine.test.js",
  "assets/js/policy-engine.js",
  "tests/policy-engine.test.js",
  "assets/js/policy-evidence.js",
  "tests/policy-evidence.test.js",
  "assets/js/policy-evidence-signing.js",
  "tests/policy-evidence-signing.test.js",
  "assets/js/policy-trust-registry.js",
  "tests/policy-trust-registry.test.js",
  "assets/js/decision-certificate-control-v33.js",
  "tests/decision-certificate-control-v33.test.js",
  "assets/js/decision-certificate-security-v34.js",
  "tests/decision-certificate-security-v34.test.js",
  "assets/js/release-regression-v35.js",
  "tests/release-regression-v35.test.js",
  "assets/js/reliability-contract-v36.js",
  "tests/reliability-contract-v36.test.js",
  "assets/js/release-security-v38.js",
  "tests/release-security-v38.test.js",
  "assets/js/release-integration-v39.js",
  "tests/release-integration-v39.test.js",
  "assets/js/final-release-v40.js",
  "tests/final-release-v40.test.js",
  "scripts/release-gate-v40.mjs",
  "V40-FINAL-RELEASE.md",
];

const fail = (message) => {
  console.error("VALIDATION FAIL:", message);
  process.exit(1);
};

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) fail("missing " + file);
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const labHtml = fs.readFileSync(path.join(root, "laboratorio.html"), "utf8");
const siteJs = fs.readFileSync(path.join(root, "assets/js/site.js"), "utf8");
const pages = [["index.html", html], ["laboratorio.html", labHtml]];
const ids = pages.flatMap(([, page]) => [...page.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
for (const [filename,page] of pages) {
  const pageIds = [...page.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  if (pageIds.length !== new Set(pageIds).size) fail(filename + " duplicate ids");
  for (const match of page.matchAll(/href="#([^"]+)"/g)) {
    if (!pageIds.includes(match[1])) fail(filename + " missing anchor: " + match[1]);
  }
}
const appJs = fs.readFileSync(path.join(root, "assets/js/app.js"), "utf8");
for (const [name,code] of [["app",appJs],["site",siteJs]]) {
  const domSelectors = [...code.matchAll(/qs\(\s*["']#([A-Za-z0-9_-]+)["']/g)].map(m => m[1]);
  const missing = [...new Set(domSelectors)].filter(id => !ids.includes(id));
  if (missing.length) fail(name + " references missing DOM ids: " + missing.join(","));
}
const guidedTargets = [...appJs.matchAll(/target:\s*"([A-Za-z0-9_-]+)"/g)].map(m => m[1]);
const missingGuidedTargets = guidedTargets.filter(id => !labHtml.includes('id="' + id + '"'));
if (missingGuidedTargets.length) fail("lab guided targets missing: " + missingGuidedTargets.join(","));
const guidedSteps = [...labHtml.matchAll(/data-guided-step="(\d+)"/g)].map(m => Number(m[1]));
if (guidedSteps.join(",") !== "0,1,2,3") fail("lab guided steps missing");
const requiredV18Ids = [
  "decision-trace-title", "decisionTraceEmpty", "decisionTraceContent",
  "traceState", "traceRunId", "traceInputs", "traceDecision", "traceCommercial",
  "traceRisk", "traceProposal", "traceApproval", "traceExecution", "ownerMatrix",
  "integration-boundary-title",
  "workflow-control-title", "workflowStatus", "workflowMeta", "workflowReady",
  "workflowApproval", "workflowBlocked", "workflowAdapter", "workflowFingerprint",
  "workflowPlan", "simulateWorkflow", "exportRunArtifact", "replayArtifact",
  "verifyReplayArtifact", "replayStatus",
  "workflow-impact-title", "impactProposed", "impactApplied", "impactPending",
  "impactQualificationDelta", "impactStageDelta", "previewWorkflowImpact",
  "execution-ledger-title", "ledgerStatus", "ledgerMeta", "ledgerSequence",
  "ledgerHead", "ledgerApprovals", "ledgerContracts", "ledgerSimulations",
  "replayLedger", "ledgerEvents",
  "feedback-title", "feedbackLead", "feedbackType", "feedbackActualValue",
  "calibration-v20-title", "calibrationV20Severity", "calibrationV20Current",
  "calibrationV20Previous", "calibrationV20CalibrationDelta", "calibrationV20BrierDelta",
  "calibrationV20Alerts", "calibrationV20Recommendations",
  "calibrationV20WindowDays", "calibrationV20MinSamples",
  "calibrationV20MinGroupSamples", "resetCalibrationV20",
  "calibration-v25-title", "calibrationV25Status", "calibrationV25Multiplier",
  "calibrationV25Improvement", "calibrationV25Active", "calibrationV25Reason", "calibrationV25Replay", "calibrationV25Rows", "calibrationV25Integrity", "calibrationV25PolicyId", "calibrationV25Deviation", "calibrationV25Actor", "calibrationV25SourceRun", "calibrationV25Lineage", "policyV25Actor", "policyV25Rationale", "calibrationV25Replay", "calibrationV25PolicyId", "calibrationV25Deviation",
  "calibrationV26Manifest", "calibrationV26Verification", "policyEvidenceV26Status",
  "policy-trust-v28-title", "policyTrustV28Registry", "policyTrustV28KeyInput", "policyTrustV28State",
  "policyTrustV28NewJwk", "policyTrustV28Status", "registerTrustedSignerV28",
  "retireTrustedSignerV28", "revokeTrustedSignerV28", "rotateTrustedSignerV28",
  "verifyTrustedEvidenceV28", "exportTrustRegistryV28", "importTrustedEvidenceV28", "importTrustRegistryV28",
  "policy-trust-root-v29-title", "policyTrustRootV29", "policyTrustRootV29Pin",
  "policy-trust-fabric-v30-title", "policyTrustFabricV30Quorum", "policyTrustFabricV30Roots",
  "policyTrustFabricV30Head", "policyTrustFabricV30Threshold", "policyTrustFabricV30Pins",
  "policyTrustFabricV30Status", "generateTrustFabricV30", "signTrustFabricV30",
  "verifyTrustFabricV30", "verifyFabricAnchoredEvidenceV30", "exportTrustFabricV30",
  "importTrustFabricV30",
  "policy-transparency-v31-title", "policyTransparencyV31Entries", "policyTransparencyV31Head",
  "policyTransparencyV31Witnesses", "policyTransparencyV31HeadPin", "policyTransparencyV31MinWitnesses",
  "policyTransparencyV31Status", "generateTransparencyWitnessV31", "anchorTrustFabricV31",
  "witnessTransparencyHeadV31", "verifyTransparencyV31", "exportTransparencyV31",
  "exportTransparencyReceiptV31", "importTransparencyV31",
  "policy-decision-certificate-title", "policyDecisionCertificateV32Id", "policyDecisionCertificateV32Head", "policyDecisionCertificateV32Quorum", "policyDecisionCertificateV32Status", "buildDecisionCertificateV32", "verifyDecisionCertificateV32", "exportDecisionCertificateV32", "importDecisionCertificateV32",
  "policyTrustRootV29RegistryHead", "policyTrustRootV29Status", "generateTrustRootV29",
  "signTrustRegistryV29", "verifyTrustRootV29", "verifyRootAnchoredEvidenceV29",
  "exportTrustRootV29", "importTrustRootV29",
  "exportPolicyEvidenceV26", "importPolicyEvidenceV26",
  "approvePolicyV25", "rejectPolicyV25", "rollbackPolicyV25",
  "feedbackActualRevenue", "feedbackResponseHours", "recordFeedback",
  "feedbackStatus", "feedbackTotal", "feedbackPositiveRate", "feedbackWinRate",
  "feedbackVariance", "feedbackCalibration", "feedbackSla", "feedbackEffectiveness"
];
const missingV18Ids = requiredV18Ids.filter((id) => !labHtml.includes('id="' + id + '"'));
if (missingV18Ids.length) fail("V18 surface missing DOM ids: " + missingV18Ids.join(", "));
const localRefs = pages.flatMap(([filename,page]) => [...page.matchAll(/(?:href|src)="(\.{0,2}\/[^"]+)"/g)]
  .map(m => [filename, m[1].split("#")[0].split("?")[0]]).filter(([,ref]) => Boolean(ref)));
for (const [filename,ref] of localRefs) {
  if (!fs.existsSync(path.normalize(path.join(root,ref)))) fail(filename + " broken local reference: " + ref);
}
for (const [filename,page] of pages) {
  if (/href="javascript:/i.test(page)) fail(filename + " javascript: URL");
  const unsafe = [...page.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)]
    .some(m => !/rel="[^"]*noopener/i.test(m[0]));
  if (unsafe) fail(filename + ' target="_blank" without noopener');
}

const secretPatterns = [
  /ghp_[A-Za-z0-9_]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /AIza[0-9A-Za-z_-]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY/,
  /Bearer [A-Za-z0-9._-]{20,}/i
];

const localImports = [...appJs.matchAll(/from\s*["'](\.\/[^"']+)["']/g)].map((match) => match[1]);
for (const ref of localImports) {
  const target = path.normalize(path.join(root, "assets/js", ref));
  if (!fs.existsSync(target)) fail("broken JS import: " + ref);
}

const engineJs = fs.readFileSync(path.join(root, "assets/js/revops-engine.js"), "utf8");
const engineExports = new Set(
  [...engineJs.matchAll(/export\s+(?:function|const|let|var|class)\s+([A-Za-z0-9_]+)/g)].map((match) => match[1])
);
const engineImportBlock = appJs.match(/import\s*\{([^}]*)\}\s*from\s*["']\.\/revops-engine\.js["']/);
if (!engineImportBlock) fail("app.js engine import block missing");
const importedEngineNames = engineImportBlock[1]
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const missingEngineExports = importedEngineNames.filter((name) => !engineExports.has(name));
if (missingEngineExports.length) fail("app.js references missing engine exports: " + missingEngineExports.join(", "));

const adapterImport = appJs.includes('from "./execution-adapter.js"');
if (!adapterImport) fail("app.js execution adapter import missing");
const outcomeImport = appJs.includes('from "./outcome-engine.js"');
if (!outcomeImport) fail("app.js outcome engine import missing");

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (packageJson.version !== "40.0.0") fail("package version must be 40.0.0");
const testFiles = fs.readdirSync(path.join(root, "tests"))
  .filter((file) => file.endsWith(".test.js"));
const declaredTests = testFiles.reduce((total, file) =>
  total + (fs.readFileSync(path.join(root, "tests", file), "utf8").match(/test\(/g) || []).length, 0);
if (declaredTests < 300) fail("V40 regression suite must contain at least 300 tests");
const ledgerExports = [
  "createExecutionLedger",
  "appendExecutionEvent",
  "verifyExecutionLedger",
  "replayExecutionLedger",
  "buildExecutionLedger"
];
for (const expected of ledgerExports) {
  if (!engineExports.has(expected)) fail("missing V18 ledger export: " + expected);
}

const adapterJs = fs.readFileSync(path.join(root, "assets/js/execution-adapter.js"), "utf8");
const adapterExports = new Set(
  [...adapterJs.matchAll(/export\s+(?:function|const|let|var|class)\s+([A-Za-z0-9_]+)/g)].map((match) => match[1])
);
for (const expected of ["createExecutionEnvelope", "createIntegrationContract", "validateIntegrationContract", "simulateExecution", "simulateIntegrationContract", "createExecutionEvent", "EXECUTION_ADAPTER_STATUS"]) {
  if (!adapterExports.has(expected)) fail("missing execution adapter export: " + expected);
}

const outcomeJs = fs.readFileSync(path.join(root, "assets/js/outcome-engine.js"), "utf8");
const outcomeExports = new Set(
  [...outcomeJs.matchAll(/export\s+(?:function|const|let|var|class)\s+([A-Za-z0-9_]+)/g)].map((match) => match[1])
);
for (const expected of [
  "OUTCOME_TYPES", "POSITIVE_OUTCOMES", "validateOutcome", "createOutcomeRecord",
  "fingerprintOutcomes", "createOutcomeLedger", "appendOutcome", "buildOutcomeSummary",
  "actionEffectiveness", "calibrateForecast", "buildFeedbackAnalysis", "createOutcomeEvent"
]) {
  if (!outcomeExports.has(expected)) fail("missing V18 outcome export: " + expected);
}



const policyJs = fs.readFileSync(path.join(root, "assets/js/policy-engine.js"), "utf8");
if (!policyJs.includes('export const POLICY_CONTRACT_VERSION = "25.0";')) fail("policy contract must be 25.0");
for (const expected of ["POLICY_ABSOLUTE_MIN", "POLICY_ABSOLUTE_MAX", "buildReplayFingerprint", "buildRowsFingerprint", "verifyPolicyProposal", "buildPolicyProposalFingerprint", "buildPolicyLineageFingerprint", "buildPolicyInstanceFingerprint", "verifyPolicyLedger", "verifyActivePolicy", "replayPolicyLedger", "normaliseActor", "normaliseRationale"]) {
  if (!policyJs.includes(expected)) fail("missing V25 policy integrity export: " + expected);
}

const policyEvidenceJs = fs.readFileSync(path.join(root, "assets/js/policy-evidence.js"), "utf8");
if (!policyEvidenceJs.includes('export const POLICY_EVIDENCE_VERSION = "26.0";')) {
  fail("policy evidence version must be 26.0");
}
for (const expected of [
  "POLICY_EVIDENCE_SCHEMA",
  "buildPolicyEvidenceManifest",
  "buildPolicyEvidenceBundle",
  "verifyPolicyEvidenceBundle",
  "serialisePolicyEvidenceBundle"
]) {
  if (!policyEvidenceJs.includes(expected)) fail("missing V26 policy evidence export: " + expected);
}

const policySigningJs = fs.readFileSync(path.join(root, "assets/js/policy-evidence-signing.js"), "utf8");
if (!policySigningJs.includes('export const POLICY_SIGNATURE_VERSION = "27.0";')) {
  fail("policy signature version must be 27.0");
}
for (const expected of [
  "POLICY_SIGNATURE_ALGORITHM",
  "generatePolicyEvidenceKeyPair",
  "importPolicyEvidencePrivateKey",
  "buildPolicyEvidenceSigningPayload",
  "signPolicyEvidenceBundle",
  "verifyPolicyEvidenceSignature",
  "serialiseSignedPolicyEvidenceBundle"
]) {
  if (!policySigningJs.includes(expected)) fail("missing V27 policy signature export: " + expected);
}


const policyTrustJs = fs.readFileSync(path.join(root, "assets/js/policy-trust-registry.js"), "utf8");
if (!policyTrustJs.includes('export const TRUST_REGISTRY_VERSION = "28.0";')) {
  fail("trust registry version must be 28.0");
}
for (const expected of [
  "TRUST_REGISTRY_SCHEMA",
  "TRUST_STATES",
  "TRUST_ACTIONS",
  "createTrustRegistry",
  "buildTrustedSignerFingerprint",
  "registerTrustedSigner",
  "retireTrustedSigner",
  "revokeTrustedSigner",
  "rotateTrustedSigner",
  "resolveTrustedSigner",
  "verifyTrustRegistry",
  "verifyTrustedPolicyEvidence",
  "exportTrustRegistry",
  "importTrustRegistry"
]) {
  if (!policyTrustJs.includes(expected)) fail("missing V28 trust registry export: " + expected);
}

const trustRootJs = fs.readFileSync(path.join(root, "assets/js/policy-trust-root.js"), "utf8");
if (!trustRootJs.includes('export const TRUST_ROOT_VERSION = "29.0";')) {
  fail("trust root version must be 29.0");
}
for (const expected of [
  "TRUST_ROOT_SCHEMA",
  "TRUST_ROOT_ALGORITHM",
  "buildTrustRootKeyFingerprint",
  "generateTrustRootKeyPair",
  "importTrustRootPrivateKey",
  "buildTrustRegistryRootPayload",
  "signTrustRegistrySnapshot",
  "verifySignedTrustRegistrySnapshot",
  "verifyTrustedPolicyEvidenceViaRoot",
  "exportSignedTrustRegistrySnapshot",
  "importSignedTrustRegistrySnapshot"
]) {
  if (!trustRootJs.includes(expected)) fail("missing V29 trust root export: " + expected);
}

const trustFabricJs = fs.readFileSync(path.join(root, "assets/js/policy-trust-fabric.js"), "utf8");
if (!trustFabricJs.includes('export const TRUST_FABRIC_VERSION = "30.0";')) {
  fail("trust fabric version must be 30.0");
}
for (const expected of [
  "TRUST_FABRIC_SCHEMA",
  "TRUST_FABRIC_ALGORITHM",
  "generateTrustFabricKeySet",
  "createTrustFabric",
  "buildTrustFabricPayload",
  "signTrustFabricCheckpoint",
  "verifyTrustFabricCheckpoint",
  "verifyTrustFabricCheckpointSet",
  "verifyTrustedPolicyEvidenceViaFabric",
  "buildTrustFabricVerificationReceipt",
  "exportTrustFabricCheckpoint",
  "importTrustFabricCheckpoint"
]) {
  if (!trustFabricJs.includes(expected)) fail("missing V30 trust fabric export: " + expected);
}


const decisionCertificateJs = fs.readFileSync(path.join(root, "assets/js/policy-decision-certificate.js"), "utf8");
if (!decisionCertificateJs.includes('export const DECISION_CERTIFICATE_VERSION = "32.0";')) {
  fail("decision certificate version must be 32.0");
}
for (const expected of [
  "DECISION_CERTIFICATE_SCHEMA",
  "DECISION_CERTIFICATE_ALGORITHM",
  "DECISION_CERTIFICATE_STATUS",
  "canonicalizeDecisionCertificate",
  "fingerprintDecisionCertificate",
  "buildDecisionCertificate",
  "verifyDecisionCertificate",
  "exportDecisionCertificate",
  "importDecisionCertificate"
]) {
  if (!decisionCertificateJs.includes(expected)) fail("missing V32 decision certificate export: " + expected);
}

const transparencyJs = fs.readFileSync(path.join(root, "assets/js/policy-transparency.js"), "utf8");
if (!transparencyJs.includes('export const TRANSPARENCY_VERSION = "31.0";')) {
  fail("transparency version must be 31.0");
}
for (const expected of [
  "TRANSPARENCY_SCHEMA",
  "TRANSPARENCY_ALGORITHM",
  "createTransparencyLog",
  "buildTransparencyEntry",
  "appendTransparencyCheckpoint",
  "generateTransparencyWitnessKeyPair",
  "buildTransparencyWitnessPayload",
  "signTransparencyWitnessAttestation",
  "verifyTransparencyWitnessAttestation",
  "verifyTransparencyLog",
  "verifyTransparencyLogSet",
  "verifyTransparencyWitnessSet",
  "buildTransparencyReceipt",
  "exportTransparencyLog",
  "importTransparencyLog"
]) {
  if (!transparencyJs.includes(expected)) fail("missing V31 transparency export: " + expected);
}



const securityV38Js = fs.readFileSync(path.join(root, "assets/js/release-security-v38.js"), "utf8");
if (!securityV38Js.includes('export const SECURITY_HARDENING_V38_VERSION = "38.0";')) fail("V38 security version must be 38.0");
for (const expected of [
  "safeParseDecisionCertificate",
  "validateCertificateBoundary",
  "findForbiddenKeys",
  "calculateJsonDepth"
]) {
  if (!securityV38Js.includes(expected)) fail("missing V38 security export: " + expected);
}

const integrationV39Js = fs.readFileSync(path.join(root, "assets/js/release-integration-v39.js"), "utf8");
if (!integrationV39Js.includes('export const RELEASE_INTEGRATION_V39_VERSION = "39.0";')) fail("V39 integration version must be 39.0");
for (const expected of [
  "EXPECTED_RELEASE_COMPONENTS",
  "buildComponentManifest",
  "verifyComponentManifest",
  "buildReleaseLineage",
  "verifyReleaseLineage"
]) {
  if (!integrationV39Js.includes(expected)) fail("missing V39 integration export: " + expected);
}

const finalV40Js = fs.readFileSync(path.join(root, "assets/js/final-release-v40.js"), "utf8");
if (!finalV40Js.includes('export const FINAL_RELEASE_V40_VERSION = "40.0";')) fail("V40 final version must be 40.0");
for (const expected of [
  "FINAL_RELEASE_SCHEMA",
  "canonicalizeFinalRelease",
  "fingerprintFinalRelease",
  "buildFinalReleaseCertificate",
  "verifyFinalReleaseCertificate",
  "exportFinalReleaseCertificate"
]) {
  if (!finalV40Js.includes(expected)) fail("missing V40 final export: " + expected);
}

const sourceFiles = [
  "index.html","laboratorio.html","gracias.html","assets/css/main.css","assets/js/site.js","assets/js/app.js","assets/js/policy-transparency.js",
  "assets/js/thanks.js","assets/js/revops-engine.js","assets/js/csv-utils.js",
  "assets/js/execution-adapter.js","assets/js/outcome-engine.js",
  "assets/js/calibration-engine.js","assets/js/adaptive-calibration-engine.js","assets/js/policy-engine.js","assets/js/policy-evidence.js","assets/js/policy-decision-certificate.js","assets/js/policy-evidence-signing.js","assets/js/policy-trust-registry.js","assets/js/policy-trust-root.js",
  "assets/js/policy-decision-certificate.js",
  "README.md"
];

for (const file of sourceFiles) {
  const content = fs.readFileSync(path.join(root, file), "utf8");
  for (const pattern of secretPatterns) if (pattern.test(content)) fail("credential pattern in " + file);
}

console.log("Validation PASS");
console.log("Unique IDs:", new Set(ids).size);
console.log("Local refs:", localRefs.length);
