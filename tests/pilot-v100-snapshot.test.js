import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS} from "../assets/js/workflow-engine.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {assessPilotReadiness} from "../assets/js/pilot-readiness.js";
import {createPilotExecutionPlan} from "../assets/js/pilot-plan.js";
import {buildPilotRiskRegister} from "../assets/js/pilot-risk-register.js";
import {buildPilotEvidenceLedger,simulateEvidenceCoverage} from "../assets/js/pilot-evidence-ledger.js";
import {runPilotFailureDrills} from "../assets/js/pilot-failure-drills.js";
import {buildPilotCapacityExplorer} from "../assets/js/pilot-capacity-explorer.js";
import {buildPilotEvidenceReview} from "../assets/js/pilot-evidence-review.js";
import {runPilotValidationAtlas} from "../assets/js/pilot-validation-atlas.js";
import {buildPilotSupervisedReview} from "../assets/js/pilot-supervised-review.js";
import {buildPilotV100Snapshot,pilotV100SnapshotJson,pilotV100SnapshotText}
 from "../assets/js/pilot-v100-snapshot.js";
import {validatePilotExportJson} from "../assets/js/pilot-export-integrity.js";
import {runV100MilestoneAcceptance} from "../scripts/pr100-milestone-acceptance.mjs";
function make(s,raw,atlas=null){
 const readiness=assessPilotReadiness(s,raw),plan=createPilotExecutionPlan(readiness);
 const risks=buildPilotRiskRegister(readiness,plan);
 const ledger=buildPilotEvidenceLedger(plan,risks);
 const coverage=simulateEvidenceCoverage(ledger);
 const drills=runPilotFailureDrills(readiness,plan,risks,ledger);
 const capacity=buildPilotCapacityExplorer(readiness);
 const evidenceReview=buildPilotEvidenceReview(plan,ledger,risks,coverage);
 const review=buildPilotSupervisedReview({readiness,plan,risks,ledger,coverage,drills,capacity,evidenceReview,atlas});
 return {readiness,review,risks,capacity,evidenceReview,atlas};
}
test("PR100: three workflows × six samples produce coherent and unapproved executive views",()=>{
 for(const scenario of Object.keys(SCENARIOS))for(const fixture of Object.keys(RECIPE_LABELS)){
  const snapshot=buildPilotV100Snapshot(make(scenario,recipe(scenario,fixture)));
  assert.equal(snapshot.metrics.totalLocalControls,8);
  assert.equal(snapshot.metrics.externalChecksOpen,4);
  assert.equal(snapshot.metrics.risksOpen,10);
  assert.equal(snapshot.outcome,"NO AUTORIZADO PARA PRODUCCIÓN");
  assert.equal(snapshot.productionGo,false);
  assert.equal(snapshot.realApprovals,0);
  assert.equal(snapshot.riskHighlights.length,3);
  assert.ok(snapshot.actions.length>0&&snapshot.actions.length<=4);
  assert.equal(validatePilotExportJson(pilotV100SnapshotJson(snapshot)).valid,true);
 }
});
test("PR100: completely clean technical atlas advances only to independent review",()=>{
 const atlas=runPilotValidationAtlas();
 const snapshot=buildPilotV100Snapshot(make("orders",recipe("orders","clear"),atlas));
 assert.equal(snapshot.stage,"Candidato a revisión empresarial independiente");
 assert.equal(snapshot.metrics.localControlsPassed,8);
 assert.equal(snapshot.metrics.atlasFixturesPassed,18);
 assert.equal(snapshot.metrics.realEvidenceVerified,0);
 assert.equal(snapshot.productionGo,false);
});
test("PR100: reject falsified approvals, cross-scenario snapshots and private source values",()=>{
 const privateSource="pedido;cliente;email;total;estado\nV100-PRIVATE;Hidden Partner;hidden@enterprise.com;29;nuevo";
 const input=make("orders",privateSource);
 const summary=buildPilotV100Snapshot(input);
 for(const output of [pilotV100SnapshotJson(summary),pilotV100SnapshotText(summary)]){
  for(const secret of ["V100-PRIVATE","Hidden Partner","hidden@enterprise.com"])
   assert.equal(output.includes(secret),false);
 }
 assert.throws(()=>buildPilotV100Snapshot({...input,review:{...input.review,productionGo:true}}));
 assert.throws(()=>buildPilotV100Snapshot({...input,capacity:{...input.capacity,scenario:"support"}}));
 assert.throws(()=>pilotV100SnapshotJson({...summary,realApprovals:1}));
});
test("PR100: full reproducible technical acceptance includes 18 fixtures but zero real approvals",()=>{
 const actual=runV100MilestoneAcceptance();
 assert.equal(actual.cases,18);
 assert.equal(actual.atlasFixtures,18);
 assert.equal(actual.atlasDefenses,126);
 assert.equal(actual.localInvariantChecks,108);
 assert.equal(actual.technicalPass,true);
 assert.equal(actual.realApprovals,0);
 assert.equal(actual.manualAccessibilityVerified,0);
 assert.equal(actual.productionGo,false);
 assert.ok(actual.checks.every(x=>x.externalPending===4&&x.productionGo===false));
});
