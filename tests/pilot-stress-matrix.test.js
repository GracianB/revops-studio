import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS} from "../assets/js/workflow-engine.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {assessPilotReadiness} from "../assets/js/pilot-readiness.js";
import {buildPilotStressMatrix,pilotStressMatrixJson} from "../assets/js/pilot-stress-matrix.js";

test("PR89: 18 live fixture situations compare six synthetic patterns each",()=>{
 for(const scenario of Object.keys(SCENARIOS))for(const key of Object.keys(RECIPE_LABELS)){
  const ready=assessPilotReadiness(scenario,recipe(scenario,key));
  const matrix=buildPilotStressMatrix(ready);
  assert.equal(matrix.samples.length,6);
  assert.equal(matrix.current.total,ready.metrics.total);
  assert.equal(matrix.current.blocked,ready.metrics.blocked);
  assert.equal(matrix.current.gateStates.length,8);
  assert.ok(matrix.samples.every(sample=>sample.data.gateStates.length===8));
  assert.ok(matrix.samples.every(sample=>sample.data.productionGo===false));
  assert.ok(matrix.samples.every(sample=>sample.data.realApprovals===0));
  assert.deepEqual(matrix,buildPilotStressMatrix(ready));
  for(const sample of matrix.samples){
   assert.equal(sample.differenceFromCurrent.blocked,sample.data.blocked-matrix.current.blocked);
   assert.equal(sample.differenceFromCurrent.review,sample.data.review-matrix.current.review);
   assert.equal(sample.differenceFromCurrent.passed,sample.data.gatesPassed-matrix.current.gatesPassed);
  }
 }
});
test("PR89: every fixture self-comparison has zero difference",()=>{
 for(const scenario of Object.keys(SCENARIOS))
  for(const key of Object.keys(RECIPE_LABELS)){
   const r=assessPilotReadiness(scenario,recipe(scenario,key));
   const a=buildPilotStressMatrix(r).samples.find(s=>s.key===key);
   assert.deepEqual(a.differenceFromCurrent,{blocked:0,review:0,passed:0});
  }
});
test("PR89: matrix is based on synthetic catalog, never source values",()=>{
 const source="pedido;cliente;email;total;estado\nROW-SECRET-89;Sensitive Account;private@business.com;21;nuevo";
 const ready=assessPilotReadiness("orders",source);
 const matrix=buildPilotStressMatrix(ready);
 const json=pilotStressMatrixJson(matrix);
 for(const needle of ["ROW-SECRET-89","Sensitive Account","private@business.com"])
  assert.equal(json.includes(needle),false);
 assert.equal(JSON.parse(json).syntheticOnly,true);
 assert.equal(JSON.parse(json).realApprovals,0);
});
test("PR89: rejecting fake approvals, unknown scenarios and false export claims",()=>{
 const r=assessPilotReadiness("orders",SCENARIOS.orders.sample);
 assert.throws(()=>buildPilotStressMatrix({...r,realApprovals:1}));
 assert.throws(()=>buildPilotStressMatrix({...r,scenario:"unknown"}));
 assert.throws(()=>pilotStressMatrixJson({...buildPilotStressMatrix(r),syntheticOnly:false}));
});
