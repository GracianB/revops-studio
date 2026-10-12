import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS} from "../assets/js/workflow-engine.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {assessPilotReadiness} from "../assets/js/pilot-readiness.js";
import {createPilotExecutionPlan} from "../assets/js/pilot-plan.js";
import {buildPilotRiskRegister,riskRegisterJson} from "../assets/js/pilot-risk-register.js";
function build(type,source){
 const readiness=assessPilotReadiness(type,source);
 const plan=createPilotExecutionPlan(readiness);
 return {readiness,plan,risks:buildPilotRiskRegister(readiness,plan)};
}
test("PR82: all 18 fixtures produce ten deterministic, traceable risks",()=>{
 for(const type of Object.keys(SCENARIOS))
  for(const key of Object.keys(RECIPE_LABELS)){
   const {readiness,plan,risks}=build(type,recipe(type,key));
   assert.equal(risks.count,10);
   assert.equal(risks.realApprovals,0);
   assert.equal(risks.externalExecutions,0);
   assert.deepEqual(risks,buildPilotRiskRegister(readiness,plan));
   assert.equal(new Set(risks.risks.map(r=>r.id)).size,10);
   for(const risk of risks.risks){
    assert.ok(plan.tasks.some(task=>task.id===risk.task));
    assert.equal(risk.resolvedInDemo,false);
    assert.equal(risk.score,risk.impact*risk.likelihood);
   }
  }
});
test("PR82: a clean synthetic sample still requires external approval and rollback",()=>{
 const {risks}=build("orders",recipe("orders","clear"));
 assert.equal(risks.risks.find(r=>r.id==="R-APPROVAL").score,9);
 assert.equal(risks.risks.find(r=>r.id==="R-ROLLBACK").score,6);
 assert.equal(risks.risks.find(r=>r.id==="R-BLOCK").signal,"pass");
});
test("PR82: export excludes identifying CSV fields",()=>{
 const source="pedido;cliente;email;total;estado\nSECRET-ROW;Sensitive Org;person@business.com;15;nuevo";
 const {risks}=build("orders",source);
 const text=riskRegisterJson(risks);
 for(const v of ["SECRET-ROW","Sensitive Org","person@business.com"])
  assert.equal(text.includes(v),false);
 assert.equal(JSON.parse(text).realApprovals,0);
});
test("PR82: reject cross-scenario or faked production approval",()=>{
 const {readiness,plan}=build("support",SCENARIOS.support.sample);
 assert.throws(()=>buildPilotRiskRegister({...readiness,realApprovals:1},plan));
 assert.throws(()=>buildPilotRiskRegister(readiness,{...plan,scenario:"orders"}));
 assert.throws(()=>buildPilotRiskRegister(readiness,{...plan,tasks:plan.tasks.filter(t=>t.id!=="SIGNOFF")}));
});
