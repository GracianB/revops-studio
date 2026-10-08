import test from "node:test";
import assert from "node:assert/strict";
import { SCENARIOS,parseDelimited,runWorkflow,exportResultCsv,editWorkflowRecord,exportActionQueueCsv } from "../assets/js/workflow-engine.js";

test("all three real demo workflows process their examples with human exceptions",()=>{
  const counts={
    orders:{total:6,listo:3,revisar:1,bloqueado:2},
    support:{total:6,listo:3,revisar:1,bloqueado:2},
    data:{total:6,listo:3,revisar:1,bloqueado:2}
  };
  for(const name of Object.keys(counts)){
    const result=runWorkflow(name,SCENARIOS[name].sample);
    assert.deepEqual(result.counts,counts[name],name+" scenario counts");
    assert.equal(result.rows.length,6);
    assert.equal(result.steps.length,4);
    assert.ok(result.rows.some(r=>/Duplicado/.test(r.reason)),name+" detects duplicates");
    assert.ok(result.rows.some(r=>r.status==="revisar"),name+" needs human decision");
  }
});

test("CSV accepts semicolons, commas, escaped quotes, CRLF and UTF-8 BOM",()=>{
  const semis=parseDelimited('\uFEFFpedido;cliente;email;total;estado\r\nA-1;"Almacén ""Sol""";a@b.es;18,5;nuevo\r\n');
  assert.equal(semis.rows[0].cliente,'Almacén "Sol"');
  assert.equal(semis.rows[0].total,"18,5");
  const commas=parseDelimited('pedido,cliente,email,total,estado\nA-1,Acme,a@b.es,15.5,nuevo');
  assert.equal(commas.rows[0].pedido,"A-1");
  assert.equal(runWorkflow("orders",'pedido;cliente;email;total;estado\nA-1;Acme;a@b.es;18,5;nuevo').counts.listo,1);
});

test("invalid rows are blocked, duplicated IDs normalized and states do not become ready by accident",()=>{
  const input=[
    "pedido;cliente;email;total;estado",
    " ORD-1 ;Acme;x@acme.es;10;nuevo",
    "ord-1;Acme;x@acme.es;10;nuevo",
    "ORD-2;Acme;invalido;10;nuevo",
    "ORD-3;Acme;a@b.es;-1;nuevo",
    "ORD-4;Acme;a@b.es;10;inventado",
    "ORD-5;Acme;a@b.es;10;revisar"
  ].join("\n");
  const r=runWorkflow("orders",input);
  assert.deepEqual(r.counts,{total:6,listo:1,revisar:1,bloqueado:4});
  assert.match(r.rows[1].reason,/Duplicado/);
  assert.match(r.rows[2].reason,/Email/);
});

test("data validation rejects impossible calendar dates and malformed values",()=>{
  const input=[
    "registro;fuente;valor;fecha",
    "R-1;CRM;22;2026-02-30",
    "R-2;CRM;14;2026-02-28",
    "R-3;CRM;NaN;2026-02-28",
    "R-4;ERP;-3;2026-02-28"
  ].join("\n");
  const result=runWorkflow("data",input);
  assert.deepEqual(result.counts,{total:4,listo:1,revisar:1,bloqueado:2});
  assert.match(result.rows[0].reason,/Fecha inválida/);
});

test("CSV structural failures are actionable and fail closed",()=>{
  assert.throws(()=>runWorkflow("unknown","a,b\n1,2"),/no reconocido/);
  assert.throws(()=>parseDelimited(""),/al menos una fila/);
  assert.throws(()=>parseDelimited("a;a\n1;2"),/repetidos/);
  assert.throws(()=>runWorkflow("orders","a;b\n1;2"),/Cabeceras requeridas/);
  assert.throws(()=>parseDelimited('a;b\n"sin cierre;2'),/sin cerrar/);
  assert.throws(()=>parseDelimited("a;b\n1"),/fila 2/);
  assert.throws(()=>parseDelimited("x".repeat(12001)),/12.000/);
  assert.throws(()=>parseDelimited("a;b\n"+Array.from({length:81},(_,i)=>String(i)+";2").join("\n")),/80 registros/);
});

test("exported results contain reasons, quote-safe CSV and prevent spreadsheet formula injection",()=>{
  const input=["pedido;cliente;email;total;estado",
    'B-1;"=HYPERLINK(""bad"")";someone@example.test;15;nuevo',
    "B-2;Normal;normal@example.test;11;revisar"
  ].join("\n");
  const result=runWorkflow("orders",input);
  const output=exportResultCsv(result);
  assert.ok(output.startsWith("\uFEFF"));
  assert.match(output,/motivo/);
  assert.match(output,/acción/);
  assert.match(output,/"'=HYPERLINK\(""bad""\)"/);
  assert.match(output,/revisar/);
  assert.throws(()=>exportResultCsv(null),/Ejecuta/);
});


test("inline corrections repair duplicate IDs and rerun the complete workflow",()=>{
  const input=SCENARIOS.orders.sample;
  const original=runWorkflow("orders",input);
  assert.equal(original.counts.bloqueado,2);
  // Fourth physical record is a duplicated order.
  const edited=editWorkflowRecord("orders",input,2,{pedido:"PED-999"});
  const result=runWorkflow("orders",edited);
  assert.deepEqual(result.counts,{total:6,listo:4,revisar:1,bloqueado:1});
  assert.equal(result.rows[2].values.pedido,"PED-999");
  assert.equal(runWorkflow("orders",input).counts.bloqueado,2,"original text remains immutable");
});

test("inline correction serializes quoted delimiters and records safely",()=>{
  const source="ticket;asunto;prioridad;estado\nT-1;Original;alta;abierto";
  const fixed=editWorkflowRecord("support",source,0,{asunto:'Información; "urgente", revisar'});
  const r=runWorkflow("support",fixed);
  assert.equal(r.rows[0].values.asunto,'Información; "urgente", revisar');
  assert.equal(r.counts.revisar,1);
  assert.match(fixed,/""urgente""/);
});

test("an inline correction cannot change unknown fields, invalid rows or exceed size bounds",()=>{
  const input=SCENARIOS.data.sample;
  assert.throws(()=>editWorkflowRecord("data",input,-1,{fuente:"ok"}),/fila existente/);
  assert.throws(()=>editWorkflowRecord("data",input,99,{fuente:"ok"}),/fila existente/);
  assert.throws(()=>editWorkflowRecord("data",input,0,{__protoHack:"x"}),/Campo no permitido/);
  assert.throws(()=>editWorkflowRecord("data",input,0,{fuente:"a".repeat(401)}),/400 caracteres/);
  assert.throws(()=>editWorkflowRecord("data",input,0,{fuente:12}),/400 caracteres/);
  assert.throws(()=>editWorkflowRecord("data",input,0,null),/Corrección no válida/);
});

test("the prepared queue excludes historical items and unsafe states without running actions",()=>{
  const orders=runWorkflow("orders",SCENARIOS.orders.sample);
  const output=exportActionQueueCsv(orders);
  const parsed=parseDelimited(output);
  assert.equal(parsed.rows.length,2,"two new orders, not three ready statuses");
  assert.ok(parsed.rows.every(row=>row.estado==="Preparado, NO ejecutado"));
  assert.ok(parsed.rows.every(row=>row.pedido!=="PED-105"),"closed historical order excluded");
  assert.ok(parsed.rows.every(row=>row.pedido!=="PED-103"),"blocked order excluded");
  assert.ok(parsed.rows.every(row=>row.pedido!=="PED-104"),"human review order excluded");
  const support=parseDelimited(exportActionQueueCsv(runWorkflow("support",SCENARIOS.support.sample)));
  assert.equal(support.rows.length,2);
  assert.ok(!support.rows.some(row=>row.ticket==="TK-204"));
  assert.throws(()=>exportActionQueueCsv(null),/Ejecuta el proceso primero/);
});

test("the actionable queue remains CSV-formula-safe for spreadsheet consumers",()=>{
  const input='pedido;cliente;email;total;estado\nQ-1;"=HYPERLINK(""danger"")";test@example.test;11;nuevo';
  const csv=exportActionQueueCsv(runWorkflow("orders",input));
  assert.match(csv,/"'=HYPERLINK\(""danger""\)"/);
});
