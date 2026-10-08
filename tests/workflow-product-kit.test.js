import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS,parseDelimited,runWorkflow} from "../assets/js/workflow-engine.js";
import {RECIPE_LABELS,recipe,fieldGuide,issueColumn,orderRows,qualitySnapshot} from "../assets/js/workflow-product-kit.js";

test("18 editable fictitious datasets: six recipes per operational scenario",()=>{
 const modes=Object.keys(RECIPE_LABELS);
 assert.equal(modes.length,6);
 let count=0;
 for(const type of Object.keys(SCENARIOS)){
  for(const mode of modes){
   const src=recipe(type,mode);
   const result=runWorkflow(type,src);
   assert.ok(result.counts.total>=3,type+" "+mode);
   assert.equal(result.counts.total,result.rows.length);
   assert.equal(result.counts.total,result.counts.listo+result.counts.revisar+result.counts.bloqueado);
   assert.deepEqual(parseDelimited(src).headers,SCENARIOS[type].columns);
   if(mode==="clear")assert.equal(result.counts.bloqueado,0,"valid example "+type);
   if(mode==="duplicates")assert.ok(result.rows.some(x=>/Duplicado/.test(x.reason)),type);
   if(mode==="missing")assert.ok(result.counts.bloqueado>=2,type);
   if(mode==="review")assert.ok(result.counts.revisar>=2,type);
   if(mode==="limits")assert.ok(result.counts.bloqueado>=1,type);
   count++;
  }
 }
 assert.equal(count,18);
});

test("editing guide covers every field of every workflow with concrete context",()=>{
 let total=0;
 for(const [type,spec] of Object.entries(SCENARIOS)){
  for(const field of spec.columns){
   const help=fieldGuide(type,field);
   assert.ok(help.label.length>5,type+" "+field);
   assert.ok(help.help.length>15,type+" "+field);
   assert.ok(help.example.length>2);
   assert.ok(help.kind==="select" || help.kind==="text");
   total++;
  }
 }
 assert.equal(total,13);
 assert.deepEqual(fieldGuide("orders","estado").options,["nuevo","revisar","cerrado"]);
 assert.throws(()=>fieldGuide("orders","password"),/Campo no reconocido/);
});

test("specific failing field identified for duplicate IDs, empty data and numeric issues",()=>{
 const orders=runWorkflow("orders",SCENARIOS.orders.sample);
 assert.equal(issueColumn("orders",orders.rows[2]),"pedido");
 assert.equal(issueColumn("orders",orders.rows[3]),"email");
 const data=runWorkflow("data",SCENARIOS.data.sample);
 assert.equal(issueColumn("data",data.rows[2]),"registro");
 assert.equal(issueColumn("data",data.rows[4]),"valor");
 assert.equal(issueColumn("orders",null),null);
});

test("stable sorting retains original record indices for safe editing",()=>{
 const result=runWorkflow("orders",SCENARIOS.orders.sample);
 const byRisk=orderRows(result,"risk");
 assert.equal(byRisk[0].status,"bloqueado");
 assert.equal(byRisk[1].status,"bloqueado");
 assert.equal(byRisk[0].sourceIndex,2);
 assert.equal(byRisk[1].sourceIndex,3);
 assert.deepEqual(orderRows(result,"source").map(r=>r.sourceIndex),[0,1,2,3,4,5]);
 assert.equal(orderRows(result,"identifier").length,6);
 assert.equal(orderRows(result,"status").length,6);
 assert.throws(()=>orderRows(result,"not-an-order"),/Orden no disponible/);
});

test("quality health reflects missing cells only, never claims business savings",()=>{
 const orders=qualitySnapshot("orders",SCENARIOS.orders.sample);
 assert.equal(orders.rows,6);
 assert.equal(orders.columns,5);
 assert.equal(orders.totalCells,30);
 assert.equal(orders.emptyCells,1);
 assert.equal(orders.blanks.email,1);
 assert.equal(orders.completeness,97);
 assert.equal(orders.blocked,2);
 const clean=qualitySnapshot("support",recipe("support","clear"));
 assert.equal(clean.completeness,100);
 assert.equal(clean.emptyCells,0);
 assert.throws(()=>qualitySnapshot("data","a;b\n1;2"),/relaciona las columnas/);
 assert.throws(()=>recipe("orders","inventado"),/Ejemplo no disponible/);
});
