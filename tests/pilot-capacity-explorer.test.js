import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS} from "../assets/js/workflow-engine.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {assessPilotReadiness} from "../assets/js/pilot-readiness.js";
import {createPilotExecutionPlan} from "../assets/js/pilot-plan.js";
import {buildPilotCapacityExplorer,pilotCapacityReportJson,ROLE_CONCURRENCY}
 from "../assets/js/pilot-capacity-explorer.js";

const ready=(type,source)=>assessPilotReadiness(type,source);
test("PR86: all 18 fixtures and two role staffing scenarios remain dependency-safe",()=>{
 for(const scenario of Object.keys(SCENARIOS))
  for(const variant of Object.keys(RECIPE_LABELS))
   for(const limit of ROLE_CONCURRENCY){
    const preflight=ready(scenario,recipe(scenario,variant));
    const model=buildPilotCapacityExplorer(preflight,limit);
    const plan=createPilotExecutionPlan(preflight);
    assert.equal(model.comparisons.length,4);
    assert.equal(model.totalTasks,plan.taskCount);
    assert.equal(model.relativeEffort,plan.points);
    assert.equal(model.realApprovals,0);
    assert.equal(model.externalExecutions,0);
    const byId=new Map(plan.tasks.map(t=>[t.id,t]));
    for(const comparison of model.comparisons){
     assert.ok(comparison.waves>=comparison.optimisticWaves);
     const done=new Set();
     for(const wave of comparison.rehearsal){
      assert.ok(wave.tasks.length>0&&wave.tasks.length<=comparison.capacity);
      const roles=new Map();
      for(const id of wave.tasks){
       assert.equal(done.has(id),false);
       const task=byId.get(id);
       assert.ok(task);
       assert.ok(task.depends.every(dep=>done.has(dep)),id+" skipped prerequisites");
       roles.set(task.role,(roles.get(task.role)||0)+1);
      }
      assert.ok([...roles.values()].every(n=>n<=limit));
      for(const id of wave.tasks)done.add(id);
     }
     assert.equal(done.size,plan.taskCount);
    }
   }
});
test("PR86: increased task capacity cannot increase wave count",()=>{
 for(const scenario of Object.keys(SCENARIOS)){
  const model=buildPilotCapacityExplorer(ready(scenario,SCENARIOS[scenario].sample),1);
  const counts=model.comparisons.map(x=>x.waves);
  for(let i=1;i<counts.length;i++)
   assert.ok(counts[i]<=counts[i-1],"capacity increase unexpectedly creates extra waves");
 }
});
test("PR86: critical chain is valid and cannot be interpreted as elapsed time",()=>{
 const r=ready("orders",SCENARIOS.orders.sample),p=createPilotExecutionPlan(r);
 const x=buildPilotCapacityExplorer(r);
 assert.ok(x.criticalPath.points>0);
 assert.ok(x.criticalPath.tasks.includes("SIGNOFF"));
 assert.equal(x.criticalPath.points,
  x.criticalPath.tasks.reduce((sum,id)=>sum+p.tasks.find(t=>t.id===id).points,0));
 const seen=new Set();
 for(const id of x.criticalPath.tasks){
  const task=p.tasks.find(t=>t.id===id);
  assert.ok(task.depends.every(dep=>seen.has(dep)||!x.criticalPath.tasks.includes(dep)));
  seen.add(id);
 }
 assert.match(x.disclaimer,/no horas, días/);
});
test("PR86: capacity export excludes sensitive source data and invented approvals",()=>{
 const source="pedido;cliente;email;total;estado\nP86-PRIVATE;Secret Buyer;person@business.com;14;nuevo";
 const r=ready("orders",source);
 const text=pilotCapacityReportJson(buildPilotCapacityExplorer(r,2));
 for(const secret of ["P86-PRIVATE","Secret Buyer","person@business.com"])
  assert.equal(text.includes(secret),false);
 assert.equal(JSON.parse(text).realApprovals,0);
 assert.throws(()=>buildPilotCapacityExplorer(r,0));
 assert.throws(()=>buildPilotCapacityExplorer(r,3));
 assert.throws(()=>buildPilotCapacityExplorer({...r,realApprovals:1}));
});
