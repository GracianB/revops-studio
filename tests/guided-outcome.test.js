import test from "node:test";
import assert from "node:assert/strict";
import {buildGuidedOutcome} from "../assets/js/guided-outcome.js";
import {SCENARIOS,runWorkflow} from "../assets/js/workflow-engine.js";
import {RECIPE_LABELS,recipe} from "../assets/js/workflow-product-kit.js";
import {analyzeWorkflow} from "../assets/js/workflow-insights.js";
test("PR102: the actual engine's 18 fixtures produce truthful, private same-sample comparisons",()=>{
 for(const scenario of Object.keys(SCENARIOS))
  for(const fixture of Object.keys(RECIPE_LABELS)){
   const original=analyzeWorkflow(runWorkflow(scenario,recipe(scenario,fixture)));
   const summary=buildGuidedOutcome(original,original);
   assert.equal(summary.total,original.total);
   assert.deepEqual(summary.metrics.map(x=>x.delta),[0,0,0]);
   assert.equal(summary.productionGo,false);
   assert.equal(summary.realApprovals,0);
   assert.equal(summary.externalExecutions,0);
   assert.ok(summary.metrics.every(x=>x.trend==="unchanged"));
   assert.ok(!JSON.stringify(summary).includes("email"));
  }
});
test("PR102: a corrected row changes block count and prepared queue without inventing ROI",()=>{
 const before={total:6,blockedCount:2,reviewCount:1,actionable:2};
 const after={total:6,blockedCount:1,reviewCount:1,actionable:3};
 const summary=buildGuidedOutcome(before,after);
 assert.deepEqual(summary.metrics.map(x=>[x.before,x.after,x.delta,x.trend]),[
  [2,1,-1,"better"],[1,1,0,"unchanged"],[2,3,1,"better"]
 ]);
 assert.match(summary.claim,/corregido 1 bloqueo/);
 assert.doesNotMatch(JSON.stringify(summary),/ROI|€|% de ahorro|ventas reales/i);
});
test("PR102: deteriorations are never marked as successes",()=>{
 const summary=buildGuidedOutcome(
  {total:5,blockedCount:1,reviewCount:0,actionable:3},
  {total:5,blockedCount:2,reviewCount:1,actionable:2});
 assert.deepEqual(summary.metrics.map(x=>x.trend),["attention","attention","attention"]);
 assert.match(summary.claim,/bloqueo más/);
});
test("PR102: mismatched, empty or forged aggregate values fail closed",()=>{
 const base={total:6,blockedCount:2,reviewCount:1,actionable:3};
 const changes=[
  {total:7},{total:0},{total:81},{blockedCount:-1},
  {blockedCount:NaN},{reviewCount:Infinity},{actionable:7},{actionable:2.4}
 ];
 for(const change of changes){
  const bad={...base,...change};
  assert.throws(()=>buildGuidedOutcome(base,bad));
 }
 assert.throws(()=>buildGuidedOutcome(null,base));
 assert.throws(()=>buildGuidedOutcome(base,null));
});
test("PR102: personal customer identifiers are not embedded in local comparison",()=>{
 const before={total:2,blockedCount:1,reviewCount:0,actionable:1,
  rows:[{client:"Empresa Confidencial",email:"secreto@empresa.es",id:"PRIV-102"}]};
 const after={...before,blockedCount:0,actionable:2};
 const summary=buildGuidedOutcome(before,after);
 const serialized=JSON.stringify(summary);
 for(const secret of ["PRIV-102","Empresa Confidencial","secreto@empresa.es"])
  assert.equal(serialized.includes(secret),false);
});
