// PR85 · Local pilot control center. No persistence or third-party requests.
import {assessPilotReadiness} from "./pilot-readiness.js";
import {createPilotExecutionPlan} from "./pilot-plan.js";
import {buildPilotRiskRegister,riskRegisterJson} from "./pilot-risk-register.js";
import {buildPilotEvidenceLedger,simulateEvidenceCoverage,evidencePacketJson}
 from "./pilot-evidence-ledger.js";
import {runPilotFailureDrills,pilotDrillReportJson} from "./pilot-failure-drills.js";
import {buildPilotCapacityExplorer,pilotCapacityReportJson} from "./pilot-capacity-explorer.js";

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
   for(const value of [comparison.capacity,comparison.optimisticWaves,
    comparison.waves,comparison.roleConstraintWaves]){
    const cell=document.createElement("td");cell.textContent=String(value);row.append(cell);
   }
   row.firstChild.outerHTML="<th scope=\"row\">"+comparison.capacity+"</th>";
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
  set("pilotControlStatus",drills?
    drills.status+" Aprobaciones reales: 0.":"Ejecuta los ensayos para comprobar barreras locales. Ninguna autorización real.");
 }
 function sync(){
  rebuild();paint();root.hidden=false;
  $("pilotControlOpen").setAttribute("aria-expanded","true");
 }
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
   set("pilotControlStatus","Muestra modificada o sesión limpiada. Ejecuta el proceso nuevamente.");
  }
 });
 api.sync();return api;
}
