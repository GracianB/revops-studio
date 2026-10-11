import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS,runWorkflow} from "../assets/js/workflow-engine.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {assessPilotReadiness} from "../assets/js/pilot-readiness.js";
import {createPilotExecutionPlan,simulatePlanProgress,
 pilotPlanText,pilotPlanJson,PLAN_CAPACITIES,PLAN_PHASES} from "../assets/js/pilot-plan.js";

function build(type="orders",source=SCENARIOS[type].sample,capacity=3){
 return createPilotExecutionPlan(assessPilotReadiness(type,source,runWorkflow(type,source)),capacity);
}
test("PR81: 18 datasets produce consistent conditional work, signoff locked and honest estimates",()=>{
 for(const type of Object.keys(SCENARIOS)){
  for(const name of Object.keys(RECIPE_LABELS)){
   const plan=build(type,recipe(type,name)),ids=new Set(plan.tasks.map(x=>x.id));
   assert.equal(plan.schema,"revops-pilot-plan-v1");
   assert.equal(ids.size,plan.tasks.length);
   assert.equal(plan.tasks.filter(x=>x.locked).length,1);
   assert.ok(ids.has("SIGNOFF"));
   assert.equal(plan.humanAuthorizationRequired,true);
   assert.equal(plan.realApprovals,0);
   assert.equal(plan.externalExecutions,0);
   assert.equal(plan.points,plan.tasks.reduce((s,t)=>s+t.points,0));
   const seen=new Set();
   for(const wave of plan.waves){
    assert.ok(wave.ids.length>=1&&wave.ids.length<=plan.capacity);
    for(const id of wave.ids){
     const task=plan.tasks.find(t=>t.id===id);
     assert.ok(task, "listed task missing");
     for(const dep of task.depends)assert.ok(seen.has(dep),id+" depends on "+dep);
    }
    for(const id of wave.ids)seen.add(id);
   }
   assert.deepEqual([...seen].sort(),[...ids].sort());
  }
 }
});
test("PR81: clean fixtures still demand real governance, rollback and human signoff",()=>{
 for(const type of Object.keys(SCENARIOS)){
  const p=build(type,recipe(type,"clear")),ids=p.tasks.map(x=>x.id);
  for(const id of ["SCOPE","OWNERS","SECURITY","ACCESS","CONNECT","OBSERVE","ROLLBACK","SIGNOFF"])
   assert.ok(ids.includes(id),type+" "+id);
  assert.equal(ids.includes("BLOCKS"),false);
  assert.equal(ids.includes("MISSING"),false);
  assert.equal(ids.includes("HUMAN"),false);
  assert.equal(ids.includes("PRIVACY"),false);
  assert.equal(p.taskCount,8);
 }
});
test("PR81: blocked and reviewing samples add relevant remediation tasks ahead of integration",()=>{
 const p=build(),ids=p.tasks.map(t=>t.id);
 for(const id of ["BLOCKS","MISSING","HUMAN"])assert.ok(ids.includes(id));
 const connector=p.tasks.find(t=>t.id==="CONNECT");
 assert.ok(connector.depends.includes("BLOCKS"));
 assert.ok(connector.depends.includes("MISSING"));
 assert.ok(connector.depends.includes("HUMAN"));
 const signoff=p.tasks.find(t=>t.id==="SIGNOFF");
 assert.ok(signoff.depends.includes("BLOCKS"));
 assert.ok(signoff.depends.includes("ROLLBACK"));
});
test("PR81: capacity changes scheduling, not tasks or relative effort",()=>{
 const p2=build("support",SCENARIOS.support.sample,2);
 const p5=build("support",SCENARIOS.support.sample,5);
 assert.deepEqual(p2.tasks,p5.tasks);
 assert.equal(p2.points,p5.points);
 assert.ok(p2.waves.length>=p5.waves.length);
 assert.equal(p2.capacity,2);
 assert.equal(p5.capacity,5);
 assert.deepEqual(PLAN_CAPACITIES,[2,3,4,5]);
 assert.deepEqual(PLAN_PHASES,["Definición","Preparación de datos","Gobernanza","Ensayo técnico","Autorización externa"]);
});
test("PR81: one-step simulated progress unlocks dependencies and never real approvals",()=>{
 const p=build(),initial=simulatePlanProgress(p);
 assert.deepEqual(initial.ready,["SCOPE"]);
 assert.equal(initial.realApprovals,0);
 assert.equal(initial.externalExecutions,0);
 assert.equal(initial.waitingExternal.length,1);
 const started=simulatePlanProgress(p,["SCOPE"]);
 assert.ok(started.ready.includes("OWNERS"));
 assert.ok(started.ready.includes("BLOCKS"));
 assert.equal(started.simulatedCount,1);
 assert.equal(started.remaining,p.taskCount-1);
});
test("PR81: dependencies cannot be bypassed, and signoff is always uncheckable",()=>{
 const p=build();
 assert.throws(()=>simulatePlanProgress(p,["CONNECT"]),/dependencias/);
 assert.throws(()=>simulatePlanProgress(p,["SIGNOFF"]),/no puede marcarse/);
 assert.throws(()=>simulatePlanProgress(p,["INVALID"]),/desconocida/);
 assert.throws(()=>simulatePlanProgress(p,["SCOPE","SCOPE"]),/duplicada/);
 assert.throws(()=>simulatePlanProgress(p,Array(p.tasks.length+1).fill("SCOPE")) ,/inválida/);
 assert.throws(()=>simulatePlanProgress(null),/plan válido/);
});
test("PR81: completing simulation in topological order does not authorize operation",()=>{
 const p=build(),simulated=[];
 for(const wave of p.waves){
  for(const id of wave.ids){
   if(id!=="SIGNOFF")simulated.push(id);
  }
 }
 const progress=simulatePlanProgress(p,simulated);
 assert.equal(progress.simulatedCount,p.taskCount-1);
 assert.equal(progress.status,"Simulación técnica ensayada; aún falta autorización real.");
 assert.deepEqual(progress.waitingExternal,["SIGNOFF"]);
 assert.equal(progress.realApprovals,0);
 assert.equal(progress.externalExecutions,0);
});
test("PR81: rollbacks of simulated progress only allowed when no simulated dependents remain",()=>{
 const p=build();
 const two=simulatePlanProgress(p,["SCOPE","OWNERS"]);
 assert.equal(two.simulatedCount,2);
 assert.throws(()=>simulatePlanProgress(p,["OWNERS"]),/dependencias/);
 assert.deepEqual(simulatePlanProgress(p,["SCOPE"]).simulated,["SCOPE"]);
});
test("PR81: plan exports never expose imported rows, emails, identities or notes",()=>{
 const source="pedido;cliente;email;total;estado\n"+
  "PRIVATE-CODE;Secreto S.A.;secret.contact@business.es;25;nuevo";
 const p=build("orders",source);
 const progress=simulatePlanProgress(p,["SCOPE"]);
 for(const artifact of [pilotPlanText(p,progress),pilotPlanJson(p,progress)]){
  for(const token of ["PRIVATE-CODE","Secreto S.A.","secret.contact@business.es","25;nuevo"])
   assert.equal(artifact.includes(token),false);
 }
 assert.match(pilotPlanText(p,progress),/Aprobaciones reales: 0/);
 assert.match(pilotPlanText(p,progress),/Acciones externas: 0/);
 assert.equal(JSON.parse(pilotPlanJson(p,progress)).progress.simulatedCount,1);
 assert.match(pilotPlanText(p),/VALIDACIÓN EXTERNA REQUERIDA/);
});
test("PR81: 80-row workplan is bounded, deterministic and does not mutate input",()=>{
 const source=["pedido;cliente;email;total;estado",
  ...Array.from({length:80},(_,i)=>"ID"+i+";Persona;test"+i+"@ejemplo.test;25;nuevo")].join("\n");
 const a=build("orders",source),b=build("orders",source);
 assert.deepEqual(a,b);
 assert.ok(a.taskCount<=14);
 assert.ok(a.waves.length<=14);
 assert.equal(a.scenario,"orders");
 assert.equal(a.blockedGates,0);
});
test("PR81: tampered readiness, forged approvals and arbitrary capacity are rejected",()=>{
 const valid=assessPilotReadiness("orders",SCENARIOS.orders.sample);
 for(const bad of [
  {...valid,scenario:"unknown"},
  {...valid,realApprovals:1},
  {...valid,remoteConnections:1},
  {...valid,checks:valid.checks.slice(1)},
  {...valid,checks:valid.checks.map((c,i)=>i===0?{...c,id:"MALICIOUS"}:c)}
 ])assert.throws(()=>createPilotExecutionPlan(bad));
 for(const cap of [0,1,6,10,2.5,"3",null])
  assert.throws(()=>createPilotExecutionPlan(valid,cap),/capacidad/);
});
