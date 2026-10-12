import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS} from "../assets/js/workflow-engine.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {assessPilotReadiness} from "../assets/js/pilot-readiness.js";
import {createPilotExecutionPlan} from "../assets/js/pilot-plan.js";
import {buildPilotRiskRegister} from "../assets/js/pilot-risk-register.js";
import {buildPilotEvidenceLedger,simulateEvidenceCoverage} from "../assets/js/pilot-evidence-ledger.js";
import {buildPilotEvidenceReview,pilotEvidenceReviewJson} from "../assets/js/pilot-evidence-review.js";
const prepare=(type,source)=>{
 const ready=assessPilotReadiness(type,source);
 const plan=createPilotExecutionPlan(ready);
 const risks=buildPilotRiskRegister(ready,plan);
 const ledger=buildPilotEvidenceLedger(plan,risks);
 return {plan,risks,ledger};
};
test("PR94: all 18 synthetic examples preserve 1:1 evidence-task traceability",()=>{
 for(const type of Object.keys(SCENARIOS))for(const fixture of Object.keys(RECIPE_LABELS)){
  const {plan,risks,ledger}=prepare(type,recipe(type,fixture));
  const review=buildPilotEvidenceReview(plan,ledger,risks,simulateEvidenceCoverage(ledger));
  assert.equal(review.required,plan.taskCount);
  assert.equal(review.pending+review.external,review.required);
  assert.equal(review.verifiedReal,0);
  assert.equal(review.realApprovals,0);
  assert.ok(review.roles.length>3);
  assert.equal(review.entries.filter(e=>e.externalOnly).length,1);
  assert.ok(review.entries.some(e=>e.id==="E-SIGNOFF"&&e.level==="external"));
  assert.deepEqual(new Set(review.entries.map(e=>e.task)),new Set(plan.tasks.map(t=>t.id)));
  assert.ok(review.entries.every(e=>e.risks.every(id=>risks.risks.some(r=>r.id===id))));
 }
});
test("PR94: local checkmarks change rehearsal, never verified proof",()=>{
 const {plan,risks,ledger}=prepare("orders",SCENARIOS.orders.sample);
 const ids=ledger.entries.filter(e=>!e.externalOnly).slice(0,2).map(e=>e.id);
 const review=buildPilotEvidenceReview(plan,ledger,risks,simulateEvidenceCoverage(ledger,ids));
 assert.equal(review.rehearsed,2);
 assert.equal(review.verifiedReal,0);
 assert.equal(review.realApprovals,0);
 assert.ok(review.entries.filter(e=>ids.includes(e.id)).every(e=>e.level==="rehearsed"));
});
test("PR94: reject a mismatched or fabricated task evidence",()=>{
 const {plan,risks,ledger}=prepare("orders",SCENARIOS.orders.sample);
 const covered=simulateEvidenceCoverage(ledger);
 assert.throws(()=>buildPilotEvidenceReview({...plan,scenario:"support"},ledger,risks,covered));
 assert.throws(()=>buildPilotEvidenceReview(plan,{...ledger,entries:[...ledger.entries,{...ledger.entries[0],id:"E-HACK"}]},risks,covered));
 assert.throws(()=>buildPilotEvidenceReview(plan,ledger,risks,{...covered,realApprovals:1}));
});
test("PR94: JSON always excludes CSV identities and fake signoff",()=>{
 const secret="pedido;cliente;email;total;estado\nP94-SECRET;Sensitive Partner;hidden@enterprise.com;17;nuevo";
 const {plan,risks,ledger}=prepare("orders",secret);
 const out=pilotEvidenceReviewJson(buildPilotEvidenceReview(plan,ledger,risks,simulateEvidenceCoverage(ledger)));
 for(const needle of ["P94-SECRET","Sensitive Partner","hidden@enterprise.com"])
  assert.equal(out.includes(needle),false);
 const json=JSON.parse(out);
 assert.equal(json.verifiedReal,0);
 assert.equal(json.realApprovals,0);
 assert.throws(()=>pilotEvidenceReviewJson({...JSON.parse(out),realApprovals:1}));
});
