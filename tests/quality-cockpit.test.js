import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS,runWorkflow,editWorkflowRecord} from "../assets/js/workflow-engine.js";
import {recipe} from "../assets/js/workflow-product-kit.js";
import {buildQualityCockpit,compareQualityCockpit,qualityCockpitReport} from "../assets/js/quality-cockpit.js";

test("PR73: all three native scenarios have verifiable completeness and decision totals",()=>{
 const expected={orders:{unique:5,missing:1},support:{unique:5,missing:1},data:{unique:5,missing:0}};
 for(const [scenario,spec] of Object.entries(expected)){
  const view=buildQualityCockpit(scenario,SCENARIOS[scenario].sample);
  assert.equal(view.total,6);
  assert.equal(view.uniqueIds,spec.unique);
  assert.equal(view.missingCells,spec.missing);
  assert.equal(view.flags.exactDuplicates.count,1);
  assert.equal(view.flags.conflictingIds.count,0);
  assert.equal(view.flags.blocked.count,2);
  assert.equal(view.flags.reviewing.count,1);
  assert.equal(view.completeness,Math.round(100*view.completeCells/(view.total*view.fields)));
  assert.match(view.limitation,/no equivale a exactitud/);
 }
});
test("PR73: per-column blanks have precise navigable indices",()=>{
 const view=buildQualityCockpit("orders",SCENARIOS.orders.sample);
 assert.deepEqual(view.blanks.email,{count:1,indexes:[3]});
 assert.equal(view.blanks.cliente.count,0);
 assert.equal(view.flags.missing.count,1);
 assert.deepEqual(view.flags.missing.indexes,[3]);
 assert.deepEqual(view.flags.blocked.indexes,[2,3]);
});
test("PR73: conflicting IDs differ from exact duplicate pairs",()=>{
 const source="pedido;cliente;email;total;estado\n1;Acme;a@b.es;10;nuevo\n1;Acme;a@b.es;10;nuevo\n1;Other;a@b.es;20;nuevo\n2;Acme;a@b.es;50;nuevo";
 const view=buildQualityCockpit("orders",source);
 assert.equal(view.uniqueIds,2);
 assert.deepEqual(view.flags.exactDuplicates.indexes,[1]);
 assert.deepEqual(view.flags.conflictingIds.indexes,[2]);
 assert.equal(view.blankId,0);
 const report=qualityCockpitReport(view);
 assert.match(report,/Conflictos de identificador: 1/);
 for(const bad of ["Acme","Other","a@b.es","\n1;"])assert.equal(report.includes(bad),false);
});
test("PR73: date and negative/invalid numeric detection are independently counted",()=>{
 const source="registro;fuente;valor;fecha\nR1;CRM;-2;2026-10-01\nR2;ERP;abc;2026-10-02\nR3;CRM;15;2026-02-30\nR4;CRM;100;2026-02-28";
 const v=buildQualityCockpit("data",source);
 assert.equal(v.flags.negatives.count,1);
 assert.equal(v.flags.invalidNumbers.count,1);
 assert.equal(v.flags.invalidDates.count,1);
 assert.deepEqual(v.flags.invalidDates.indexes,[2]);
 assert.equal(v.bands.find(x=>x.label==="No numéricos").count,1);
 assert.equal(v.stats.insufficient,true);
});
test("PR73: IQR candidates never treated as confirmed errors",()=>{
 const source="registro;fuente;valor;fecha\nR1;CRM;100;2026-10-01\nR2;CRM;110;2026-10-01\nR3;CRM;120;2026-10-01\nR4;CRM;130;2026-10-01\nR5;CRM;1000;2026-10-01";
 const v=buildQualityCockpit("data",source);
 assert.equal(v.stats.insufficient,false);
 assert.deepEqual(v.flags.outliers.indexes,[4]);
 assert.match(v.limitation,/sospechas estadísticas/);
 const equal=buildQualityCockpit("data",source.replace(/;110;|;120;|;130;|;1000;/g,";100;"));
 assert.equal(equal.stats.insufficient,true);
 assert.equal(equal.flags.outliers.count,0);
});
test("PR73: histogram totals equal all rows and exclude invalid values",()=>{
 for(const scenario of ["orders","data"]){
  const view=buildQualityCockpit(scenario,SCENARIOS[scenario].sample);
  assert.equal(view.bands.reduce((a,x)=>a+x.count,0),view.total);
  assert.ok(view.stats.sampleSize>=4);
 }
 const support=buildQualityCockpit("support",SCENARIOS.support.sample);
 assert.equal(support.bands.length,0);
 assert.equal(support.stats.insufficient,true);
});
test("PR73: highest-frequency block reason is derived from actual engine results",()=>{
 const source=recipe("orders","missing");
 const v=buildQualityCockpit("orders",source);
 const engine=runWorkflow("orders",source);
 const count=engine.rows.filter(x=>x.reason===v.dominant.reason).length;
 assert.equal(v.dominant.count,count);
 assert.equal(engine.rows[v.dominant.index].status,"bloqueado");
});
test("PR73: quality delta remains deterministic over same scenario",()=>{
 const original=SCENARIOS.orders.sample;
 const edited=editWorkflowRecord("orders",original,2,{pedido:"PED-999"});
 const a=buildQualityCockpit("orders",original),b=buildQualityCockpit("orders",edited);
 const comp=compareQualityCockpit(a,b);
 assert.equal(comp.delta.blocked,-1);
 assert.equal(comp.delta.exactDuplicates,-1);
 assert.equal(comp.delta.uniqueIds,1);
 assert.equal(comp.delta.missingCells,0);
 assert.equal(comp.externalExecuted,0);
 assert.deepEqual(comp,compareQualityCockpit(a,b));
 assert.throws(()=>compareQualityCockpit(a,buildQualityCockpit("data",SCENARIOS.data.sample)),/mismo escenario/);
});
test("PR73: aggregated export never contains user IDs or raw numeric values",()=>{
 const original="pedido;cliente;email;total;estado\nSensitive-77;Mercado Norte;norte@ejemplo.test;7894;nuevo\nSensitive-78;Móvil Sur;sur@ejemplo.test;35;nuevo";
 const view=buildQualityCockpit("orders",original);
 const report=qualityCockpitReport(view,compareQualityCockpit(view,view));
 for(const secret of ["Sensitive-77","Mercado Norte","norte@ejemplo.test","7894","Móvil Sur"])
  assert.equal(report.includes(secret),false);
 assert.match(report,/Acciones ejecutadas fuera del navegador: 0/);
 assert.match(report,/Integridad de celdas: 100 %/);
 assert.throws(()=>qualityCockpitReport(null),/No hay/);
});
test("PR73: reject mismatched result and scenario rather than fabricating reports",()=>{
 assert.throws(()=>buildQualityCockpit("fake",SCENARIOS.orders.sample),/no reconocido/);
 assert.throws(()=>buildQualityCockpit("orders","a;b\nx;y"),/columnas del escenario/);
 assert.throws(()=>buildQualityCockpit("orders",SCENARIOS.orders.sample,runWorkflow("data",SCENARIOS.data.sample)),/no corresponde/);
 const x=buildQualityCockpit("orders",SCENARIOS.orders.sample);
 assert.throws(()=>compareQualityCockpit(x,null),/mismo escenario/);
});
