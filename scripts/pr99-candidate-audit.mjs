// PR99 · Reproducible candidate INVENTORY audit, not a production/security certificate.
import {createHash} from "node:crypto";
import {existsSync,readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve,join} from "node:path";
import {pathToFileURL} from "node:url";
export const CANDIDATE_MODULES=Object.freeze([
 "pilot-readiness","pilot-plan","pilot-risk-register","pilot-evidence-ledger",
 "pilot-failure-drills","pilot-control-center","pilot-capacity-explorer",
 "pilot-authorization-board","pilot-handoff-pack","pilot-stress-matrix",
 "pilot-validation-atlas","pilot-section-navigation","pilot-guided-route",
 "pilot-session-journal","pilot-evidence-review","pilot-supervised-review",
 "pilot-export-integrity","pilot-computation-cache","pilot-accessibility-protocol",
 "pilot-v100-snapshot",
 "pilot-ux-progressive","pilot-uat-protocol"
]);
const SUPPORT=Object.freeze([
 "assets/js/workflow-demo.js","assets/css/workflow-demo.css",
 "demo.html","scripts/browser-smoke.mjs","scripts/performance-budget.mjs",
 "scripts/pr80-acceptance.mjs",".github/workflows/validate.yml",
 "docs/PR96-INTEGRIDAD-EXPORTACIONES.md","docs/PR97-RENDIMIENTO-LOCAL.md",
 "docs/PR98-ACCESIBILIDAD-PENDIENTE.md",
 "docs/PR100-REVOPS-MILESTONE.md","scripts/pr100-milestone-acceptance.mjs",
 "docs/V100-UX-AUDIT.md","scripts/ux-audit.mjs",
 "assets/js/guided-outcome.js","tests/guided-outcome.test.js","docs/PR102-GUIDED-PROOF.md",
 "evaluacion.html","assets/js/uat.js","assets/css/uat.css",
 "tests/pr103-acceptance.test.js","docs/PR103-UAT-AND-RELEASE-RUNBOOK.md",
 "scripts/pr103-acceptance.mjs"
]);
const FORBIDDEN=/\b(?:eval|fetch)\s*\(|\bnew\s+Function\b|\blocalStorage\b|\bsessionStorage\b|\bXMLHttpRequest\b/;
export function auditCandidate(root,{read=readFileSync,exists=existsSync}={}){
 const rootDir=resolve(root);
 const paths=[...CANDIDATE_MODULES.map(name=>"assets/js/"+name+".js"),
  ...CANDIDATE_MODULES.filter(n=>n!=="pilot-control-center").map(name=>
   "tests/"+name+".test.js"),...SUPPORT];
 const checked=[],problems=[];
 for(const path of paths){
  const fullPath=join(rootDir,path);
  if(!exists(fullPath)){problems.push("MISSING "+path);continue;}
  const content=String(read(fullPath,"utf8"));
  if(content.trim().length<55){problems.push("EMPTY "+path);continue;}
  const checksum=createHash("sha256").update(content).digest("hex");
  checked.push(Object.freeze({path,sha256:checksum,bytes:Buffer.byteLength(content)}));
  if(path.startsWith("assets/js/pilot-")&&FORBIDDEN.test(content))
   problems.push("UNEXPECTED_EXTERNAL_API "+path);
 }
 const get=name=>{
  const path=join(rootDir,name);
  return exists(path)?String(read(path,"utf8")):"";
 };
 const pipeline=get(".github/workflows/validate.yml");
 for(const step of ["npm run verify","npm run pr80:check",
  "node scripts/browser-smoke.mjs",
  "REVOPS_BROWSER=firefox node scripts/browser-smoke.mjs",
  "node scripts/performance-budget.mjs",
  "node scripts/pr99-candidate-audit.mjs",
  "node scripts/pr100-milestone-acceptance.mjs",
  "node scripts/ux-audit.mjs",
  "node scripts/pr103-acceptance.mjs"])
  if(!pipeline.includes(step))problems.push("CI_GATE_MISSING "+step);
 const source=get("assets/js/pilot-supervised-review.js");
 if(!source.includes('outcome:"NO AUTORIZADO PARA PRODUCCIÓN"')||
   !source.includes("productionGo:false"))
  problems.push("PRODUCTION_GO_BOUNDARY_MISSING");
 const accessibility=get("assets/js/pilot-accessibility-protocol.js");
 if(!accessibility.includes("manualVerified:0")||
  !accessibility.includes('state:"external_pending"'))
  problems.push("A11Y_MANUAL_BOUNDARY_MISSING");
 const security=get("assets/js/pilot-export-integrity.js");
 if(!security.includes("productionGo")||!security.includes("realApprovals"))
  problems.push("EXPORT_GUARD_MISSING");
 const sorted=[...checked].sort((a,b)=>a.path.localeCompare(b.path,"en"));
 const sha=createHash("sha256").update(sorted.map(item=>
  item.path+" "+item.sha256).join("\n")).digest("hex");
 return Object.freeze({
  schema:"revops-pr99-candidate-inventory-v1",
  candidate:"PR99 LOCAL TECHNICAL CHECKS",modules:CANDIDATE_MODULES.length,
  examinedFiles:checked.length,expectedFiles:paths.length,
  checks:Object.freeze(sorted),problems:Object.freeze(problems),
  fingerprint:sha,technicalPass:problems.length===0,
  productionGo:false,realApprovals:0,externalExecutions:0,
  manualAccessibilityVerified:0,
  disclaimer:"Inventario técnico de archivos y controles CI. El hash no es firma digital, certificación de seguridad, revisión legal ni autorización de producción."
 });
}
const isCli=process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(isCli){
 const report=auditCandidate(process.cwd());
 mkdirSync(".ci-artifacts",{recursive:true});
 writeFileSync(".ci-artifacts/pr99-candidate-inventory.json",JSON.stringify(report,null,2)+"\n");
 if(report.problems.length){
  console.error("PR99 CANDIDATE AUDIT FAIL: "+report.problems.join("; "));
  process.exitCode=1;
 }else console.log("PR99 CANDIDATE AUDIT PASS: "+
  report.examinedFiles+" files / "+report.modules+
  " modules, tracked integrity "+report.fingerprint.slice(0,16)+
  ", external release authorization NOT granted.");
}
