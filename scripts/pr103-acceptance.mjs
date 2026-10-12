// PR103 · Candidate protocol inventory; NOT a UAT result or release approval.
import {readFileSync,existsSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve,join} from "node:path";
import {pathToFileURL} from "node:url";
import {createUatSession,UAT_PROFILES,UAT_TASKS} from "../assets/js/pilot-uat-protocol.js";
import {validatePilotExportJson} from "../assets/js/pilot-export-integrity.js";

const REQUIRED=Object.freeze([
 "evaluacion.html","assets/js/uat.js","assets/css/uat.css",
 "assets/js/pilot-uat-protocol.js","tests/pilot-uat-protocol.test.js",
 "docs/PR103-UAT-AND-RELEASE-RUNBOOK.md",
 "scripts/browser-smoke.mjs","demo.html",
 ".github/workflows/validate.yml"
]);
export function auditUatPreparation(root=process.cwd(),{read=readFileSync,exists=existsSync}={}){
 const problems=[],files=[];
 for(const path of REQUIRED){
  const absolute=join(resolve(root),path);
  if(!exists(absolute)){problems.push("MISSING "+path);continue;}
  const content=String(read(absolute,"utf8"));
  if(content.trim().length<55)problems.push("EMPTY "+path);
  files.push(path);
 }
 const safe=(p)=>exists(join(resolve(root),p))?
  String(read(join(resolve(root),p),"utf8")):"";
 const html=safe("evaluacion.html"),ci=safe(".github/workflows/validate.yml");
 const browser=safe("scripts/browser-smoke.mjs"),demo=safe("demo.html");
 if(!ci.includes("node scripts/pr103-acceptance.mjs"))
  problems.push("CI_UAT_GATE_MISSING");
 if(!browser.includes("async function auditHumanUat")||
  !browser.includes("await auditHumanUat(browser)"))
  problems.push("BROWSER_UAT_COVERAGE_MISSING");
 if(!demo.includes('href="./evaluacion.html"'))
  problems.push("UAT_DISCOVERY_MISSING");
 if(!html.includes("NO AUTORIZADO PARA PRODUCCIÓN"))
  problems.push("NO_GO_BOUNDARY_MISSING");
 if(!html.includes("No se han realizado pruebas reales"))
  problems.push("HUMAN_TESTING_BOUNDARY_MISSING");
 if(UAT_PROFILES.length!==3||UAT_TASKS.length!==15||
  new Set(UAT_TASKS.map(t=>t.id)).size!==15)
  problems.push("UAT_PROTOCOL_INCOMPLETE");
 for(const role of UAT_PROFILES){
  if(UAT_TASKS.filter(task=>task.profile===role.id).length!==5)
   problems.push("UAT_ROLE_MISSING_FIVE_TASKS "+role.id);
 }
 const empty=createUatSession().snapshot();
 if(empty.observed!==0||empty.reportedCompleted!==0||
   empty.independentVerification!==false||empty.productionGo!==false||
   empty.manualAccessibilityVerified!==0||empty.realApprovals!==0||
   empty.externalExecutions!==0)
  problems.push("FALSE_HUMAN_VERIFICATION");
 try{validatePilotExportJson(JSON.stringify(empty));}
 catch(error){problems.push("UNSAFE_EXPORT_SCHEMA: "+error.message);}
 return Object.freeze({
  schema:"revops-pr103-human-uat-preparation-v1",
  candidate:"LOCAL ACCEPTANCE PROTOCOL · NOT EXECUTED",
  totalProfiles:UAT_PROFILES.length,
  plannedTasks:UAT_TASKS.length,
  filesReviewed:files.length,filesExpected:REQUIRED.length,
  technicalPass:problems.length===0,problems:Object.freeze(problems),
  profiles:Object.freeze(UAT_PROFILES.map(p=>Object.freeze({
   id:p.id,planned:UAT_TASKS.filter(t=>t.profile===p.id).length
  }))),
  observedRealParticipants:0,verifiedHumanStudies:0,
  verifiedManualAccessibility:0,independentSecurityApproval:false,
  operationalRollbackVerified:false,businessSignoff:false,
  realApprovals:0,externalExecutions:0,productionGo:false,
  next:"Run actual observer sessions outside CI; independently validate and approve any production use.",
  disclaimer:"Automated checks validate only the readiness of the testing apparatus, never usability with real people, WCAG certification, operational integrations, release security or human approvals."
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const report=auditUatPreparation();
 mkdirSync(".ci-artifacts",{recursive:true});
 writeFileSync(".ci-artifacts/pr103-uat-preparation.json",JSON.stringify(report,null,2)+"\n");
 if(report.problems.length){
  console.error("PR103 PREPARATION FAILED: "+report.problems.join("; "));
  process.exitCode=1;
 }else console.log("PR103 UAT PREPARATION PASS: "+report.plannedTasks+
  " human tasks across "+report.totalProfiles+
  " profiles. REAL HUMAN TESTS 0. PRODUCTION NO-GO.");
}
