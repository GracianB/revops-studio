// V100 post-development UX audit. Static checks, not a human usability study.
// Pages under review: landing, public demo, technical lab, privacy and confirmation.
import {readFileSync,existsSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve,join} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";

export const UX_PUBLIC_PAGES=Object.freeze([
 "index.html","demo.html","laboratorio.html","privacidad.html","gracias.html","evaluacion.html,"revision.html"
]);
const rootPath=resolve(fileURLToPath(new URL("../",import.meta.url)));
const detailBlocks=["pilotUXToggle","pilotUXClose","pilotUXStatus",
 "pilotUXDetails","pilotUXMore","pilotGuidedList","pilotV100Title"];
function idsIn(html){
 return [...html.matchAll(/\sid=["']([^"']+)["']/g)].map(m=>m[1]);
}
function anchorsIn(html){
 return [...html.matchAll(/<a\b[^>]*\shref=["']([^"']+)["']/gi)]
  .map(m=>m[1]);
}
function pathFor(url){
 const trimmed=url.pathname.replace(/^\/revops(?:\/|$)/,"");
 const path=trimmed||"index.html";
 return path.endsWith("/")?path+"index.html":path;
}
export function auditV100UX(root=rootPath,{read=(path)=>readFileSync(path,"utf8"),
 exists=existsSync}={}){
 const pages={},problems=[],warnings=[];
 for(const path of UX_PUBLIC_PAGES){
  const full=join(root,path);
  if(!exists(full)){problems.push("PÁGINA_AUSENTE "+path);continue;}
  const source=String(read(full));
  const ids=idsIn(source),unique=new Set(ids);
  if(unique.size!==ids.length){
   const repeated=ids.filter((id,i)=>ids.indexOf(id)!==i);
   problems.push("IDs_REPETIDOS "+path+": "+[...new Set(repeated)].join(","));
  }
  if(!/<html\s[^>]*lang=["']es["']/.test(source))problems.push("IDIOMA "+path);
  if(!/<meta\s+name=["']viewport["']/.test(source))problems.push("VIEWPORT "+path);
  if((source.match(/<h1\b/gi)||[]).length!==1)problems.push("H1 "+path);
  if(!/<main\b[^>]*\bid=["'][^"']+["']/.test(source))
   problems.push("CONTENIDO_PRINCIPAL "+path);
  if(!/<a\b[^>]*class=["'][^"']*skip-link[^"']*["'][^>]*href=["']#/.test(source))
   problems.push("SALTO_TECLADO "+path);
  if(!/<nav\b[^>]*aria-label=["'][^"']+["']/.test(source))
   problems.push("NAVEGACION_SIN_ETIQUETA "+path);
  const links=anchorsIn(source);
  pages[path]={sizeBytes:Buffer.byteLength(source),ids:unique,links};
  if(source.length>58000)
   warnings.push("DENSIDAD_HTML "+path+": "+Math.round(source.length/1024)+" KB; revisar comprensión y rendimiento real.");
 }
 for(const [page,details] of Object.entries(pages)){
  for(const link of details.links){
   if(!link||link.startsWith("mailto:")||link.startsWith("tel:")||
     link.startsWith("javascript:")||link.startsWith("data:"))continue;
   let target;
   try{target=new URL(link,"https://revops.example/revops/"+page);}
   catch{problems.push("ENLACE_INVALIDO "+page+" → "+link);continue;}
   if(target.origin!=="https://revops.example")continue;
   const resolved=pathFor(target);
   const file=join(root,resolved);
   if(!exists(file)){
    problems.push("ENLACE_SIN_DESTINO "+page+" → "+link);
    continue;
   }
   if(target.hash){
    const id=decodeURIComponent(target.hash.slice(1));
    if(!id)continue;
    let targetIds=pages[resolved]?.ids;
    if(!targetIds)targetIds=new Set(idsIn(String(read(file))));
    if(!targetIds.has(id))
     problems.push("ANCLA_SIN_DESTINO "+page+" → "+link);
   }
  }
 }
 const demo=pages["demo.html"]?String(read(join(root,"demo.html"))):"";
 for(const id of detailBlocks)
  if(!demo.includes('id="'+id+'"'))problems.push("CONTROLES_UX "+id);
 if(!/<div id="pilotUXDetails"[^>]*\bhidden\b/.test(demo))
  problems.push("DETALLE_NO_PLEGADO");
 for(const id of ["clientOutcomeProof","clientOutcomeBlocked","clientOutcomeReview","clientOutcomePrepared"]){
  if(!demo.includes('id="'+id+'"'))problems.push("PR102_COMPARACION_AUSENTE "+id);
 }
 const guided=join(root,"assets/js/client-journey.js");
 if(!exists(guided)||!String(read(guided)).includes("buildGuidedOutcome"))
  problems.push("PR102_COMPARACION_NO_CONECTADA");
 const uat=join(root,"evaluacion.html");
 if(exists(uat)){
  const uatContent=String(read(uat));
  for(const id of ["uatTasks","uatObserved","uatExportJson","uatResetWarning","uatBoundary"])
   if(!uatContent.includes('id="'+id+'"'))problems.push("PR103_UAT_UI_MISSING "+id);
  if(!uatContent.includes('NO AUTORIZADO PARA PRODUCCIÓN'))
   problems.push("PR103_UAT_MISSING_NO_GO");
 }
 const chainPage=join(root,"revision.html");
 if(exists(chainPage)){
  const chainHtml=String(read(chainPage));
  if(!chainHtml.includes('id="chainBoundary"')||
    !chainHtml.includes('id="chainList"')||
    !chainHtml.includes('href="https://github.com/GracianB/revops-studio/pull/79"')||
    !chainHtml.includes('NO AUTORIZADA'))
   problems.push("PR104_REVIEW_BOUNDARY_MISSING");
 }
 if(!demo.includes("NO AUTORIZADO PARA PRODUCCIÓN"))
  problems.push("AVISO_NO_GO_AUSENTE");
 if(!demo.includes('data-client-step="problem"')||
  !demo.includes('data-client-step="finished"'))
  problems.push("RECORRIDO_BASICO_INCOMPLETO");
 const controller=join(root,"assets/js/pilot-control-center.js");
 if(!exists(controller)||!String(read(controller)).includes("mountPilotUX(root"))
  problems.push("VISTA_PROGRESIVA_NO_CONECTADA");
 const stylesheet=join(root,"assets/css/workflow-demo.css");
 if(!exists(stylesheet)||!String(read(stylesheet)).includes(".pilot-ux-details[hidden]"))
  problems.push("DETALLE_OCULTO_SIN_CSS");
 const workflow=join(root,".github/workflows/validate.yml");
 if(!exists(workflow)||!String(read(workflow)).includes("node scripts/ux-audit.mjs"))
  problems.push("AUDITORIA_NO_INCLUIDA_EN_CI");
 return Object.freeze({
  schema:"revops-v100-ux-audit-v1",
  technicalPass:problems.length===0,
  pagesReviewed:Object.keys(pages).length,
  localLinksReviewed:Object.values(pages).reduce((a,p)=>a+p.links.length,0),
  sections:{landing:"index.html",firstVisit:"demo.html",
   technical:"laboratorio.html",privacy:"privacidad.html",contactStatus:"gracias.html",humanAcceptance:"evaluacion.html",integrationReview:"revision.html"},
  progressivePilot:"summary-by-default / accessible details on demand",
  reportedProblems:Object.freeze(problems),
  observations:Object.freeze(warnings),
  humanUsabilityStudiesCompleted:0,
  manualAccessibilityVerified:0,
  productionGo:false,
  disclaimer:"Auditoría estructural del candidato V100, no evaluación con usuarios, captura visual completa de V1–V100 ni autorización empresarial."
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const report=auditV100UX();
 mkdirSync(".ci-artifacts",{recursive:true});
 writeFileSync(".ci-artifacts/v100-ux-audit.json",JSON.stringify(report,null,2)+"\n");
 if(report.reportedProblems.length){
  console.error("V100 UX AUDIT FAIL\n"+report.reportedProblems.join("\n"));
  process.exitCode=1;
 }else{
  console.log("V100 UX AUDIT PASS: "+report.pagesReviewed+
   " pages / "+report.localLinksReviewed+" navigation targets. "+
   "Manual usability and human accessibility reviews still pending.");
  report.observations.forEach(message=>console.log("OBSERVATION: "+message));
 }
}
