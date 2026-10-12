// PR104 · Explicit audit of stacked PR69–103, not a merge instruction or release approval.
// --live reads only GitHub public metadata using a read-only workflow token.
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";

const SHA=/^[0-9a-f]{40}$/;
const REPOSITORY="GracianB/revops-studio";
export const CHAIN_SCOPE=Object.freeze({first:69,last:103});
export const CHAIN_STAGES=Object.freeze([
 Object.freeze({id:"product",label:"Base y experiencia",from:69,to:79}),
 Object.freeze({id:"pilot",label:"Piloto y trazabilidad",from:80,to:90}),
 Object.freeze({id:"controls",label:"Controles y preparación",from:91,to:100}),
 Object.freeze({id:"acceptance",label:"Usabilidad y aceptación",from:101,to:103})
]);
export const KNOWN_GAP=Object.freeze({
 pr:79,ancestor:"56a96b1a4514782abdca8bd9184201a5fd29ee4e",
 mergeBase:"4a174f0ad7bb81eb5f680ed697fbfe166a4900ea",
 missingCommit:"test(pr78): browser-native DOM selector uses :not([hidden]), not Playwright-only :visible"
});
export function loadSnapshot(path="docs/pr104-integration-snapshot.json"){
 return JSON.parse(readFileSync(path,"utf8"));
}
const issue=(code,message,number=null)=>Object.freeze({code,message,pr:number});
export function auditIntegrationChain(snapshot,{live=null}={}){
 const problems=[],warnings=[],items=[];
 if(!snapshot||snapshot.schema!=="revops-pr104-integration-snapshot-v1"||
   snapshot.repository!==REPOSITORY||
   snapshot.scope?.firstPr!==CHAIN_SCOPE.first||
   snapshot.scope?.lastPr!==CHAIN_SCOPE.last||
   snapshot.root?.branch!=="main"||!SHA.test(snapshot.root.sha||""))
  problems.push(issue("INVALID_SNAPSHOT","Snapshot of GitHub chain is missing or invalid."));
 const prs=Array.isArray(snapshot?.prs)?snapshot.prs:[];
 if(prs.length!==35)problems.push(issue("INVALID_COUNT","Expected 35 PRs, found "+prs.length));
 const numbers=new Set(),branches=new Set(),shas=new Set();
 for(let i=0;i<prs.length;i++){
  const p=prs[i],expected=CHAIN_SCOPE.first+i;
  if(!p||p.number!==expected)problems.push(issue("PR_GAP","Expected PR #"+expected,expected));
  if(!SHA.test(p?.headSha||"")||!SHA.test(p?.baseSha||""))
   problems.push(issue("INVALID_SHA","Invalid head/base SHA",p?.number));
  if(!p?.head||typeof p.head!=="string"||
     !p.base||typeof p.base!=="string")
   problems.push(issue("INVALID_REF","Missing named branch",p?.number));
  if(numbers.has(p?.number)||branches.has(p?.head)||shas.has(p?.headSha))
   problems.push(issue("DUPLICATE","Duplicate PR number, branch or commit",p?.number));
  numbers.add(p?.number);branches.add(p?.head);shas.add(p?.headSha);
  const expectedBase=i===0?"main":prs[i-1]?.head;
  if(p?.base!==expectedBase)
   problems.push(issue("CHAIN_BROKEN","Expected base "+expectedBase+", got "+p?.base,p?.number));
  if(p?.draft!==true||p?.status!=="open")
   problems.push(issue("UNSAFE_PR_STATE","Snapshot PR is no longer open draft",p?.number));
  if(p?.compareStatus!=="ahead"&&p?.compareStatus!=="diverged")
   problems.push(issue("UNKNOWN_ANCESTRY","No positive compare result",p?.number));
  if(!Number.isSafeInteger(p?.compareAhead)||p.compareAhead<1||
     !Number.isSafeInteger(p?.compareBehind)||p.compareBehind<0)
   problems.push(issue("INVALID_COMPARE","Invalid ancestry distance",p?.number));
  const stage=CHAIN_STAGES.find(s=>p.number>=s.from&&p.number<=s.to);
  if(!stage)problems.push(issue("UNSCOPED_PR","No review phase assigned",p?.number));
  const behind=p?.compareBehind||0;
  if(behind>0){
   warnings.push(issue("MISSING_ANCESTOR","PR #"+p.number+" is behind parent by "+
    behind+" commit(s). Reconcile ancestry before promotion.",p.number));
  }
  items.push(Object.freeze({number:p.number,branch:p.head,headSha:p.headSha,
   base:p.base,baseSha:p.baseSha,stage:stage?.id||null,
   behind, ahead:p.compareAhead,compareStatus:p.compareStatus,
   draft:p.draft,link:"https://github.com/"+REPOSITORY+"/pull/"+p.number}));
 }
 if(prs[0]?.baseSha!==snapshot?.root?.sha)
  problems.push(issue("BASELINE_DRIFT","First PR base is not pinned main SHA",69));
 const missing=prs.filter(p=>p.compareBehind>0);
 if(missing.length!==1||missing[0].number!==KNOWN_GAP.pr||
    missing[0].compareBehind!==1||
    snapshot?.comparisons?.["79"]?.missingAncestor!==KNOWN_GAP.ancestor||
    snapshot?.comparisons?.["79"]?.mergeBase!==KNOWN_GAP.mergeBase)
  problems.push(issue("UNREVIEWED_ANCESTRY","Unexpected ancestry state; refresh GitHub comparison snapshot."));
 if(snapshot?.productionGo!==false||snapshot?.humanSignoff!==false||
   snapshot?.independentSecurityReview!==false||
   snapshot?.rollbackExerciseVerified!==false||
   snapshot?.manualAccessibilityVerified!==0||
   snapshot?.observedRealUat!==0)
  problems.push(issue("FALSE_RELEASE_AUTHORIZATION","Candidate falsely declares an external approval."));
 if(live){
  if(live.mainSha!==snapshot.root?.sha)
   problems.push(issue("MAIN_MOVED","main changed; reconcile before any integration."));
  const mapped=new Map((live.prs||[]).map(x=>[x.number,x]));
  for(const p of prs){
   const current=mapped.get(p.number);
   if(!current){problems.push(issue("MISSING_LIVE_PR","Missing active GitHub PR",p.number));continue;}
   for(const key of ["head","headSha","base","baseSha"]){
    if(current[key]!==p[key])
     problems.push(issue("LIVE_DRIFT","GitHub "+key+" changed since snapshot",p.number));
   }
   if(current.draft!==true||current.status!=="open")
    problems.push(issue("LIVE_STATE","GitHub PR no longer open draft",p.number));
   const comparison=(live.comparisons||{})[p.number];
   if(!comparison){
    problems.push(issue("LIVE_COMPARISON_MISSING","No ancestry check for edge",p.number));
   }else if(comparison.status!==p.compareStatus||
     comparison.ahead!==p.compareAhead||comparison.behind!==p.compareBehind){
    problems.push(issue("LIVE_ANCESTRY_DRIFT",
     "Actual GitHub ancestry differs. Refresh before promotion.",p.number));
   }
  }
 }
 const stages=CHAIN_STAGES.map(stage=>{
  const members=items.filter(p=>p.stage===stage.id);
  return Object.freeze({id:stage.id,label:stage.label,
   count:members.length,from:stage.from,to:stage.to,
   blockers:members.filter(p=>p.behind>0).map(p=>p.number)});
 });
 const structurallyValid=problems.length===0;
 const external=[
  {id:"human-uat",state:"pending",note:"No verified independent human UAT."},
  {id:"accessibility",state:"pending",note:"Eight manual accessibility obligations unresolved."},
  {id:"security-privacy",state:"pending",note:"Independent security and privacy review outstanding."},
  {id:"integration-rollback",state:"pending",note:"Real external integration/rollback drill missing."},
  {id:"business-signoff",state:"pending",note:"Responsible business approval missing."}
 ];
 return Object.freeze({
  schema:"revops-pr104-chain-audit-v1",
  snapshotDate:snapshot?.capturedDate||null,verifiedAgainstLive:Boolean(live),
  baselineSha:snapshot?.root?.sha||null,
  total:items.length,stages:Object.freeze(stages),items:Object.freeze(items),
  technicalInventoryPass:structurallyValid,
  discrepancies:Object.freeze(problems),knownIntegrationIssues:Object.freeze(warnings),
  nextUnsafePR:missing.length?missing[0].number:null,
  missingPr78Ancestor:KNOWN_GAP.ancestor,
  externalGates:Object.freeze(external),
  promotionReady:false,productionGo:false,
  realApprovals:0,externalExecutions:0,
  disclaimer:"A green CI confirms snapshot/graph integrity only. PR79 ancestry and independent human/security/integration/business gates still block integration and production. No merges or releases performed."
 });
}
async function requestJson(url,token,request=fetch){
 const response=await request(url,{headers:{
  "Accept":"application/vnd.github+json",
  "Authorization":"Bearer "+token,
  "X-GitHub-Api-Version":"2022-11-28"
 }});
 if(!response.ok)throw Error("GitHub read-only API "+response.status+" at "+url.split("?")[0]);
 return response.json();
}
export async function fetchLiveChain({token=process.env.GITHUB_TOKEN,request=fetch,
 repository=REPOSITORY}={}){
 if(!token||typeof token!=="string")throw Error("Read-only GitHub token required for --live.");
 if(repository!==REPOSITORY)throw Error("Unexpected repository");
 const base="https://api.github.com/repos/"+repository;
 const [raw,main]=await Promise.all([
  requestJson(base+"/pulls?state=open&per_page=100",token,request),
  requestJson(base+"/branches/main",token,request)
 ]);
 if(!Array.isArray(raw)||!main?.commit?.sha)throw Error("Invalid live repository response");
 const matching=raw.filter(x=>x.number>=CHAIN_SCOPE.first&&x.number<=CHAIN_SCOPE.last);
 const prs=matching.map(p=>({number:p.number,head:p.head?.ref,headSha:p.head?.sha,
  base:p.base?.ref,baseSha:p.base?.sha,draft:p.draft,status:p.state}));
 const comparisons={};
 let cursor=0;
 async function worker(){
  while(cursor<prs.length){
   const p=prs[cursor++];
   if(!SHA.test(p.baseSha||"")||!SHA.test(p.headSha||""))
    throw Error("Missing GitHub head/base SHA for PR #"+p.number);
   const compare=await requestJson(base+"/compare/"+p.baseSha+"..."+p.headSha,token,request);
   comparisons[p.number]={status:compare.status,ahead:compare.ahead_by,behind:compare.behind_by};
  }
 }
 await Promise.all(Array.from({length:Math.min(4,prs.length)},()=>worker()));
 return {mainSha:main.commit.sha,prs,comparisons};
}
export function reportMarkdown(report){
 const lines=["# RevOps · PR104, auditoría de cadena", "",
  "**Snapshot:** "+report.snapshotDate,
  "**Verificado contra GitHub en vivo:** "+(report.verifiedAgainstLive?"sí":"no"),
  "**Integridad del grafo:** "+(report.technicalInventoryPass?"PASS":"FAIL"),
  "**Promoción:** NO-GO · **Producción:** NO-GO", "",
  "## Etapas"];
 for(const s of report.stages)
  lines.push("- "+s.label+" (#"+s.from+"–#"+s.to+"): "+s.count+
   " PR; antecesores pendientes: "+(s.blockers.join(", ")||"ninguno"));
 lines.push("","## Incidencias de integración");
 for(const x of report.knownIntegrationIssues)
  lines.push("- PR #"+x.pr+": "+x.message);
 for(const x of report.discrepancies)
  lines.push("- BLOQUEO "+x.code+" #"+(x.pr??"–")+": "+x.message);
 lines.push("","## Comprobaciones externas");
 for(const g of report.externalGates)
  lines.push("- PENDIENTE · "+g.id+": "+g.note);
 lines.push("","## Regla","No fusionar ramas en bloque, no desplegar, no declarar aprobación humana. "+
  "Reconciliar primero PR78→PR79 y revisar diferencias con pruebas actualizadas.", "",report.disclaimer,"");
 return lines.join("\n");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const snapshot=loadSnapshot();
 let live=null;
 if(process.argv.includes("--live"))live=await fetchLiveChain();
 const report=auditIntegrationChain(snapshot,{live});
 mkdirSync(".ci-artifacts",{recursive:true});
 writeFileSync(".ci-artifacts/pr104-chain-report.json",JSON.stringify(report,null,2)+"\n");
 writeFileSync(".ci-artifacts/pr104-chain-report.md",reportMarkdown(report));
 if(report.discrepancies.length){
  console.error("PR104 GRAPH AUDIT FAILED: "+report.discrepancies.map(x=>x.code+
   (x.pr?" #"+x.pr:"")).join("; "));
  process.exitCode=1;
 }else console.log("PR104 GRAPH VERIFIED "+report.total+" draft PRs"+
  (live?" against GitHub":" offline")+
  "; KNOWN PR79 missing ancestor; RELEASE NO-GO, HUMAN APPROVAL PENDING.");
}
