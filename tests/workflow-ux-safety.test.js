import test from "node:test";
import assert from "node:assert/strict";
import {parseDelimited,runWorkflow,exportVisibleRowsCsv,SCENARIOS} from "../assets/js/workflow-engine.js";

test("spreadsheet pasted TSV preserves columns, quoted tabs and zero-padded IDs",()=>{
 const tabbed='pedido\tcliente\temail\ttotal\testado\n00007\t"Almacén\tNorte"\tmail@ejemplo.test\t14,25\tnuevo';
 const parsed=parseDelimited(tabbed);
 assert.equal(parsed.headers.length,5);
 assert.equal(parsed.rows[0].cliente,"Almacén\tNorte");
 assert.equal(parsed.rows[0].pedido,"00007");
 const workflow=runWorkflow("orders",tabbed);
 assert.equal(workflow.counts.listo,1);
});

test("visible-only export honors filtered order without including other customer rows",()=>{
 const result=runWorkflow("orders",SCENARIOS.orders.sample);
 const visible=exportVisibleRowsCsv(result,[3,2]);
 const parsed=parseDelimited(visible);
 assert.equal(parsed.rows.length,2);
 assert.equal(parsed.rows[0].pedido,"PED-103");
 assert.equal(parsed.rows[1].pedido,"PED-101");
 assert.ok(!visible.includes("PED-102"),"hidden row excluded");
 assert.ok(!visible.includes("PED-104"),"review row excluded");
 assert.ok(!visible.includes("PED-105"),"historical row excluded");
});

test("visible-only export fails closed on invalid selection or duplicated source index",()=>{
 const result=runWorkflow("orders",SCENARIOS.orders.sample);
 assert.throws(()=>exportVisibleRowsCsv(result,null),/Ejecuta/);
 assert.throws(()=>exportVisibleRowsCsv(result,[2,2]),/no es válida/);
 assert.throws(()=>exportVisibleRowsCsv(result,[999]),/no es válida/);
 assert.throws(()=>exportVisibleRowsCsv(result,[-1]),/no es válida/);
 assert.throws(()=>exportVisibleRowsCsv(result,["2"]),/no es válida/);
 assert.ok(exportVisibleRowsCsv(result,[]).includes("resultado"),"an empty view yields headers only");
});

test("spreadsheet formula prefixed data remains escaped in filtered exports",()=>{
 const input="pedido;cliente;email;total;estado\nQ-5;=HYPERLINK(A1);contacto@ejemplo.test;15;nuevo";
 const visible=exportVisibleRowsCsv(runWorkflow("orders",input),[0]);
 assert.match(visible,/"'=HYPERLINK\(A1\)"/);
});
