import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS} from "../assets/js/workflow-engine.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {assessPilotReadiness} from "../assets/js/pilot-readiness.js";
import {createPilotExecutionPlan} from "../assets/js/pilot-plan.js";
import {buildPilotRiskRegister} from "../assets/js/pilot-risk-register.js";
import {buildPilotEvidenceLedger,simulateEvidenceCoverage} from "../assets/js/pilot-evidence-ledger.js";
import {runPilotFailureDrills} from "../assets/js/pilot-failure-drills.js";
import {buildPilotGuidedRoute,guidedRouteJson} from "../assets/js/pilot-guided-route.js";
const make=(type,source)=>{
 const r=assessPilotReadiness(type,source),p=createPilotExecutionPlan(r);
 const risks=buildPilotRiskRegister(r,p),ledger=buildPilotEvidenceLedger(p,risks);
 return {r,p,ledger,coverage:simulateEvidenceCoverage(ledger),drills:runPilotFailureDrills(r,p,risks,ledger)};
};
test("PR92: all 18 fixtures have deterministic prioritized, nonexecuting remediation route",()=>{
 for(const type of Object.keys(SCENARIOS))
  for(const fixture of Object.keys(RECIPE_LABELS)){
   const {r,p,ledger,coverage,drills}=make(type,recipe(type,fixture));
   const route=buildPilotGuidedRoute(r,p,ledger,coverage,drills);
   assert.equal(route.realApprovals,0);
   assert.equal(route.externalExecutions,0);
   assert.equal(route.steps.at(-1).id,"R-SIGNOFF");
   assert.equal(route.steps.at(-1).state,"external");
   assert.deepEqual(route,buildPilotGuidedRoute(r,p,ledger,coverage,drills));
   assert.ok(route.steps.every((step,i)=>i===0||step.order>=route.steps[i-1].order));
   assert.equal(new Set(route.steps.map(x=>x.id)).size,route.steps.length);
  }
});
test("PR92: clean fixture still has rehearsal and external steps",()=>{
 const {r,p,ledger,coverage,drills}=make("orders",recipe("orders","clear"));
 const route=buildPilotGuidedRoute(r,p,ledger,coverage,drills);
 assert.equal(route.blocked,0);
 assert.equal(route.review,0);
 assert.equal(route.steps[0].id,"R-EVIDENCE");
 assert.equal(route.steps.at(-1).id,"R-SIGNOFF");
 const all=ledger.entries.filter(e=>!e.externalOnly).map(e=>e.id);
 const completed=buildPilotGuidedRoute(r,p,ledger,simulateEvidenceCoverage(ledger,all),drills);
 assert.deepEqual(completed.steps.map(x=>x.id),["R-SIGNOFF"]);
});
test("PR92: blocked cases are shown first with explainable routes",()=>{
 const {r,p,ledger,coverage}=make("orders",SCENARIOS.orders.sample);
 const route=buildPilotGuidedRoute(r,p,ledger,coverage);
 assert.equal(route.steps[0].state,"blocked");
 assert.ok(route.steps[0].target==="pilotAuthorizationHeading");
 assert.ok(route.steps.some(x=>x.id==="R-DRILLS"));
});
test("PR92: no secret is exported and unsupported fake approvals are rejected",()=>{
 const src="pedido;cliente;email;total;estado\nPRIVATE-92;Secret Org;secret@corporate.com;25;nuevo";
 const {r,p,ledger,coverage,drills}=make("orders",src);
 const text=guidedRouteJson(buildPilotGuidedRoute(r,p,ledger,coverage,drills));
 for(const secret of ["PRIVATE-92","Secret Org","secret@corporate.com"])
  assert.ok(!text.includes(secret));
 assert.throws(()=>buildPilotGuidedRoute({...r,realApprovals:1},p,ledger,coverage));
 assert.throws(()=>buildPilotGuidedRoute(r,{...p,scenario:"support"},ledger,coverage));
 assert.throws(()=>guidedRouteJson({...buildPilotGuidedRoute(r,p,ledger,coverage),realApprovals:1}));
});
