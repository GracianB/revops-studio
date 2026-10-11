import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS,runWorkflow,editWorkflowRecord} from "../assets/js/workflow-engine.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {assessPilotReadiness,pilotReadinessText,pilotReadinessJson,PILOT_ACTIONS} from "../assets/js/pilot-readiness.js";

test("PR80: baseline samples retain real blockers, human reviews and zero execution",()=>{
 for(const [type,config] of Object.entries(SCENARIOS)){
  const result=runWorkflow(type,config.sample);
  const v=assessPilotReadiness(type,config.sample,result);
  assert.equal(v.checks.length,8);
  assert.equal(v.metrics.total,result.counts.total);
  assert.equal(v.metrics.blocked,result.counts.bloqueado);
  assert.equal(v.metrics.review,result.counts.revisar);
  assert.equal(v.suitableForSupervisedDemo,false);
  assert.equal(v.realApprovals,0);
  assert.equal(v.actionsExecuted,0);
 }
});
test("PR80: clean fixtures qualify only for an explicit supervised demonstration",()=>{
 for(const type of Object.keys(SCENARIOS)){
  const input=recipe(type,"clear"),v=assessPilotReadiness(type,input,runWorkflow(type,input));
  assert.equal(v.passed,8);
  assert.equal(v.blockers,0);
  assert.equal(v.attentions,0);
  assert.equal(v.outcome,"muestra apta para ensayo supervisado");
  assert.match(v.disclaimer,/No certifica software de producción/);
 }
});
test("PR80: 18 synthetic recipes reconcile aggregate totals and action targets",()=>{
 for(const type of Object.keys(SCENARIOS)){
  for(const mode of Object.keys(RECIPE_LABELS)){
   const source=recipe(type,mode),v=assessPilotReadiness(type,source);
   assert.equal(v.passed+v.attentions+v.blockers,8);
   assert.equal(v.metrics.prepared+v.metrics.historical+v.metrics.review+v.metrics.blocked,v.metrics.total);
   for(const check of v.checks){
    assert.ok(["pass","attention","blocked"].includes(check.state));
    assert.ok(Object.hasOwn(PILOT_ACTIONS,check.action));
   }
  }
 }
});
test("PR80: correcting a duplicate changes checked metrics, not the human approval policy",()=>{
 const type="orders",source=SCENARIOS.orders.sample;
 const before=assessPilotReadiness(type,source);
 const edited=editWorkflowRecord(type,source,2,{pedido:"PED-999"});
 const after=assessPilotReadiness(type,edited);
 assert.equal(after.metrics.blocked,before.metrics.blocked-1);
 assert.equal(after.metrics.prepared,before.metrics.prepared+1);
 assert.equal(after.metrics.review,1);
 assert.equal(after.suitableForSupervisedDemo,false);
});
test("PR80: checks distinguish privacy risk, duplicates and absence of usable actions",()=>{
 const sensitive="pedido;cliente;email;total;estado\nA1;=SUM(1);person@business.com;15;nuevo";
 const audit=assessPilotReadiness("orders",sensitive);
 assert.equal(audit.metrics.nonExampleEmails,1);
 assert.equal(audit.metrics.formulaLike,1);
 assert.equal(audit.checks.find(c=>c.id==="PIL-04").state,"attention");
 const duplicates="pedido;cliente;email;total;estado\nX1;A;a@ejemplo.test;10;cerrado\nX1;B;b@ejemplo.test;12;cerrado";
 const d=assessPilotReadiness("orders",duplicates);
 assert.equal(d.metrics.conflicts,1);
 assert.equal(d.metrics.prepared,0);
 assert.equal(d.checks.find(c=>c.id==="PIL-07").state,"attention");
});
test("PR80: stale result snapshots cannot produce a false green status",()=>{
 const type="support",source=SCENARIOS.support.sample,result=runWorkflow(type,source);
 const fake={...result,rows:result.rows.map((r,i)=>i===0?{...r,status:"listo"}:r)};
 assert.throws(()=>assessPilotReadiness(type,source,fake),/han cambiado/);
 assert.throws(()=>assessPilotReadiness(type,source,{...result,rows:result.rows.slice(1)}),/no pertenece/);
 assert.throws(()=>assessPilotReadiness("unknown",source),/no reconocido/);
});
test("PR80: evidence TXT/JSON only include aggregates and 0 approved or executed actions",()=>{
 const src="pedido;cliente;email;total;estado\nROW-PRIVATE;Private Company;tester@business.com;99;nuevo";
 const v=assessPilotReadiness("orders",src);
 for(const document of [pilotReadinessText(v),pilotReadinessJson(v)]){
  assert.equal(document.includes("ROW-PRIVATE"),false);
  assert.equal(document.includes("Private Company"),false);
  assert.equal(document.includes("tester@business.com"),false);
 }
 assert.match(pilotReadinessText(v),/Acciones externas ejecutadas: 0/);
 assert.match(pilotReadinessText(v),/Aprobaciones reales verificadas: 0/);
 assert.equal(JSON.parse(pilotReadinessJson(v)).checks.length,8);
});
test("PR80: 80-row dataset is deterministic and produces bounded evidence",()=>{
 const source=["pedido;cliente;email;total;estado",
  ...Array.from({length:80},(_,i)=>"O"+i+";Equipo;user"+i+"@ejemplo.test;10;nuevo")].join("\n");
 const a=assessPilotReadiness("orders",source),b=assessPilotReadiness("orders",source);
 assert.deepEqual(a,b);
 assert.equal(a.suitableForSupervisedDemo,true);
 assert.ok(pilotReadinessText(a).length<12000);
});
