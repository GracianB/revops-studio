// PR85 · Local pilot control center. No persistence or third-party requests.
import {assessPilotReadiness} from "./pilot-readiness.js";
import {createPilotExecutionPlan} from "./pilot-plan.js";
import {buildPilotRiskRegister,riskRegisterJson} from "./pilot-risk-register.js";
import {buildPilotEvidenceLedger,simulateEvidenceCoverage,evidencePacketJson}
 from "./pilot-evidence-ledger.js";
import {runPilotFailureDrills,pilotDrillReportJson} from "./pilot-failure-drills.js";
import {buildPilotCapacityExplorer,pilotCapacityReportJson} from "./pilot-capacity-explorer.js";
import {buildPilotAuthorizationBoard,pilotAuthorizationJson} from "./pilot-authorization-board.js";
import {buildPilotHandoffPack,pilotHandoffHtml,pilotHandoffTxt} from "./pilot-handoff-pack.js";
import {buildPilotStressMatrix,pilotStressMatrixJson} from "./pilot-stress-matrix.js";

export function mountPilotControlCenter({getState}){
 if(typeof getState!=="function")throw Error("Falta origen de datos del centro de control.");
 const $=id=>document.getElementById(id);
 const root=$("pilotControlStudio");
 let scenario=null,source=null,readiness=null,plan=null,risks=null,ledger=null;
 let rehearsed=[],drills=null;
 const set=(id,value)=>{$(id).textContent=String(value);};
 const el=(tag,txt,className)=>{
  const node=document.createElement(tag);
  if(txt!==undefined)node.textContent=txt;
  if(className)node.className=className;
  return node;
 };
 function rebuild(){
  const state=getState();
  if(!state?.result||!state.scenario||typeof state.source!=="string")
   throw Error("Vuelve a ejecutar la muestra actual.");
  if(scenario!==state.scenario||source!==state.source){
   rehearsed=[];drills=null;
   scenario=state.scenario;source=state.source;
  }
  readiness=assessPilotReadiness(scenario,source,state.result);
  plan=createPilotExecutionPlan(readiness);
  risks=buildPilotRiskRegister(readiness,plan);
  ledger=buildPilotEvidenceLedger(plan,risks);
 }
 function paint(){
  const coverage=simulateEvidenceCoverage(ledger,rehearsed);
  const capacity=buildPilotCapacityExplorer(readiness,Number($("pilotCapacityRoleLimit").value));
  const authorization=buildPilotAuthorizationBoard({readiness,plan,risks,ledger,drills});
  const stress=buildPilotStressMatrix(readiness);
  set("pilotControlHigh",risks.high);
  set("pilotControlEvidence",coverage.missing);
  set("pilotControlDrills",drills?drills.passed+"/"+drills.total:"Sin ejecutar");
  set("pilotControlApproval","0");
  set("pilotControlSummary",readiness.outcome+
   ". "+risks.count+" riesgos abiertos, "+coverage.missing+
   " requisitos de evidencia no ensayados. Las pruebas externas siguen pendientes.");
  const riskList=document.createDocumentFragment();
  const severity=$("pilotControlFilter").value;
  for(const risk of risks.risks.filter(r=>severity==="all"||r.level===severity)){
   const li=el("li");
   const top=el("div",undefined,"pilot-control-item-head");
   top.append(el("strong",risk.title),el("span",risk.level.toUpperCase(),"pilot-control-severity"));
   li.append(top,el("p","Señal: "+risk.signal+" · Impacto "+risk.impact+
    "/3 · Exposición "+risk.likelihood+"/3 · Control asociado: "+risk.task));
   li.append(el("p",risk.control));
   riskList.append(li);
  }
  $("pilotControlRisks").replaceChildren(riskList);
  set("pilotControlRiskCount",risks.risks.filter(r=>severity==="all"||r.level===severity).length+
   " riesgos visibles de "+risks.count);
  const evidenceList=document.createDocumentFragment();
  for(const entry of ledger.entries){
   const li=el("li");
   const label=el("label",undefined,"pilot-control-evidence-row");
   const box=el("input");
   box.type="checkbox";box.dataset.evidenceId=entry.id;
   box.checked=rehearsed.includes(entry.id);
   box.disabled=entry.externalOnly;
   const description=el("span");
   description.append(el("strong",entry.kind+" · "+entry.role));
   description.append(el("small",entry.requirement));
   if(entry.externalOnly)description.append(el("small","Requiere aprobación externa. No puede marcarse aquí."));
   else description.append(el("small","Solo ensayar lista de comprobación; no adjunta evidencia."));
   label.append(box,description);li.append(label);evidenceList.append(li);
  }
  $("pilotControlChecklist").replaceChildren(evidenceList);
  const drillList=document.createDocumentFragment();
  if(drills)for(const drill of drills.drills){
   const li=el("li",undefined,"pilot-control-drill");
   li.append(el("strong",drill.id+" · "+drill.title));
   li.append(el("span",drill.passed?"Rechazo local confirmado":"Rechazo local fallido"));
   drillList.append(li);
  }
  $("pilotControlDrillList").replaceChildren(drillList);
  const capacityRows=document.createDocumentFragment();
  for(const comparison of capacity.comparisons){
   const row=document.createElement("tr");
   const header=document.createElement("th");
   header.scope="row";header.textContent=String(comparison.capacity);row.append(header);
   for(const value of [comparison.optimisticWaves,
    comparison.waves,comparison.roleConstraintWaves]){
    const cell=document.createElement("td");cell.textContent=String(value);row.append(cell);
   }
   capacityRows.append(row);
  }
  $("pilotCapacityRows").replaceChildren(capacityRows);
  set("pilotCapacitySummary",capacity.totalTasks+" tareas y "+capacity.relativeEffort+
   " unidades relativas. Las olas aumentadas reflejan limitaciones de funciones, no retrasos reales.");
  set("pilotCapacityCritical",capacity.criticalPath.tasks.join(" → ")+
   " · "+capacity.criticalPath.points+" puntos relativos.");
  const roleRows=document.createDocumentFragment();
  for(const role of capacity.workload){
   const li=el("li",role.role+" · "+role.taskCount+" tareas · "+role.relativeEffort+" puntos relativos");
   roleRows.append(li);
  }
  $("pilotCapacityRoles").replaceChildren(roleRows);
  set("pilotAuthorizationOutcome",authorization.outcome);
  set("pilotAuthorizationCandidate",authorization.supervisedDemoCandidate?
   "La muestra cumple los criterios de demostración supervisada. Esto NO autoriza una operación real.":
   "La muestra necesita correcciones o revisiones antes de una demostración supervisada.");
  const gateList=document.createDocumentFragment();
  for(const gate of authorization.gates){
   const item=el("li");
   item.append(el("strong",gate.id+" · "+gate.title));
   item.append(el("span",gate.label+" · Función: "+gate.role));
   item.append(el("small",gate.next));
   gateList.append(item);
  }
  $("pilotAuthorizationGates").replaceChildren(gateList);
  const toFix=document.createDocumentFragment();
  if(!authorization.remediation.length)
   toFix.append(el("li","Sin incidencias de muestra en los ocho controles; los requisitos operativos externos siguen abiertos."));
  for(const pending of authorization.remediation){
   const item=el("li");
   item.append(el("strong",pending.gate+" · "+pending.title));
   item.append(el("span",pending.action));
   toFix.append(item);
  }
  $("pilotAuthorizationNext").replaceChildren(toFix);
  set("pilotStressCurrent","Muestra actual: "+stress.current.total+" registros, "+
   stress.current.blocked+" bloqueados, "+stress.current.review+" para revisión, "+
   stress.current.gatesPassed+" de 8 controles superados.");
  const stressFilter=$("pilotStressFilter").value;
  const stressItems=stress.samples.filter(sample=>stressFilter==="all"||
   (stressFilter==="issues"?!sample.data.supervisedDemoCandidate:sample.data.supervisedDemoCandidate));
  const stressRows=document.createDocumentFragment();
  for(const sample of stressItems){
   const tr=document.createElement("tr");
   const head=document.createElement("th");head.scope="row";head.textContent=sample.label;
   tr.append(head);
   for(const cellValue of [sample.data.total,sample.data.blocked,sample.data.review,
     sample.data.gatesPassed+"/8",sample.data.highRisks,
     sample.differenceFromCurrent.blocked>0?"+"+sample.differenceFromCurrent.blocked:
      String(sample.differenceFromCurrent.blocked)]){
    const cell=document.createElement("td");cell.textContent=String(cellValue);tr.append(cell);
   }
   stressRows.append(tr);
  }
  $("pilotStressRows").replaceChildren(stressRows);
  set("pilotStressStatus",stressItems.length+" de 6 patrones sintéticos visibles. "+
   "La muestra actual no se ha modificado y ninguna conclusión autoriza producción.");
  set("pilotAuthorizationChecklist",authorization.outstanding+" controles abiertos; "+
   authorization.unresolvedRiskCount+" riesgos operativos y "+
   authorization.unverifiedEvidenceCount+" evidencias sin verificación real. "+
   (authorization.localDrills.run?"Ensayos locales: "+authorization.localDrills.passed+"/"+(authorization.localDrills.passed+authorization.localDrills.failed)+".":"Ensayos locales sin ejecutar."));
  set("pilotControlStatus",drills?
    drills.status+" Aprobaciones reales: 0.":"Ejecuta los ensayos para comprobar barreras locales. Ninguna autorización real.");
 }
 function sync(){
  rebuild();paint();root.hidden=false;
  $("pilotControlOpen").setAttribute("aria-expanded","true");
 }
 $("pilotStressFilter").addEventListener("change",()=>{if(ledger)paint();});
 $("pilotCapacityRoleLimit").addEventListener("change",()=>{
  if(ledger)paint();
 });
 $("pilotControlFilter").addEventListener("change",()=>{
  if(ledger)paint();
 });
 $("pilotControlChecklist").addEventListener("change",event=>{
  const input=event.target.closest("input[data-evidence-id]");
  if(!input||!ledger)return;
  const id=input.dataset.evidenceId;
  const next=input.checked?[...rehearsed,id]:rehearsed.filter(value=>value!==id);
  try{
   simulateEvidenceCoverage(ledger,next);rehearsed=next;paint();
  }catch(error){
   input.checked=!input.checked;
   set("pilotControlStatus","No se puede ensayar esta evidencia: "+error.message);
  }
 });
 $("pilotControlRun").addEventListener("click",()=>{
  try{rebuild();drills=runPilotFailureDrills(readiness,plan,risks,ledger);paint();}
  catch(error){set("pilotControlStatus","Ensayo interrumpido: "+error.message);}
 });
 $("pilotControlExport").addEventListener("click",()=>{
  try{
   rebuild();
   const coverage=simulateEvidenceCoverage(ledger,rehearsed);
   const payload=JSON.stringify({schema:"revops-pilot-control-v1",
    scenario,risks:JSON.parse(riskRegisterJson(risks)),
    evidence:JSON.parse(evidencePacketJson(ledger,coverage)),
    capacity:JSON.parse(pilotCapacityReportJson(buildPilotCapacityExplorer(readiness,Number($("pilotCapacityRoleLimit").value)))),
    authorization:JSON.parse(pilotAuthorizationJson(buildPilotAuthorizationBoard({readiness,plan,risks,ledger,drills}))),
    stress:JSON.parse(pilotStressMatrixJson(buildPilotStressMatrix(readiness))),
    drills:drills?JSON.parse(pilotDrillReportJson(drills)):null,
    realApprovals:0,externalExecutions:0,
    notice:"Informe de simulación; no existe autorización real."},null,2)+"\n";
   const url=URL.createObjectURL(new Blob([payload],{type:"application/json;charset=utf-8"}));
   const a=document.createElement("a");a.href=url;
   a.download="revops-control-piloto-"+scenario+".json";
   document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2500);
   set("pilotControlStatus","Informe agregado exportado. Sin filas, correos, notas ni aprobaciones reales.");
  }catch(error){set("pilotControlStatus","Exportación rechazada: "+error.message);}
 });
 const exportHandoff=(format,extension,mime)=>{
  try{
   rebuild();
   const board=buildPilotAuthorizationBoard({readiness,plan,risks,ledger,drills});
   const capacity=buildPilotCapacityExplorer(readiness,Number($("pilotCapacityRoleLimit").value));
   const pack=buildPilotHandoffPack(board,plan,risks,ledger,capacity);
   const content=format(pack);
   const url=URL.createObjectURL(new Blob([content],{type:mime}));
   const link=document.createElement("a");
   link.href=url;
   link.download="revops-revision-piloto-"+scenario+"."+extension;
   document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2500);
   set("pilotHandoffStatus","Informe "+extension.toUpperCase()+
    " generado sin datos de filas, firmas ni autorizaciones reales.");
  }catch(error){set("pilotHandoffStatus","No se puede exportar: "+error.message);}
 };
 $("pilotHandoffHtml").addEventListener("click",()=>
  exportHandoff(pilotHandoffHtml,"html","text/html;charset=utf-8"));
 $("pilotHandoffTxt").addEventListener("click",()=>
  exportHandoff(pilotHandoffTxt,"txt","text/plain;charset=utf-8"));
 $("pilotAuthorizationReadiness").addEventListener("click",()=>$("pilotOpen").click());
 $("pilotAuthorizationPlan").addEventListener("click",()=>$("pilotPlanOpen").click());
 $("pilotControlReset").addEventListener("click",()=>{
  rehearsed=[];drills=null;if(ledger)paint();
  set("pilotControlStatus","Ensayos reiniciados. Los requisitos externos siguen pendientes.");
 });
 const close=()=>{
  root.hidden=true;$("pilotControlOpen").setAttribute("aria-expanded","false");
  $("pilotControlOpen").focus();
 };
 $("pilotControlClose").addEventListener("click",close);
 const api=Object.freeze({
  sync,close,clear(){
   rehearsed=[];drills=null;scenario=null;source=null;
   readiness=null;plan=null;risks=null;ledger=null;
   root.hidden=true;
   $("pilotControlOpen").setAttribute("aria-expanded","false");
   $("pilotControlRisks").replaceChildren();
   $("pilotControlChecklist").replaceChildren();
   $("pilotControlDrillList").replaceChildren();
   $("pilotCapacityRows").replaceChildren();
   $("pilotCapacityRoles").replaceChildren();
   set("pilotCapacityCritical","");
   set("pilotCapacitySummary","");
   $("pilotAuthorizationGates").replaceChildren();
   $("pilotAuthorizationNext").replaceChildren();
   set("pilotAuthorizationCandidate","");
   set("pilotAuthorizationChecklist","");
   set("pilotAuthorizationOutcome","NO AUTORIZADO PARA PRODUCCIÓN");
   set("pilotHandoffStatus","La muestra ha cambiado. Recalcula antes de exportar.");
   $("pilotStressRows").replaceChildren();
   set("pilotStressCurrent","Sin muestra actual.");
   set("pilotStressStatus","Matriz invalidada; vuelve a ejecutar el proceso.");
   set("pilotControlStatus","Muestra modificada o sesión limpiada. Ejecuta el proceso nuevamente.");
  }
 });
 api.sync();return api;
}
