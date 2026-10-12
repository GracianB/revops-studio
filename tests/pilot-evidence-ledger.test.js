import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS} from "../assets/js/workflow-engine.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {assessPilotReadiness} from "../assets/js/pilot-readiness.js";
import {createPilotExecutionPlan} from "../assets/js/pilot-plan.js";
import {buildPilotRiskRegister} from "../assets/js/pilot-risk-register.js";
import {buildPilotEvidenceLedger,simulateEvidenceCoverage,evidencePacketJson}
 from "../assets/js/pilot-evidence-ledger.js";
const get=(scenario,source)=>{
 const ready=assessPilotReadiness(scenario,source),plan=createPilotExecutionPlan(ready);
 return buildPilotEvidenceLedger(plan,buildPilotRiskRegister(ready,plan));
};
test("PR83: all synthetic fixtures have exact requirements for their planned tasks",()=>{
 for(const scenario of Object.keys(SCENARIOS))
  for(const variant of Object.keys(RECIPE_LABELS)){
   const l=get(scenario,recipe(scenario,variant));
   assert.equal(l.required,l.entries.length);
   assert.equal(l.suppliedReal,0);
   assert.equal(l.approvedReal,0);
   assert.equal(l.entries.filter(e=>e.externalOnly).length,1);
   assert.equal(new Set(l.entries.map(e=>e.id)).size,l.entries.length);
   assert.deepEqual(simulateEvidenceCoverage(l).rehearsalIds,[]);
  }
});
test("PR83: rehearsal marks must not create external approvals",()=>{
 const l=get("orders",SCENARIOS.orders.sample);
 const first=l.entries.find(e=>!e.externalOnly);
 const c=simulateEvidenceCoverage(l,[first.id]);
 assert.equal(c.rehearsed,1);
 assert.equal(c.realApprovals,0);
 assert.equal(c.realEvidenceSupplied,0);
 assert.throws(()=>simulateEvidenceCoverage(l,["E-SIGNOFF"]),/externa/);
 assert.throws(()=>simulateEvidenceCoverage(l,[first.id,first.id]));
 assert.throws(()=>simulateEvidenceCoverage(l,["E-UNKNOWN"]));
});
test("PR83: evidence export explicitly excludes untrusted customer fields",()=>{
 const source="pedido;cliente;email;total;estado\nPRIVATE-ORDER;Account Secret;someone@corp.com;19;nuevo";
 const l=get("orders",source);
 const txt=evidencePacketJson(l);
 assert.equal(txt.includes("PRIVATE-ORDER"),false);
 assert.equal(txt.includes("someone@corp.com"),false);
 assert.equal(txt.includes("Account Secret"),false);
 assert.equal(JSON.parse(txt).realApprovals,0);
});
test("PR83: cannot cross documents or impersonate real evidence",()=>{
 const r=assessPilotReadiness("orders",SCENARIOS.orders.sample);
 const p=createPilotExecutionPlan(r),risks=buildPilotRiskRegister(r,p);
 assert.throws(()=>buildPilotEvidenceLedger({...p,scenario:"support"},risks));
 const l=buildPilotEvidenceLedger(p,risks);
 assert.throws(()=>evidencePacketJson(l,{...simulateEvidenceCoverage(l),realApprovals:1}));
});
