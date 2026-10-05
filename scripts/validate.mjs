import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "index.html",
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
  "tests/policy-engine.test.js"
];

const fail = (message) => {
  console.error("VALIDATION FAIL:", message);
  process.exit(1);
};

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) fail("missing " + file);
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const appJs = fs.readFileSync(path.join(root, "assets/js/app.js"), "utf8");
const domSelectors = [...appJs.matchAll(/qs\(\s*["']#([A-Za-z0-9_-]+)["']/g)].map((match) => match[1]);
const missingDomIds = [...new Set(domSelectors)].filter((id) => !ids.includes(id));
if (missingDomIds.length) fail("app.js references missing DOM ids: " + missingDomIds.join(", "));

const guidedTargets = [...appJs.matchAll(/target:\s*"([A-Za-z0-9_-]+)"/g)].map((match) => match[1]);
const missingGuidedTargets = [...new Set(guidedTargets)].filter((id) => !ids.includes(id));
if (missingGuidedTargets.length) fail("guided proof references missing target ids: " + missingGuidedTargets.join(", "));

const guidedSteps = [...html.matchAll(/data-guided-step="(\d+)"/g)].map((match) => Number(match[1]));
const expectedGuidedSteps = [0, 1, 2, 3];
if (guidedSteps.length !== expectedGuidedSteps.length || guidedSteps.some((value, index) => value !== expectedGuidedSteps[index])) {
  fail("guided proof steps must expose 0,1,2,3 exactly once");
}

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
  "calibration-v24-title", "calibrationV24Status", "calibrationV24Multiplier",
  "calibrationV24Improvement", "calibrationV24Active", "calibrationV24Reason", "calibrationV24Replay", "calibrationV24Rows", "calibrationV24Integrity", "calibrationV24PolicyId", "calibrationV24Deviation", "calibrationV24Actor", "calibrationV24SourceRun", "calibrationV24Lineage", "policyV24Actor", "policyV24Rationale", "calibrationV24Replay", "calibrationV24PolicyId", "calibrationV24Deviation",
  "approvePolicyV24", "rejectPolicyV24", "rollbackPolicyV24",
  "feedbackActualRevenue", "feedbackResponseHours", "recordFeedback",
  "feedbackStatus", "feedbackTotal", "feedbackPositiveRate", "feedbackWinRate",
  "feedbackVariance", "feedbackCalibration", "feedbackSla", "feedbackEffectiveness"
];
const missingV18Ids = requiredV18Ids.filter((id) => !ids.includes(id));
if (missingV18Ids.length) fail("V18 surface missing DOM ids: " + missingV18Ids.join(", "));
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) fail("duplicate ids: " + [...new Set(duplicates)].join(", "));

const localRefs = [...html.matchAll(/(?:href|src)="(\.{0,2}\/[^"]+)"/g)]
  .map((match) => match[1].split("#")[0].split("?")[0])
  .filter(Boolean);

for (const ref of localRefs) {
  if (!fs.existsSync(path.normalize(path.join(root, ref)))) fail("broken local reference: " + ref);
}

if (/href="javascript:/i.test(html)) fail("javascript: URL found");

const blankUnsafe = [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)]
  .some((match) => !/rel="[^"]*noopener/i.test(match[0]));
if (blankUnsafe) fail('target="_blank" without noopener');

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
if (packageJson.version !== "24.0.0") fail("package version must be 23.0.0");
const testFiles = fs.readdirSync(path.join(root, "tests"))
  .filter((file) => file.endsWith(".test.js"));
const declaredTests = testFiles.reduce((total, file) =>
  total + (fs.readFileSync(path.join(root, "tests", file), "utf8").match(/test\(/g) || []).length, 0);
if (declaredTests < 87) fail("V18 regression suite must contain at least 87 tests");
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
if (!policyJs.includes('export const POLICY_CONTRACT_VERSION = "24.0";')) fail("policy contract must be 24.0");
for (const expected of ["POLICY_ABSOLUTE_MIN", "POLICY_ABSOLUTE_MAX", "buildReplayFingerprint", "buildRowsFingerprint", "verifyPolicyProposal", "buildPolicyProposalFingerprint", "buildPolicyLineageFingerprint", "normaliseActor", "normaliseRationale"]) {
  if (!policyJs.includes(expected)) fail("missing V22 policy integrity export: " + expected);
}

const sourceFiles = [
  "index.html","gracias.html","assets/css/main.css","assets/js/app.js",
  "assets/js/thanks.js","assets/js/revops-engine.js","assets/js/csv-utils.js",
  "assets/js/execution-adapter.js","assets/js/outcome-engine.js",
  "assets/js/calibration-engine.js","assets/js/adaptive-calibration-engine.js","assets/js/policy-engine.js",
  "README.md"
];

for (const file of sourceFiles) {
  const content = fs.readFileSync(path.join(root, file), "utf8");
  for (const pattern of secretPatterns) if (pattern.test(content)) fail("credential pattern in " + file);
}

console.log("Validation PASS");
console.log("Unique IDs:", new Set(ids).size);
console.log("Local refs:", localRefs.length);
