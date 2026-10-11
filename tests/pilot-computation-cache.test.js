import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS} from "../assets/js/workflow-engine.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {assessPilotReadiness} from "../assets/js/pilot-readiness.js";
import {buildPilotCapacityExplorer} from "../assets/js/pilot-capacity-explorer.js";
import {buildPilotStressMatrix} from "../assets/js/pilot-stress-matrix.js";
import {createPilotComputationCache} from "../assets/js/pilot-computation-cache.js";
test("PR97: costly analysis is reused across interaction redraws",()=>{
 for(const scenario of Object.keys(SCENARIOS))for(const type of Object.keys(RECIPE_LABELS)){
  const source=recipe(scenario,type),result=Object.freeze({});
  const cache=createPilotComputationCache(),r=assessPilotReadiness(scenario,source);
  let capacityRuns=0,stressRuns=0;
  const capacity=()=>{capacityRuns++;return buildPilotCapacityExplorer(r,1);};
  const stress=()=>{stressRuns++;return buildPilotStressMatrix(r);};
  cache.setSource(scenario,source,result);
  const first=cache.capacity(1,capacity),second=cache.stress(stress);
  for(let i=0;i<30;i++){
   cache.setSource(scenario,source,result);
   assert.strictEqual(cache.capacity(1,capacity),first);
   assert.strictEqual(cache.stress(stress),second);
  }
  assert.equal(capacityRuns,1);assert.equal(stressRuns,1);
  assert.equal(cache.stats().reuses,60);
  assert.equal(cache.stats().computations,2);
 }
});
test("PR97: source changes or new engine result invalidate without stale outcomes",()=>{
 const cache=createPilotComputationCache();
 const source=SCENARIOS.orders.sample;
 const one={},two={};
 cache.setSource("orders",source,one);
 cache.capacity(1,()=>buildPilotCapacityExplorer(assessPilotReadiness("orders",source),1));
 assert.equal(cache.stats().computations,1);
 cache.setSource("orders",source,two);
 assert.equal(cache.stats().storedCapacityVariants,0);
 cache.setSource("orders",source+"\n",two);
 assert.equal(cache.stats().invalidations,3);
 assert.equal(cache.stats().storedStress,false);
 cache.clear();
 assert.equal(cache.stats().computations,0);
 assert.throws(()=>cache.stress(()=>buildPilotStressMatrix(assessPilotReadiness("orders",source))));
});
test("PR97: rejects unfamiliar capacity and mismatched results",()=>{
 const cache=createPilotComputationCache();
 cache.setSource("orders",SCENARIOS.orders.sample,{});
 assert.throws(()=>cache.capacity(3,()=>null));
 assert.throws(()=>cache.capacity(1,()=>({schema:"revops-pilot-capacity-v1",scenario:"support"})));
 assert.throws(()=>cache.stress(()=>({schema:"wrong",scenario:"orders"})));
 assert.equal(cache.stats().computations,0);
});
