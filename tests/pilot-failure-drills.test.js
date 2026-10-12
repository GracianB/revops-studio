import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS} from "../assets/js/workflow-engine.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {assessPilotReadiness} from "../assets/js/pilot-readiness.js";
import {createPilotExecutionPlan} from "../assets/js/pilot-plan.js";
import {buildPilotRiskRegister} from "../assets/js/pilot-risk-register.js";
import {buildPilotEvidenceLedger} from "../assets/js/pilot-evidence-ledger.js";
import {runPilotFailureDrills,pilotDrillReportJson} from "../assets/js/pilot-failure-drills.js";
function prepare(s,source){
 const r=assessPilotReadiness(s,source),p=createPilotExecutionPlan(r);
 const risks=buildPilotRiskRegister(r,p);
 return [r,p,risks,buildPilotEvidenceLedger(p,risks)];
}
test("PR84: seven offline defensive cases on all 18 fixtures",()=>{
 for(const s of Object.keys(SCENARIOS))for(const name of Object.keys(RECIPE_LABELS)){
  const a=prepare(s,recipe(s,name));
  const result=runPilotFailureDrills(...a);
  assert.equal(result.total,7);
  assert.equal(result.passed,7);
  assert.equal(result.failed,0);
  assert.equal(result.realApprovals,0);
  assert.equal(result.externalExecutions,0);
  assert.deepEqual(result,runPilotFailureDrills(...a));
  assert.ok(result.drills.every(x=>x.passed));
 }
});
test("PR84: cross-scenario mixture cannot be reported as a successful drill",()=>{
 const a=prepare("orders",SCENARIOS.orders.sample);
 assert.throws(()=>runPilotFailureDrills(a[0],a[1],{...a[2],scenario:"support"},a[3]));
});
test("PR84: drill report contains no raw CSV identifiers or personal details",()=>{
 const source="pedido;cliente;email;total;estado\nSECRET-123;Sensitive Co;private@business.com;20;nuevo";
 const report=pilotDrillReportJson(runPilotFailureDrills(...prepare("orders",source)));
 for(const v of ["SECRET-123","Sensitive Co","private@business.com"])
  assert.equal(report.includes(v),false);
 assert.equal(JSON.parse(report).externalExecutions,0);
});
test("PR84: a falsified successful result is not exported as authorization",()=>{
 const result=runPilotFailureDrills(...prepare("orders",SCENARIOS.orders.sample));
 assert.throws(()=>pilotDrillReportJson({...result,realApprovals:1}));
});
