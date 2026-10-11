import test from "node:test";
import assert from "node:assert/strict";
import { SCENARIOS,runWorkflow,editWorkflowRecord } from "../assets/js/workflow-engine.js";
import { compareWorkflow,comparisonReport } from "../assets/js/workflow-comparison.js";

test("R2: every scenario starts from actual rule-derived counters, never an assumed ROI",()=>{
  for(const [scenario,data] of Object.entries(SCENARIOS)){
    const baseline=runWorkflow(scenario,data.sample);
    const view=compareWorkflow(baseline,baseline);
    assert.equal(view.mode,"baseline");
    assert.equal(view.before.total,baseline.rows.length);
    assert.deepEqual(view.before,view.after);
    assert.deepEqual(view.transitions,[]);
    assert.equal(view.changed,0);
    assert.equal(view.delta.blocked,0);
    assert.equal(view.delta.prepared,0);
    assert.equal(view.externalExecuted,0);
    assert.match(view.limitation,/ROI/);
    assert.match(comparisonReport(view),/ejecutadas fuera del navegador: 0/);
  }
});
test("R2: correcting duplicate changes the real rule decision and counters",()=>{
  for(const [scenario,index,field,id] of [
    ["orders",2,"pedido","PED-999"],
    ["support",3,"ticket","TK-999"],
    ["data",2,"registro","REG-999"]
  ]){
    const src=SCENARIOS[scenario].sample,original=runWorkflow(scenario,src);
    const corrected=runWorkflow(scenario,editWorkflowRecord(scenario,src,index,{[field]:id}));
    const evidence=compareWorkflow(original,corrected);
    assert.equal(evidence.mode,"recalculated");
    assert.equal(evidence.comparable,true);
    assert.equal(evidence.before.total,evidence.after.total);
    assert.equal(evidence.delta.blocked,-1);
    assert.equal(evidence.delta.prepared,1);
    assert.equal(evidence.changed,1);
    assert.ok(evidence.transitions.some(x=>x.from==="bloqueado"&&x.to==="listo"&&x.count===1));
    assert.doesNotMatch(comparisonReport(evidence),new RegExp(id));
    assert.doesNotMatch(comparisonReport(evidence),/@ejemplo\.test/);
  }
});
test("R2: undo returns exactly to baseline and redo repeats the same evidence",()=>{
  const original=runWorkflow("orders",SCENARIOS.orders.sample);
  const changed=runWorkflow("orders",editWorkflowRecord("orders",SCENARIOS.orders.sample,2,{pedido:"PED-999"}));
  const a=compareWorkflow(original,changed);
  const undone=compareWorkflow(original,original);
  const redone=compareWorkflow(original,changed);
  assert.equal(a.delta.prepared,1);
  assert.equal(undone.mode,"baseline");
  assert.equal(undone.changed,0);
  assert.deepEqual(a,redone);
});
test("R2: different scenarios or row totals reject comparisons without invented change",()=>{
  const original=runWorkflow("orders",SCENARIOS.orders.sample);
  const another=runWorkflow("support",SCENARIOS.support.sample);
  const otherSize=runWorkflow("orders",SCENARIOS.orders.sample.split("\n").slice(0,-1).join("\n"));
  for(const item of [another,otherSize]){
    const result=compareWorkflow(original,item);
    assert.equal(result.comparable,false);
    assert.equal(result.mode,"incomparable");
    assert.deepEqual(result.transitions,[]);
    assert.throws(()=>comparisonReport(result),/No se puede exportar/);
  }
});
test("R2: aggregate export never discloses original row identifiers, names or emails",()=>{
  const original=runWorkflow("orders",SCENARIOS.orders.sample);
  const fixed=runWorkflow("orders",editWorkflowRecord("orders",SCENARIOS.orders.sample,2,{pedido:"PED-999"}));
  const text=comparisonReport(compareWorkflow(original,fixed));
  for(const secret of ["PED-101","PED-999","Tienda Norte","norte@ejemplo.test"])
    assert.equal(text.includes(secret),false);
  assert.match(text,/Antes: 2 propuestas, 2 bloqueados/);
  assert.match(text,/Después: 3 propuestas, 1 bloqueados/);
  assert.match(text,/Cambio de bloqueos: -1/);
  assert.match(text,/no mide tiempo ahorrado/i);
  assert.throws(()=>compareWorkflow(undefined,original),/Ejecuta primero/);
});
