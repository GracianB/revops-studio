import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS,parseDelimited,runWorkflow,editWorkflowRecord,exportActionQueueCsv} from "../assets/js/workflow-engine.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {RULE_CATALOG,RULE_COUNTS,evaluatePolicy,describePolicy} from "../assets/js/workflow-policy.js";
import {createHumanReviewLedger,humanDecisionReport} from "../assets/js/human-decision.js";

test("PR75: one shared ordered rule catalog covers all 3 scenarios and 18 synthetic recipes",()=>{
 for(const type of Object.keys(SCENARIOS)){
  assert.equal(RULE_CATALOG[type].length,RULE_COUNTS[type]);
  assert.ok(RULE_CATALOG[type].length>=6);
  const names=new Set(RULE_CATALOG[type].map(x=>x.id));
  assert.equal(names.size,RULE_CATALOG[type].length);
  assert.deepEqual(RULE_CATALOG[type].map(x=>x.position),Array.from({length:names.size},(_,i)=>i+1));
  for(const mode of Object.keys(RECIPE_LABELS)){
   const source=recipe(type,mode),run=runWorkflow(type,source);
   const trace=describePolicy(type,source,run,parseDelimited);
   assert.equal(trace.total,run.rows.length);
   assert.equal(trace.traces.length,run.rows.length);
   assert.equal(trace.catalog.reduce((n,r)=>n+r.applied,0),run.rows.length);
   assert.equal(trace.pendingHuman,run.counts.revisar);
   assert.equal(trace.blocked,run.counts.bloqueado);
   for(let i=0;i<run.rows.length;i++){
    const t=trace.traces[i],r=run.rows[i];
    assert.equal(t.status,r.status);
    assert.equal(t.reason,r.reason);
    assert.ok(names.has(t.ruleId));
    assert.equal(t.execution,"NOT_EXECUTED");
    assert.equal(t.humanGate,r.status==="revisar");
    assert.equal(t.index,i);
   }
  }
 }
});
test("PR75: ID and duplicate rules take priority over downstream validation",()=>{
 const source="pedido;cliente;email;total;estado\n0001;Acme;a@b.es;10;nuevo\n0001;;not-an-email;-4;unknown";
 const output=runWorkflow("orders",source);
 const trace=describePolicy("orders",source,output,parseDelimited);
 assert.equal(trace.traces[1].ruleId,"ID-002");
 assert.equal(trace.traces[1].status,"bloqueado");
 assert.deepEqual(trace.traces[1].shadowed,["ORD-101","ORD-102","ORD-103","ORD-104"]);
 assert.equal(trace.overlapCount,1);
 assert.deepEqual(trace.overlaps,[{index:1,winning:"ID-002",shadowed:["ORD-101","ORD-102","ORD-103","ORD-104"]}]);
});
test("PR75: blank identifier, invalid client and broken status coexist without silent false approval",()=>{
 const source="pedido;cliente;email;total;estado\n; ;bad;-1;unknown";
 const out=runWorkflow("orders",source);
 const trace=describePolicy("orders",source,out,parseDelimited).traces[0];
 assert.equal(trace.ruleId,"ID-001");
 assert.equal(trace.overlap,true);
 assert.equal(trace.humanGate,false);
 assert.equal(trace.priority,1);
});
test("PR75: urgent open tickets always need human decision; closed tickets remain historical",()=>{
 const input=SCENARIOS.support.sample;
 const output=runWorkflow("support",input);
 const trace=describePolicy("support",input,output,parseDelimited);
 assert.equal(trace.traces[0].ruleId,"SUP-201");
 assert.equal(trace.traces[0].humanGate,true);
 assert.equal(trace.traces[3].ruleId,"ID-002");
 assert.equal(trace.traces[5].ruleId,"SUP-301");
 assert.equal(trace.traces[5].humanGate,false);
 const edited=editWorkflowRecord("support",input,3,{ticket:"TK-999"});
 const after=describePolicy("support",edited,runWorkflow("support",edited),parseDelimited);
 assert.equal(after.traces[3].ruleId,"SUP-201");
 assert.equal(after.traces[3].humanGate,true);
});
test("PR75: data negative reviews cannot become ready by presentation or annotations",()=>{
 const input=SCENARIOS.data.sample,result=runWorkflow("data",input);
 const trace=describePolicy("data",input,result,parseDelimited);
 assert.equal(trace.traces[3].ruleId,"DAT-201");
 assert.equal(trace.traces[3].status,"revisar");
 assert.equal(trace.traces[4].ruleId,"DAT-103");
 assert.equal(trace.traces[4].status,"bloqueado");
});
test("PR75: per-rule match counts and overlaps are fixed, auditable and do not include customer values",()=>{
 const input=SCENARIOS.orders.sample;
 const policy=describePolicy("orders",input,runWorkflow("orders",input),parseDelimited);
 assert.equal(policy.catalog.find(x=>x.id==="ID-002").applied,1);
 assert.equal(policy.catalog.find(x=>x.id==="ORD-102").applied,1);
 assert.equal(policy.catalog.find(x=>x.id==="ORD-201").applied,1);
 assert.equal(policy.catalog.find(x=>x.id==="ORD-302").applied,2);
 assert.equal(policy.externalExecuted,0);
 assert.equal(JSON.stringify(policy).includes("norte@ejemplo.test"),false);
 assert.equal(JSON.stringify(policy).includes("PED-101"),false);
});
test("PR75: stale or tampered engine output fails closed instead of inventing trace",()=>{
 const input=SCENARIOS.orders.sample,result=runWorkflow("orders",input);
 assert.throws(()=>describePolicy("data",input,result,parseDelimited),/incompatible/);
 const tampered={...result,rows:result.rows.map((r,i)=>i===0?{...r,reason:"Fake approval"}:r)};
 assert.throws(()=>describePolicy("orders",input,tampered,parseDelimited),/no coinciden/);
 const fewer={...result,rows:result.rows.slice(1)};
 assert.throws(()=>describePolicy("orders",input,fewer,parseDelimited),/otra muestra/);
 assert.throws(()=>evaluatePolicy("bad",{},{}),/no reconocido/);
});
test("PR75: human ledger accepts ONLY engine review rows and has finite states",()=>{
 const result=runWorkflow("support",SCENARIOS.support.sample),ledger=createHumanReviewLedger(result);
 assert.equal(ledger.summary().total,1);
 assert.equal(ledger.state(0).status,"pendiente");
 assert.equal(ledger.state(3),null);
 assert.throws(()=>ledger.set(3,"aprobación simulada","Se ha comprobado el caso"),/Solo las excepciones/);
 assert.throws(()=>ledger.set(0,"live CRM executed","not allowed"),/Estado de revisión/);
 const intermediate=ledger.set(0,"en revisión");
 assert.equal(intermediate.status,"en revisión");
 assert.equal(ledger.summary()["en revisión"],1);
 assert.equal(ledger.summary().realApprovals,0);
});
test("PR75: explicit simulation approval and rejection require justification, never affect actual output",()=>{
 const source=SCENARIOS.support.sample;
 const result=runWorkflow("support",source),ledger=createHumanReviewLedger(result);
 assert.throws(()=>ledger.set(0,"aprobación simulada"),/12 caracteres/);
 assert.throws(()=>ledger.set(0,"rechazada","muy corta"),/12 caracteres/);
 assert.throws(()=>ledger.set(0,"rechazada","x".repeat(241)),/240 caracteres/);
 const sampleNote="Se ha confirmado por revisión documental interna.";
 assert.equal(ledger.set(0,"aprobación simulada",sampleNote).status,"aprobación simulada");
 assert.equal(ledger.state(0).notePresent,true);
 assert.equal(ledger.summary().realApprovals,0);
 assert.equal(result.rows[0].status,"revisar");
 assert.doesNotMatch(exportActionQueueCsv(result),/TK-200/);
 assert.equal(ledger.set(0,"rechazada","No se puede aceptar con los datos disponibles.").status,"rechazada");
 assert.equal(ledger.reset().pendiente,1);
 assert.equal(ledger.state(0).notePresent,false);
});
test("PR75: report is strictly aggregate and never includes notes, IDs, names or emails",()=>{
 const source="ticket;asunto;prioridad;estado\nTICKET-SECRET;Documento interno privado;alta;abierto\nTK-2;Duda;media;abierto";
 const result=runWorkflow("support",source),policy=describePolicy("support",source,result,parseDelimited);
 const ledger=createHumanReviewLedger(result);
 ledger.set(0,"aprobación simulada","Se revisó con persona privada@email.test en la reunión interna.");
 const report=humanDecisionReport(policy,ledger);
 assert.match(report,/Aprobaciones reales verificadas: 0/);
 assert.match(report,/Acciones externas ejecutadas: 0/);
 assert.match(report,/SUP-201/);
 for(const secret of ["TICKET-SECRET","Documento interno privado","persona privada","@email.test","TK-2"])
  assert.equal(report.includes(secret),false);
 assert.throws(()=>humanDecisionReport(null,ledger),/Necesitas/);
 assert.throws(()=>humanDecisionReport(policy,createHumanReviewLedger(runWorkflow("orders",SCENARIOS.orders.sample))),/otro conjunto/);
});
test("PR75: case with zero human gates disables attempts at a fake approval",()=>{
 const input="pedido;cliente;email;total;estado\nO1;Tienda;x@ejemplo.test;10;nuevo";
 const result=runWorkflow("orders",input),policy=describePolicy("orders",input,result,parseDelimited),ledger=createHumanReviewLedger(result);
 assert.equal(policy.pendingHuman,0);
 assert.equal(ledger.summary().total,0);
 assert.deepEqual(ledger.list(),[]);
 assert.throws(()=>ledger.set(0,"en revisión",""),/Solo las excepciones/);
 assert.match(humanDecisionReport(policy,ledger),/Bandeja pendiente sin actuación: 0/);
});
