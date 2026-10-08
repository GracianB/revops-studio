import test from "node:test";
import assert from "node:assert/strict";
import {suggestMapping,normalizeMappedCsv} from "../assets/js/column-mapper.js";
import {SCENARIOS,runWorkflow,parseDelimited} from "../assets/js/workflow-engine.js";

test("recognizes scenario-specific synonyms without inspecting or leaking data",()=>{
  const input="Order ID;Company;Correo;Amount;Status;Internal note\n00123;Almacén;test@ejemplo.test;125;nuevo;confidencial";
  const suggestion=suggestMapping("orders",input);
  assert.deepEqual(suggestion.mapping,{
    pedido:"order id",cliente:"company",email:"correo",total:"amount",estado:"status"
  });
  assert.deepEqual(suggestion.unassigned,[]);
  assert.deepEqual(suggestion.ignored,["internal note"]);
  assert.equal(suggestion.rowCount,1);
  assert.equal(suggestion.samples.length,1);
  const normalized=normalizeMappedCsv("orders",input,suggestion.mapping);
  const result=runWorkflow("orders",normalized);
  assert.equal(result.counts.listo,1);
  assert.equal(result.rows[0].id,"00123","ID with leading zeros survives conversion");
  assert.doesNotMatch(normalized,/confidencial/,"unmapped columns excluded from adapted copy");
  assert.match(input,/Internal note/,"original not mutated");
});

test("handles accented alternate names for support and reporting",()=>{
  const support="Nº Ticket;Título;Urgencia;Situación\nINC-1;Acceso;alta;abierto";
  // The title, urgency, status can be suggested, while a truly ambiguous ID is manual.
  const s=suggestMapping("support",support);
  assert.equal(s.mapping.asunto,"título");
  assert.equal(s.mapping.prioridad,"urgencia");
  assert.equal(s.mapping.estado,"situación");
  assert.deepEqual(s.unassigned,["ticket"]);
  const fixed=normalizeMappedCsv("support",support,{...s.mapping,ticket:"nº ticket"});
  assert.equal(runWorkflow("support",fixed).counts.revisar,1);
  const data="Reference;System;Value;Date\nR01;ERP;015;2026-10-08";
  const mapped=suggestMapping("data",data);
  assert.deepEqual(mapped.unassigned,[]);
  assert.equal(runWorkflow("data",normalizeMappedCsv("data",data,mapped.mapping)).counts.listo,1);
});

test("never applies incomplete mappings or source-column collisions",()=>{
  const input="codigo;company;correo;amount;status\nA01;Tienda;foo@ejemplo.test;10;nuevo";
  const suggestion=suggestMapping("orders",input);
  assert.ok(suggestion.unassigned.includes("pedido"));
  assert.throws(()=>normalizeMappedCsv("orders",input,suggestion.mapping),/Falta relacionar el campo «pedido»/);
  const ok={...suggestion.mapping,pedido:"codigo"};
  assert.equal(runWorkflow("orders",normalizeMappedCsv("orders",input,ok)).counts.listo,1);
  assert.throws(()=>normalizeMappedCsv("orders",input,{...ok,email:"company"}),/más de un campo/);
  assert.throws(()=>normalizeMappedCsv("orders",input,{...ok,estado:"no-existe"}),/Falta relacionar/);
});

test("mapped CSV preserves semicolons, quotes and data strings as-is",()=>{
  const source='id;empresa;correo;importe;status\n"0007";"Almacén ""Norte""; Sur";mail@ejemplo.test;15,9;nuevo';
  const mapped=normalizeMappedCsv("orders",source,{
    pedido:"id",cliente:"empresa",email:"correo",total:"importe",estado:"status"
  });
  const result=runWorkflow("orders",mapped);
  assert.equal(result.rows[0].id,"0007");
  assert.equal(result.rows[0].values.cliente,'Almacén "Norte"; Sur');
  assert.equal(result.counts.listo,1);
});

test("rejects incorrect scenario, malformed CSV and invalid mapping objects",()=>{
  assert.throws(()=>suggestMapping("invalid","a;b\n1;2"),/no reconocido/);
  assert.throws(()=>suggestMapping("orders",'a;b\n"broken;2'),/sin cerrar/);
  assert.throws(()=>normalizeMappedCsv("orders",SCENARIOS.orders.sample,[]),/Selecciona una columna/);
  assert.throws(()=>normalizeMappedCsv("orders",SCENARIOS.orders.sample,null),/Selecciona una columna/);
  assert.equal(parseDelimited(normalizeMappedCsv("orders",SCENARIOS.orders.sample,{
    pedido:"pedido",cliente:"cliente",email:"email",total:"total",estado:"estado"
  })).rows.length,6);
});
