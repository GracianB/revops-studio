import test from "node:test";
import assert from "node:assert/strict";
import { SCENARIOS,runWorkflow } from "../assets/js/workflow-engine.js";
import {analyzeWorkflow,insightsReport} from "../assets/js/workflow-insights.js";

test("insights explicitly distinguish executable proposals from completed historical records",()=>{
  const result=runWorkflow("orders",SCENARIOS.orders.sample);
  const data=analyzeWorkflow(result);
  assert.equal(data.total,6);
  assert.equal(data.actionable,2);
  assert.equal(data.historical,1);
  assert.equal(data.blockedCount,2);
  assert.equal(data.reviewCount,1);
  assert.equal(data.ratio,33);
  assert.equal(data.distribution.reduce((sum,item)=>sum+item.count,0),6);
  assert.equal(data.steps[0].type,"bloqueado");
  assert.match(data.steps[0].detail,/Duplicado/);
  assert.ok(data.steps.some(step=>step.detail.includes("Ninguna acción se ejecuta")));
});

test("each of the three operations produces an actionable, honest prioritized plan",()=>{
  for(const type of ["orders","support","data"]){
    const summary=analyzeWorkflow(runWorkflow(type,SCENARIOS[type].sample));
    assert.ok(summary.steps.length>=3,type);
    assert.equal(summary.actionable,type==="data"?3:2);
    assert.equal(summary.historical,type==="data"?0:1,"only closed orders/tickets are historical");
    assert.ok(summary.blocked.length>=1);
    assert.ok(summary.review.length>=1);
  }
});

test("correction produces a real before-after change in actionable ratio",()=>{
  const original=runWorkflow("orders",SCENARIOS.orders.sample);
  const changed=runWorkflow("orders",SCENARIOS.orders.sample.replace(
    "PED-101;Tienda Norte;norte@ejemplo.test;1250;nuevo\nPED-103",
    "PED-999;Tienda Norte;norte@ejemplo.test;1250;nuevo\nPED-103"));
  assert.equal(analyzeWorkflow(original).actionable,2);
  assert.equal(analyzeWorkflow(changed).actionable,3);
  assert.equal(analyzeWorkflow(changed).blockedCount,1);
  assert.equal(analyzeWorkflow(changed).ratio,50);
});

test("report is useful but does not leak input rows, emails or identifying IDs",()=>{
  const result=runWorkflow("orders",SCENARIOS.orders.sample);
  const report=insightsReport(result,SCENARIOS.orders.title);
  for(const text of ["Acciones preparadas: 2","Históricos excluidos","Para revisión humana: 1",
    "Bloqueados: 2","MOTIVOS DE BLOQUEO","SIGUIENTES PASOS","no es una métrica de ahorro"])
    assert.ok(report.includes(text),text);
  for(const secret of ["PED-101","PED-105","norte@ejemplo.test","Tienda Norte"])
    assert.ok(!report.includes(secret),"unexpected input leaked in summary report: "+secret);
});

test("invalid insights and report requests fail explicitly",()=>{
  assert.throws(()=>analyzeWorkflow(null),/Ejecuta/);
  assert.throws(()=>insightsReport(undefined),/Ejecuta/);
});
