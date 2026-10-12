import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS} from "../assets/js/workflow-engine.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {assessPilotReadiness} from "../assets/js/pilot-readiness.js";
import {createPilotExecutionPlan} from "../assets/js/pilot-plan.js";
import {buildPilotRiskRegister} from "../assets/js/pilot-risk-register.js";
import {buildPilotEvidenceLedger} from "../assets/js/pilot-evidence-ledger.js";
import {buildPilotCapacityExplorer} from "../assets/js/pilot-capacity-explorer.js";
import {buildPilotAuthorizationBoard} from "../assets/js/pilot-authorization-board.js";
import {runPilotFailureDrills} from "../assets/js/pilot-failure-drills.js";
import {buildPilotHandoffPack,pilotHandoffTxt,pilotHandoffHtml} from "../assets/js/pilot-handoff-pack.js";
const make=(scenario,source)=>{
 const ready=assessPilotReadiness(scenario,source),plan=createPilotExecutionPlan(ready);
 const risk=buildPilotRiskRegister(ready,plan),ledger=buildPilotEvidenceLedger(plan,risk);
 const capacity=buildPilotCapacityExplorer(ready);
 const board=buildPilotAuthorizationBoard({
  readiness:ready,plan,risks:risk,ledger,
  drills:runPilotFailureDrills(ready,plan,risk,ledger)
 });
 return buildPilotHandoffPack(board,plan,risk,ledger,capacity);
};
test("PR88: all 18 synthetic samples produce print-ready but unapproved handoff",()=>{
 for(const scenario of Object.keys(SCENARIOS))for(const variant of Object.keys(RECIPE_LABELS)){
  const pack=make(scenario,recipe(scenario,variant));
  const html=pilotHandoffHtml(pack),txt=pilotHandoffTxt(pack);
  assert.equal(pack.productionGo,false);
  assert.equal(pack.realApprovals,0);
  assert.equal(pack.externalExecutions,0);
  assert.equal(pack.gates.length,8);
  assert.ok(pack.work.length>1);
  assert.ok(html.startsWith("<!doctype html>"));
  assert.match(html,/@page\{size:A4/);
  assert.match(html,/NO AUTORIZADO PARA PRODUCCIÓN/);
  assert.match(txt,/Aprobaciones reales: 0/);
  assert.match(html,/Content-Security-Policy/);
  assert.doesNotMatch(html,/<script\b|<iframe\b|<img\b|https?:\/\//i);
 }
});
test("PR88: privacy export cannot contain source IDs, customer names or emails",()=>{
 const src="pedido;cliente;email;total;estado\nSECRET-P88;Sensitive Company;private@enterprise.com;19;nuevo";
 const pack=make("orders",src);
 for(const out of [pilotHandoffHtml(pack),pilotHandoffTxt(pack)])
  for(const value of ["SECRET-P88","Sensitive Company","private@enterprise.com"])
   assert.equal(out.includes(value),false);
});
test("PR88: html escapes unexpected text and rejects false approvals",()=>{
 const pack=make("support",SCENARIOS.support.sample);
 const tainted={...pack,headline:'<img src=x onerror=alert("bad")>'};
 const html=pilotHandoffHtml(tainted);
 assert.ok(html.includes("&lt;img"));
 assert.ok(!html.includes('<img src=x onerror'));
 assert.throws(()=>pilotHandoffHtml({...pack,productionGo:true}));
 assert.throws(()=>pilotHandoffTxt({...pack,realApprovals:1}));
});
test("PR88: scenario crossover and impossible production approvals cannot build handoff",()=>{
 const ready=assessPilotReadiness("orders",SCENARIOS.orders.sample);
 const plan=createPilotExecutionPlan(ready);
 const risk=buildPilotRiskRegister(ready,plan);
 const ledger=buildPilotEvidenceLedger(plan,risk);
 const board=buildPilotAuthorizationBoard({readiness:ready,plan,risks:risk,ledger});
 const cap=buildPilotCapacityExplorer(ready);
 assert.throws(()=>buildPilotHandoffPack({...board,productionGo:true},plan,risk,ledger,cap));
 assert.throws(()=>buildPilotHandoffPack(board,{...plan,scenario:"support"},risk,ledger,cap));
});
