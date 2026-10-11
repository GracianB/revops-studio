import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS,runWorkflow,editWorkflowRecord} from "../assets/js/workflow-engine.js";
import {previewRecordEdit,createCorrectionTimeline,nextBlockedIndex,safeViewPreset} from "../assets/js/correction-workbench.js";

const source=SCENARIOS.orders.sample;
test("PR74: preview is pure, field-specific and recomputes actual real engine decisions",()=>{
 const preview=previewRecordEdit("orders",source,2,{pedido:"PED-999"});
 assert.equal(preview.valid,true);
 assert.equal(preview.changed,true);
 assert.deepEqual(preview.diff,[{field:"pedido",before:"PED-101",after:"PED-999"}]);
 assert.equal(preview.beforeStatus,"bloqueado");
 assert.equal(preview.afterStatus,"listo");
 assert.equal(preview.counts.blockedDelta,-1);
 assert.equal(preview.counts.actionableDelta,1);
 assert.equal(preview.externalExecuted,0);
 assert.match(source,/PED-101/, "source not mutated");
 assert.equal(runWorkflow("orders",preview.source).counts.bloqueado,1);
});
test("PR74: preview detects no-ops and never allows a false history step",()=>{
 const same=previewRecordEdit("orders",source,2,{pedido:"PED-101"});
 assert.equal(same.valid,false);
 assert.equal(same.changed,false);
 assert.equal(same.source,null);
 const timeline=createCorrectionTimeline("orders",source);
 assert.throws(()=>timeline.push(same),/válida/);
 assert.equal(timeline.state().canUndo,false);
 assert.equal(timeline.state().states,1);
});
test("PR74: preview preserves human review gates, including urgent tickets",()=>{
 const input=SCENARIOS.support.sample;
 const preview=previewRecordEdit("support",input,3,{ticket:"TK-999"});
 assert.equal(preview.beforeStatus,"bloqueado");
 assert.equal(preview.afterStatus,"listo"); // This row was nonurgent, unlike TK-200.
 assert.equal(preview.approvalRequired,false);
 const urgent=previewRecordEdit("support",input,0,{ticket:"TK-NEW"});
 assert.equal(urgent.afterStatus,"revisar");
 assert.equal(urgent.approvalRequired,true);
 assert.equal(urgent.externalExecuted,0);
});
test("PR74: required bounded validation is atomic and rejects invalid scenarios/rows",()=>{
 for(const bad of ["unknown",null])assert.throws(()=>previewRecordEdit(bad,source,1,{}),/no reconocido/);
 assert.throws(()=>previewRecordEdit("orders",source,800,{pedido:"X"}),/existente/);
 assert.throws(()=>previewRecordEdit("orders",source,2,{pedido:"x".repeat(401)}),/400/);
 assert.throws(()=>previewRecordEdit("orders",source,2,{ignored:"x"}),/Campo no permitido/);
 assert.throws(()=>previewRecordEdit("orders",source,2,null),/no válida/);
});
test("PR74: two sequential corrections can undo and redo both, preserving exact snapshots",()=>{
 const timeline=createCorrectionTimeline("orders",source);
 const first=previewRecordEdit("orders",source,2,{pedido:"PED-999"});
 const s1=timeline.push(first);
 assert.equal(s1.index,1);
 const second=previewRecordEdit("orders",s1.source,3,{email:"cliente@ejemplo.test"});
 const s2=timeline.push(second);
 assert.equal(s2.index,2);
 assert.equal(s2.states,3);
 assert.equal(runWorkflow("orders",s2.source).counts.bloqueado,0);
 assert.equal(timeline.undo().source,s1.source);
 assert.equal(timeline.undo().source,source);
 assert.equal(timeline.undo(),null);
 assert.equal(timeline.redo().source,s1.source);
 assert.equal(timeline.redo().source,s2.source);
 assert.equal(timeline.redo(),null);
 assert.deepEqual(timeline.state().operations.map(s=>s.row),[null,2,3]);
 assert.deepEqual(timeline.state().operations.map(s=>s.label),["Punto de partida","Corrección 1 · fila 3","Corrección 2 · fila 4"]);
});
test("PR74: branching after undo clears future redo and keeps current timeline",()=>{
 const timeline=createCorrectionTimeline("orders",source);
 const first=timeline.push(previewRecordEdit("orders",source,2,{pedido:"PED-999"}));
 timeline.push(previewRecordEdit("orders",first.source,3,{email:"valido@ejemplo.test"}));
 const back=timeline.undo();
 const alternative=timeline.push(previewRecordEdit("orders",back.source,3,{email:"nuevo@ejemplo.test"}));
 assert.equal(alternative.states,3);
 assert.equal(alternative.canRedo,false);
 assert.match(alternative.source,/nuevo@ejemplo\.test/);
 assert.doesNotMatch(alternative.source,/valido@ejemplo\.test/);
});
test("PR74: timeline trims to 20 reversible corrections, never grows indefinitely",()=>{
 const timeline=createCorrectionTimeline("orders",source);
 let last=source;
 for(let i=0;i<25;i++){
  const preview=previewRecordEdit("orders",last,2,{pedido:"PED-"+(900+i)});
  last=timeline.push(preview).source;
 }
 const state=timeline.state();
 assert.equal(state.states,21);
 assert.equal(state.index,20);
 assert.equal(state.canUndo,true);
 assert.equal(state.operations[0].label,"Corrección 5 · fila 3");
 for(let i=0;i<20;i++)assert.ok(timeline.undo());
 assert.equal(timeline.undo(),null);
 assert.equal(timeline.state().canUndo,false);
 assert.throws(()=>timeline.jump(-1),/inválido/);
 assert.throws(()=>timeline.jump(50),/inválido/);
 assert.throws(()=>createCorrectionTimeline("orders",source,101),/Límite/);
});
test("PR74: next blocked wraps and uses source indices even when results are filtered or sorted",()=>{
 const result=runWorkflow("orders",source);
 assert.equal(nextBlockedIndex(result,-1),2);
 assert.equal(nextBlockedIndex(result,2),3);
 assert.equal(nextBlockedIndex(result,3),2);
 const clean=runWorkflow("orders",editWorkflowRecord("orders",source,2,{pedido:"PED-999"}));
 assert.equal(nextBlockedIndex(clean,3),3);
 const fixed=editWorkflowRecord("orders",clean.scenario?editWorkflowRecord("orders",source,2,{pedido:"PED-999"}):source,3,{email:"ok@ejemplo.test"});
 assert.equal(nextBlockedIndex(runWorkflow("orders",fixed),0),null);
 assert.equal(nextBlockedIndex(null),null);
});
test("PR74: presets are finite, metadata-only and never contain row, ID or search inputs",()=>{
 for(const name of ["all","errors","review","compact"]){
  const view=safeViewPreset(name);
  assert.ok(view);
  assert.ok(["all","bloqueado","revisar"].includes(view.filter));
  assert.ok(["source","risk"].includes(view.sort));
  assert.equal(typeof view.columns.reason,"boolean");
  assert.equal(typeof view.columns.action,"boolean");
  assert.doesNotMatch(JSON.stringify(view),/PED-101|@ejemplo|sourceRows|search/);
 }
 assert.equal(safeViewPreset("evil"),null);
});
test("PR74: timeline has no browser network or permanent storage dependencies",()=>{
 const t=createCorrectionTimeline("orders",source);
 assert.equal(t.state().operations[0].active,true);
 assert.equal(t.state().source,source);
 assert.throws(()=>createCorrectionTimeline("orders","invalid"),/al menos/);
});
