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
  "assets/js/execution-adapter.js"
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

const requiredV17Ids = [
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
  "replayLedger", "ledgerEvents"
];
const missingV17Ids = requiredV17Ids.filter((id) => !ids.includes(id));
if (missingV17Ids.length) fail("V17 surface missing DOM ids: " + missingV17Ids.join(", "));
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

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (packageJson.version !== "17.0.0") fail("package version must be 17.0.0");
const declaredTests = (fs.readFileSync(path.join(root, "tests/revops-engine.test.js"), "utf8").match(/test\(/g) || []).length;
if (declaredTests < 72) fail("V17 regression suite must contain at least 72 tests");
const adapterJs = fs.readFileSync(path.join(root, "assets/js/execution-adapter.js"), "utf8");
const adapterExports = new Set(
  [...adapterJs.matchAll(/export\s+(?:function|const|let|var|class)\s+([A-Za-z0-9_]+)/g)].map((match) => match[1])
);
for (const expected of ["createExecutionEnvelope", "createIntegrationContract", "validateIntegrationContract", "simulateExecution", "simulateIntegrationContract", "createExecutionEvent", "EXECUTION_ADAPTER_STATUS"]) {
  if (!adapterExports.has(expected)) fail("missing execution adapter export: " + expected);
}

const sourceFiles = [
  "index.html","gracias.html","assets/css/main.css","assets/js/app.js",
  "assets/js/thanks.js","assets/js/revops-engine.js","assets/js/csv-utils.js",
  "assets/js/execution-adapter.js","README.md"
];

for (const file of sourceFiles) {
  const content = fs.readFileSync(path.join(root, file), "utf8");
  for (const pattern of secretPatterns) if (pattern.test(content)) fail("credential pattern in " + file);
}

console.log("Validation PASS");
console.log("Unique IDs:", new Set(ids).size);
console.log("Local refs:", localRefs.length);
