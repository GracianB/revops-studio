// PR80 · An on-demand, screen-reader-friendly supervised-demo preflight.
// Never persists or exports input records. All data stays local.
import {assessPilotReadiness,pilotReadinessText,pilotReadinessJson,PILOT_ACTIONS} from "./pilot-readiness.js";
export function mountPilotConsole({getState,onRemediate}){
 if(typeof getState!=="function"||typeof onRemediate!=="function")
  throw Error("No se pudo conectar el flujo de comprobaciones.");
 const $=id=>document.getElementById(id);
 let current=null,source=null,type=null;
 const root=$("pilotStudio");
 const status=message=>{$("pilotStatus").textContent=message;};
 function draw(){
  const state=getState();
  if(!state?.result)throw Error("Ejecuta el proceso antes de comprobar el piloto.");
  const proposal=assessPilotReadiness(state.scenario,state.source,state.result);
  current=proposal;source=state.source;type=state.scenario;
  for(const [id,n] of Object.entries({
    pilotPassed:proposal.passed,pilotWarnings:proposal.attentions,pilotBlockers:proposal.blockers
  }))$(id).textContent=String(n);
  $("pilotOutcome").textContent=proposal.outcome+
   " · "+proposal.metrics.total+" registros · "+proposal.metrics.prepared+
   " propuestas preparadas · nunca ejecutadas.";
  const list=$("pilotChecks"),frag=document.createDocumentFragment();
  for(const check of proposal.checks){
   const li=document.createElement("li");
   li.dataset.state=check.state;
   const head=document.createElement("div"),title=document.createElement("strong"),count=document.createElement("span");
   title.textContent=check.id+" · "+check.title;
   count.textContent=check.state==="pass"?"Comprobado":check.state==="blocked"?"Bloqueo":"Requiere atención";
   head.append(title,count);
   const why=document.createElement("p");why.textContent=check.why;
   const next=document.createElement("p");next.textContent=check.next;next.className="workbench-p80-next";
   li.append(head,why,next);
   if(check.state!=="pass"){
    const action=document.createElement("button");
    action.type="button";
    action.dataset.pilotAction=check.action;
    action.textContent=PILOT_ACTIONS[check.action]||"Revisar el resultado";
    li.append(action);
   }
   frag.append(li);
  }
  list.replaceChildren(frag);
  status("Evaluación regenerada con las reglas del motor y el conjunto actual. "+
   proposal.blockers+" bloqueos, "+proposal.attentions+" advertencias. "+
   "No se han autorizado ni ejecutado acciones externas.");
  return proposal;
 }
 function close(){
  root.hidden=true;$("pilotOpen").setAttribute("aria-expanded","false");
  $("pilotOpen").focus();
 }
 $("pilotChecks").addEventListener("click",event=>{
  const button=event.target.closest("button[data-pilot-action]");
  if(!button||!root.contains(button))return;
  onRemediate(button.dataset.pilotAction);
 });
 $("pilotRefresh").addEventListener("click",()=>{
  try{draw();}catch(error){status("No se pudo volver a evaluar: "+(error?.message||"entrada no válida"));}
 });
 function download(text,name,mime){
  const url=URL.createObjectURL(new Blob([text],{type:mime}));
  const a=document.createElement("a");a.href=url;a.download=name;
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2500);
 }
 for(const [id,build,ext,mime] of [
  ["pilotExportTxt",pilotReadinessText,"txt","text/plain;charset=utf-8"],
  ["pilotExportJson",pilotReadinessJson,"json","application/json;charset=utf-8"]
 ]){
  $(id).addEventListener("click",()=>{
   try{
    draw();
    download(build(current),"revops-evaluacion-piloto-"+type+"."+ext,mime);
    status("Evidencia "+ext.toUpperCase()+" exportada: solo métricas, controles y texto predefinido. Ninguna fila original.");
   }catch(error){status("No se pudo preparar el archivo: "+(error?.message||"error desconocido"));}
  });
 }
 $("pilotClose").addEventListener("click",close);
 const instance=Object.freeze({
  sync(){
   draw();
   root.hidden=false;$("pilotOpen").setAttribute("aria-expanded","true");
  },
  clear(){
   current=null;source=null;type=null;
   $("pilotChecks").replaceChildren();
   $("pilotOutcome").textContent="Se han descartado los resultados de la evaluación.";
   for(const id of ["pilotPassed","pilotWarnings","pilotBlockers"])$(id).textContent="0";
   status("Evaluación descartada de la memoria de esta pestaña.");
  },
  close
 });
 instance.sync();
 return instance;
}
