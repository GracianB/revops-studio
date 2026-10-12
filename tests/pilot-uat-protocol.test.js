import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createUatSession,UAT_PROFILES,UAT_TASKS,profileTasks}
 from "../assets/js/pilot-uat-protocol.js";
import {validatePilotExportJson} from "../assets/js/pilot-export-integrity.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("PR103: three real roles have five distinct accessible tasks with safe local destinations",()=>{
 assert.equal(UAT_PROFILES.length,3);
 assert.equal(UAT_TASKS.length,15);
 assert.equal(new Set(UAT_TASKS.map(t=>t.id)).size,15);
 for(const role of UAT_PROFILES){
  const tasks=profileTasks(role.id);
  assert.equal(tasks.length,5);
  for(const task of tasks){
   assert.ok(["./demo.html","./demo.html?view=advanced","./privacidad.html"].includes(task.url));
   assert.ok(task.maxSeconds>=90&&task.maxSeconds<=360);
   assert.ok(task.instruction.length>45&&task.success.length>50);
   assert.equal(task.profile,role.id);
  }
 }
 assert.throws(()=>profileTasks("administrator"));
});

test("PR103: empty session cannot imply users passed or real permissions were granted",()=>{
 const s=createUatSession().snapshot();
 assert.equal(s.total,15);
 assert.equal(s.observed,0);
 assert.equal(s.pending,15);
 assert.equal(s.reportedCompleted,0);
 assert.equal(s.independentVerification,false);
 assert.equal(s.manualAccessibilityVerified,0);
 assert.equal(s.realApprovals,0);
 assert.equal(s.externalExecutions,0);
 assert.equal(s.productionGo,false);
 assert.equal(s.tasks.filter(t=>t.outcome==="pending").length,15);
 assert.equal(s.profiles.reduce((total,p)=>total+p.total,0),15);
});

test("PR103: manual observations track blocking, help and duration without promoting them to release approvals",()=>{
 const session=createUatSession();
 session.record("op-find",{outcome:"completed",assistance:"none",seconds:45});
 session.record("an-export",{outcome:"failed",assistance:"hint",seconds:200});
 session.record("mo-a11y",{outcome:"blocked",assistance:"guided",seconds:600});
 const x=session.snapshot();
 assert.equal(x.observed,3);
 assert.equal(x.pending,12);
 assert.equal(x.reportedCompleted,1);
 assert.equal(x.reportedIssues,2);
 assert.equal(x.reportedOverTarget,2);
 assert.equal(x.reportedAssisted,2);
 assert.equal(x.reportedFriction,2);
 assert.deepEqual(x.profiles.map(p=>p.observed),[1,1,1]);
 assert.equal(x.productionGo,false);
 assert.equal(x.independentVerification,false);
 assert.equal(x.tasks.find(t=>t.id==="an-export").withinTarget,false);
 assert.equal(x.tasks.find(t=>t.id==="op-find").withinTarget,true);
 const report=session.json();
 assert.deepEqual(JSON.parse(report),x);
 assert.equal(validatePilotExportJson(report).valid,true);
 assert.match(session.text(),/NO AUTORIZADA/);
 session.clear();
 assert.equal(session.snapshot().observed,0);
});

test("PR103: all 15 self-reported passes still NEVER authorize independent launch",()=>{
 const session=createUatSession();
 for(const task of UAT_TASKS)
  session.record(task.id,{outcome:"completed",assistance:"none",seconds:45});
 const report=session.snapshot();
 assert.equal(report.reportedCompleted,15);
 assert.equal(report.pending,0);
 assert.equal(report.reportedIssues,0);
 assert.equal(report.manualObservationsSelfReported,true);
 assert.equal(report.independentVerification,false);
 assert.equal(report.productionGo,false);
 assert.equal(report.realApprovals,0);
 assert.doesNotMatch(session.text(),/PRODUCCI[ÓO]N AUTORIZADA/);
});

test("PR103: unknown tasks, user-supplied text, forged outcomes or invalid timings fail closed",()=>{
 const session=createUatSession();
 const proper={outcome:"completed",assistance:"none",seconds:45};
 assert.throws(()=>session.record("unlisted",proper));
 for(const bad of [
  null,[],{}, {...proper,email:"secret@company.test"},
  {...proper,realApprovals:1}, {...proper,outcome:"approved"},
  {...proper,assistance:"unspecified"}, {...proper,seconds:0},
  {...proper,seconds:3601}, {...proper,seconds:NaN},
  {...proper,seconds:"50"}, {...proper,seconds:1.5},
  {...proper,seconds:Infinity}
 ])assert.throws(()=>session.record("op-find",bad));
 assert.equal(session.snapshot().observed,0);
});

test("PR103: no customer text, notes or replay data enter exported reports",()=>{
 const session=createUatSession();
 session.record("op-find",{outcome:"completed",assistance:"none",seconds:55});
 const payload=session.json()+session.text();
 for(const fragment of ["PED-101","gracian@empresa.es","rawRows","customerName","CSV fuente","Contraseña privada"])
  assert.equal(payload.includes(fragment),false);
 assert.equal(validatePilotExportJson(session.json()).productionGo,false);
 const injected=JSON.parse(session.json());
 injected.tasks[0].email="secret@company.test";
 assert.throws(()=>validatePilotExportJson(JSON.stringify(injected)),/privado|privada/i);
 injected.tasks[0].email=undefined;
 injected.productionGo=true;
 assert.throws(()=>validatePilotExportJson(JSON.stringify(injected)),/lanzamiento/);
});

test("PR103: UAT UI preserves semantic labels, two export forms, session reset and no network",()=>{
 const html=read("evaluacion.html"),js=read("assets/js/uat.js"),css=read("assets/css/uat.css");
 for(const id of ["main","uatTasks","uatObserved","uatPassed","uatIssues","uatFriction",
  "uatExportJson","uatExportTxt","uatResetWarning","uatResetConfirm","uatResetCancel",
  "uatBoundary","uatStatus","uatRoles","uatRoleProgress"]){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 }
 assert.match(html,/class="skip-link" href="#main"/);
 assert.match(html,/NO AUTORIZADO PARA PRODUCCIÓN/);
 assert.match(html,/noindex,nofollow/);
 assert.match(js,/validatePilotExportJson\(content\)/);
 assert.match(js,/URL\.revokeObjectURL/);
 assert.match(js,/session\.clear\(\)/);
 assert.match(js,/setAttribute\("aria-pressed"/);
 assert.doesNotMatch(js,/\bfetch\s*\(|localStorage|sessionStorage|XMLHttpRequest|\bWebSocket\b/);
 assert.match(css,/forced-colors:active/);
 assert.match(css,/max-width:560px/);
});
