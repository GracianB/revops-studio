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
import {buildPilotSupervisedReview,pilotSupervisedReviewJson,pilotSupervisedReviewText} from "../assets/js/pilot-supervised-review.js";
function input(s,source,atlas=null){
 const readiness=assessPilotReadiness(s,source);
 const plan=createPilotExecutionPlan(readiness);
 const risks=buildPilotRiskRegister(readiness,plan);
 const ledger=buildPilotEvidenceLedger(plan,risks);
 const coverage=simulateEvidenceCoverage(ledger);
 const drills=runPilotFailureDrills(readiness,plan,risks,ledger);
 const capacity=buildPilotCapacityExplorer(readiness);
 const evidenceReview=buildPilotEvidenceReview(plan,ledger,risks,coverage);
 return {readiness,plan,risks,ledger,coverage,drills,capacity,evidenceReview,atlas};
}
test("PR95: 18 synthetic sources preserve 12 criteria and permanent external NO-GO",()=>{
 for(const scenario of Object.keys(SCENARIOS))for(const fixture of Object.keys(RECIPE_LABELS)){
  const review=buildPilotSupervisedReview(input(scenario,recipe(scenario,fixture)));
  assert.equal(review.total,12);
  assert.equal(review.gates.length,12);
  assert.equal(review.localPassed+review.attention,8);
  assert.equal(review.externalRequired,4);
  assert.equal(review.gates.filter(g=>g.state==="external_required").length,4);
  assert.equal(review.productionGo,false);
  assert.equal(review.realApprovals,0);
  assert.equal(review.realEvidenceVerified,0);
  assert.equal(review.gates.at(-1).id,"REV-12");
  assert.equal(review.gates.at(-1).state,"external_required");
 }
});
test("PR95: a pristine dataset and complete local atlas may be reviewable, never launched",()=>{
 const atlas=runPilotValidationAtlas();
 const review=buildPilotSupervisedReview(input("orders",recipe("orders","clear"),atlas));
 assert.equal(review.localPassed,8);
 assert.equal(review.attention,0);
 assert.equal(review.eligibleForIndependentReview,true);
 assert.equal(review.externalRequired,4);
 assert.equal(review.productionGo,false);
 const noAtlas=buildPilotSupervisedReview(input("orders",recipe("orders","clear")));
 assert.equal(noAtlas.gates.find(g=>g.id==="REV-08").state,"attention");
});
test("PR95: blocked cases cannot be represented as all-green",()=>{
 const review=buildPilotSupervisedReview(input("orders",SCENARIOS.orders.sample));
 assert.ok(review.attention>=1);
 assert.equal(review.eligibleForIndependentReview,false);
 assert.equal(review.gates.find(g=>g.id==="REV-02").state,"attention");
});
test("PR95: tampering, cross-scenario and fabricated approvals are rejected",()=>{
 const model=input("orders",SCENARIOS.orders.sample);
 assert.throws(()=>buildPilotSupervisedReview({...model,readiness:{...model.readiness,realApprovals:1}}));
 assert.throws(()=>buildPilotSupervisedReview({...model,evidenceReview:{...model.evidenceReview,scenario:"support"}}));
 const review=buildPilotSupervisedReview(model);
 assert.throws(()=>pilotSupervisedReviewJson({...review,productionGo:true}));
 assert.throws(()=>pilotSupervisedReviewText({...review,realApprovals:1}));
});
test("PR95: both reports have only derived text, no CSV identities",()=>{
 const source="pedido;cliente;email;total;estado\nREVIEW-SECRET;Secret Company;secret@business.com;15;nuevo";
 const review=buildPilotSupervisedReview(input("orders",source));
 for(const content of [pilotSupervisedReviewJson(review),pilotSupervisedReviewText(review)]){
  for(const secret of ["REVIEW-SECRET","Secret Company","secret@business.com"])
   assert.equal(content.includes(secret),false);
  assert.match(content,/NO AUTORIZADO PARA PRODUCCIÓN/);
 }
});
