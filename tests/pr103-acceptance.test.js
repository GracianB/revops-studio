import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {auditUatPreparation} from "../scripts/pr103-acceptance.mjs";
const root=resolve(new URL("../",import.meta.url).pathname);
const read=(p,mode)=>readFileSync(p,mode);
test("PR103: UAT apparatus is fully wired but reports zero verified humans and NO-GO",()=>{
 const report=auditUatPreparation(root);
 assert.equal(report.technicalPass,true,report.problems.join("; "));
 assert.equal(report.totalProfiles,3);
 assert.equal(report.plannedTasks,15);
 assert.equal(report.observedRealParticipants,0);
 assert.equal(report.verifiedHumanStudies,0);
 assert.equal(report.verifiedManualAccessibility,0);
 assert.equal(report.independentSecurityApproval,false);
 assert.equal(report.operationalRollbackVerified,false);
 assert.equal(report.businessSignoff,false);
 assert.equal(report.productionGo,false);
 assert.equal(report.realApprovals,0);
 assert.equal(report.filesReviewed,report.filesExpected);
});
test("PR103: missing entrypoint, protocol warning or CI gate fail independently",()=>{
 const missing=auditUatPreparation(root,{exists:p=>!p.endsWith("/evaluacion.html")});
 assert.ok(missing.problems.some(p=>p==="MISSING evaluacion.html"));
 assert.equal(missing.technicalPass,false);
 const inaccurate=auditUatPreparation(root,{read:(path,mode)=>{
  const source=read(path,mode);
  if(path.endsWith("/evaluacion.html"))
   return source.replace("NO AUTORIZADO PARA PRODUCCIÓN","SE PUEDE PUBLICAR");
  if(path.endsWith("/validate.yml"))
   return source.replace("node scripts/pr103-acceptance.mjs","echo fake");
  return source;
 }});
 assert.equal(inaccurate.technicalPass,false);
 assert.ok(inaccurate.problems.includes("NO_GO_BOUNDARY_MISSING"));
 assert.ok(inaccurate.problems.includes("CI_UAT_GATE_MISSING"));
});
test("PR103: CI must execute real browser UAT coverage instead of string-only declarations",()=>{
 const unsafe=auditUatPreparation(root,{read:(path,mode)=>{
  const source=read(path,mode);
  if(path.endsWith("/browser-smoke.mjs"))
   return source.replace("await auditHumanUat(browser)","// manually skipped");
  return source;
 }});
 assert.equal(unsafe.technicalPass,false);
 assert.ok(unsafe.problems.includes("BROWSER_UAT_COVERAGE_MISSING"));
});
