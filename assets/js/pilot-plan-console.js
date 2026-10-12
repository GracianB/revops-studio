// PR81 · Runtime UI for an in-memory workplan.
// Pure aggregate exports, no network, employee identity or real approvals.
import {assessPilotReadiness} from "./pilot-readiness.js";
import {createPilotExecutionPlan,simulatePlanProgress,pilotPlanText,pilotPlanJson}
 from "./pilot-plan.js";
export function mountPilotPlanConsole({getState,onReview}){
 if(typeof getState!=="function"||typeof onReview!=="function")
  throw Error("No se ha podido conectar la planificación.");
 const $=id=>document.getElementById(id);
 const root=$("pilotPlanStudio"),list=$("pilotPlanWavesList");
 let plan=null,source=null,scenario=null,chosen=[];
 const status=text=>{$("pilotPlanStatus").textContent=text;};
 const byId=id=>plan.tasks.find(t=>t.id===id);
 function refreshData(){
  const current=getState();
  if(!current?.result)throw Error("Ejecuta la muestra antes de planificar.");
  if(current.scenario!==scenario||current.source!==source){
   chosen=[];source=current.source;scenario=current.scenario;
  }
  const preflight=assessPilotReadiness(current.scenario,current.source,current.result);
  plan=createPilotExecutionPlan(preflight,Number($("pilotPlanCapacity").value));
  // A changed plan never inherits checked IDs that no longer exist.
  chosen=chosen.filter(id=>plan.tasks.some(t=>t.id===id));
 }
 function render(){
  if(!plan)return;
  let progress;
  try{progress=simulatePlanProgress(plan,chosen);}
  catch{chosen=[];progress=simulatePlanProgress(plan,chosen);}
  $("pilotPlanTasks").textContent=String(plan.taskCount);
  $("pilotPlanWaves").textContent=String(plan.waves.length);
  $("pilotPlanTried").textContent=String(progress.simulatedCount);
  $("pilotPlanApproved").textContent="0";
  $("pilotPlanSummary").textContent=plan.taskCount+" tareas propuestas, "+plan.waves.length+
    " olas para "+plan.capacity+" tareas simultáneas. "+plan.blockedGates+
    " comprobaciones con bloqueo y "+plan.attentionGates+
    " con advertencia. Planificación, nunca autorización.";
  const frag=document.createDocumentFragment();
  for(const wave of plan.waves){
   const section=document.createElement("section");section.className="workbench-p81-wave";
   const header=document.createElement("h4");
   header.textContent="Ola "+wave.index+" · "+wave.ids.length+
    " tareas · "+wave.points+" unidades de esfuerzo relativas";
   section.append(header);
   const ordered=document.createElement("ol");
   for(const id of wave.ids){
    const task=byId(id),li=document.createElement("li");
    li.dataset.planTask=id;
    const header=document.createElement("div");header.className="workbench-p81-task-head";
    const name=document.createElement("strong");name.textContent=task.title;
    const owner=document.createElement("small");owner.textContent="Función: "+task.role;
    header.append(name,owner);
    const explain=document.createElement("p");explain.textContent=task.evidence;
    const deps=document.createElement("p");deps.className="workbench-p81-deps";
    deps.textContent="Depende de: "+(task.depends.join(", ")||"ninguna")+
      " · Orden: "+task.phase+" · Esfuerzo relativo: "+task.points;
    const action=document.createElement("label");action.className="workbench-p81-mark";
    const box=document.createElement("input");box.type="checkbox";box.dataset.planCheck=id;
    box.checked=progress.simulated.includes(id);
    box.disabled=task.locked||(!box.checked&&!progress.ready.includes(id));
    const label=document.createElement("span");
    label.textContent=task.locked?"Pendiente de autorización humana externa; no verificable aquí":
     box.checked?"Ensayada en simulación":
     box.disabled?"A la espera de dependencias":"Marcar como ensayada en simulación";
    action.append(box,label);
    li.append(header,explain,deps,action);ordered.append(li);
   }
   section.append(ordered);frag.append(section);
  }
  list.replaceChildren(frag);
  status(progress.simulatedCount+" tareas ensayadas localmente. "+
    progress.ready.length+" disponibles, "+progress.blocked.length+
    " esperando dependencias y 1 autorización externa que no puede marcarse aquí.");
 }
 function redraw(){
  refreshData();render();
  root.hidden=false;$("pilotPlanOpen").setAttribute("aria-expanded","true");
 }
 list.addEventListener("change",event=>{
  const box=event.target.closest("input[data-plan-check]");
  if(!box||!list.contains(box)||!plan)return;
  const id=box.dataset.planCheck;
  try{
   if(box.checked){
    const next=[...chosen,id];
    simulatePlanProgress(plan,next);
    chosen=next;
   }else{
    const next=chosen.filter(v=>v!==id);
    simulatePlanProgress(plan,next);
    chosen=next;
   }
   render();
  }catch(error){
   box.checked=!box.checked;
   status("No se puede cambiar esta actividad: "+(error?.message||"dependencias pendientes"));
  }
 });
 $("pilotPlanCapacity").addEventListener("change",()=>{
  try{redraw();}catch(error){status("Plan no disponible: "+(error?.message||"entrada inválida"));}
 });
 for(const [id,format,extension,mime] of [
  ["pilotPlanExportTxt",pilotPlanText,"txt","text/plain;charset=utf-8"],
  ["pilotPlanExportJson",pilotPlanJson,"json","application/json;charset=utf-8"]
 ]){
  $(id).addEventListener("click",()=>{
   try{
    redraw();
    const progress=simulatePlanProgress(plan,chosen);
    const data=format(plan,progress);
    const url=URL.createObjectURL(new Blob([data],{type:mime}));
    const link=document.createElement("a");
    link.href=url;link.download="revops-plan-supervisado-"+scenario+"."+extension;
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2500);
    status("Plan "+extension.toUpperCase()+" local descargado. Sin nombres, correos, registros ni aprobación real.");
   }catch(error){status("No se pudo exportar: "+(error?.message||"entrada inválida"));}
  });
 }
 $("pilotPlanReset").addEventListener("click",()=>{
  chosen=[];render();
  status("Ensayos locales reiniciados. El plan conserva sus tareas sin ejecutar.");
 });
 $("pilotPlanReview").addEventListener("click",()=>onReview());
 const close=()=>{
  root.hidden=true;$("pilotPlanOpen").setAttribute("aria-expanded","false");
  $("pilotPlanOpen").focus();
 };
 $("pilotPlanClose").addEventListener("click",close);
 const api=Object.freeze({
  sync:redraw,
  clear(){
   plan=null;source=null;scenario=null;chosen=[];
   list.replaceChildren();
   for(const id of ["pilotPlanTasks","pilotPlanWaves","pilotPlanTried","pilotPlanApproved"])
    $(id).textContent="0";
   status("Plan y simulación eliminados de la memoria de esta pestaña.");
  },
  close
 });
 api.sync();
 return api;
}
