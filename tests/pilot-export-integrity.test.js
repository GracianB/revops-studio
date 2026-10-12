import test from "node:test";
import assert from "node:assert/strict";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {SCENARIOS} from "../assets/js/workflow-engine.js";
import {assessPilotReadiness} from "../assets/js/pilot-readiness.js";
import {createPilotExecutionPlan} from "../assets/js/pilot-plan.js";
import {buildPilotRiskRegister,riskRegisterJson} from "../assets/js/pilot-risk-register.js";
import {buildPilotEvidenceLedger,simulateEvidenceCoverage,evidencePacketJson} from "../assets/js/pilot-evidence-ledger.js";
import {buildPilotCapacityExplorer,pilotCapacityReportJson} from "../assets/js/pilot-capacity-explorer.js";
import {buildPilotAuthorizationBoard,pilotAuthorizationJson} from "../assets/js/pilot-authorization-board.js";
import {buildPilotStressMatrix,pilotStressMatrixJson} from "../assets/js/pilot-stress-matrix.js";
import {runPilotFailureDrills,pilotDrillReportJson} from "../assets/js/pilot-failure-drills.js";
import {buildPilotEvidenceReview,pilotEvidenceReviewJson} from "../assets/js/pilot-evidence-review.js";
import {buildPilotGuidedRoute,guidedRouteJson} from "../assets/js/pilot-guided-route.js";
import {buildPilotSupervisedReview,pilotSupervisedReviewJson} from "../assets/js/pilot-supervised-review.js";
import {buildPilotHandoffPack,pilotHandoffHtml} from "../assets/js/pilot-handoff-pack.js";
import {runPilotValidationAtlas,pilotValidationAtlasJson} from "../assets/js/pilot-validation-atlas.js";
import {createPilotSessionJournal,pilotSessionJournalJson} from "../assets/js/pilot-session-journal.js";
import {validatePilotExportJson,validatePilotHtmlHandoff} from "../assets/js/pilot-export-integrity.js";
test("PR96: all 18 fixtures pass security validation for real built-in serializers",()=>{
 const atlas=runPilotValidationAtlas();
 assert.equal(validatePilotExportJson(pilotValidationAtlasJson(atlas)).valid,true);
 for(const scenario of Object.keys(SCENARIOS))for(const sample of Object.keys(RECIPE_LABELS)){
  const readiness=assessPilotReadiness(scenario,recipe(scenario,sample));
  const plan=createPilotExecutionPlan(readiness);
  const risks=buildPilotRiskRegister(readiness,plan);
  const ledger=buildPilotEvidenceLedger(plan,risks);
  const coverage=simulateEvidenceCoverage(ledger);
  const capacity=buildPilotCapacityExplorer(readiness);
  const evidenceReview=buildPilotEvidenceReview(plan,ledger,risks,coverage);
  const drills=runPilotFailureDrills(readiness,plan,risks,ledger);
  const board=buildPilotAuthorizationBoard({readiness,plan,risks,ledger,drills});
  const final=buildPilotSupervisedReview({
   readiness,plan,risks,ledger,coverage,drills,capacity,evidenceReview,atlas
  });
  const artifacts=[
   riskRegisterJson(risks),evidencePacketJson(ledger,coverage),
   pilotCapacityReportJson(capacity),pilotAuthorizationJson(board),
   pilotStressMatrixJson(buildPilotStressMatrix(readiness)),
   pilotDrillReportJson(drills),pilotEvidenceReviewJson(evidenceReview),
   guidedRouteJson(buildPilotGuidedRoute(readiness,plan,ledger,coverage,drills)),
   pilotSupervisedReviewJson(final)
  ];
  for(const payload of artifacts)assert.ok(validatePilotExportJson(payload).valid);
  const html=pilotHandoffHtml(buildPilotHandoffPack(board,plan,risks,ledger,capacity));
  assert.ok(validatePilotHtmlHandoff(html).valid);
 }
 const journal=createPilotSessionJournal();journal.add("drill_run");
 assert.ok(validatePilotExportJson(pilotSessionJournalJson(journal.snapshot())).valid);
});
test("PR96: reject unauthorized releases, secrets, copied rows, huge payloads and malformed reports",()=>{
 const template={schema:"revops-pilot-control-v1",productionGo:false,realApprovals:0};
 assert.ok(validatePilotExportJson(JSON.stringify(template)).valid);
 for(const addition of [{productionGo:true},{realApprovals:1},{externalExecutions:2},
  {rawRows:[{id:1}]},{email:"private@company.com"},{apiKey:"secret"},
  {risk:{realEvidenceVerified:1}},{nested:{customerName:"Person"}}]){
  assert.throws(()=>validatePilotExportJson(JSON.stringify({...template,...addition})));
 }
 assert.throws(()=>validatePilotExportJson("not json"));
 assert.throws(()=>validatePilotExportJson("{}"));
 assert.throws(()=>validatePilotExportJson(JSON.stringify({...template,data:"A".repeat(4000)})));
 assert.throws(()=>validatePilotExportJson(JSON.stringify(template),{maxBytes:2}));
});
test("PR96: printable handoff has no active embedded content",()=>{
 const header="<!doctype html><meta http-equiv='Content-Security-Policy'><p>NO AUTORIZADO PARA PRODUCCIÓN</p>";
 assert.ok(validatePilotHtmlHandoff(header).valid);
 for(const injection of ["<script>alert(1)</script>","<iframe src=x></iframe>",
  "<img src=x>","<div onmouseover='x()'>","https://evil.example"])
  assert.throws(()=>validatePilotHtmlHandoff(header+injection));
});
