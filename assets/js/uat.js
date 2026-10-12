import {createUatSession,UAT_PROFILES,profileTasks} from "./pilot-uat-protocol.js";
import {validatePilotExportJson} from "./pilot-export-integrity.js";

// PR103 · Presentation only. No network, names, notes, storage or approvals.
const $=id=>document.getElementById(id);
const session=createUatSession();
let selected="operations";
const make=(tag,text,className)=>{
 const element=document.createElement(tag);
 if(text!==undefined)element.textContent=text;
 if(className)element.className=className;
 return element;
};
const options=(select,entries,selectedValue)=>{
 for(const [value,title] of entries){
  const option=make("option",title);
  option.value=value;
  if(value===selectedValue)option.selected=true;
  select.append(option);
 }
};
function refreshOverview(message){
 const state=session.snapshot();
 $("uatObserved").textContent=state.observed+" / "+state.total;
 $("uatPassed").textContent=String(state.reportedCompleted);
 $("uatIssues").textContent=String(state.reportedIssues);
 $("uatFriction").textContent=String(state.reportedAssisted+state.reportedOverTarget);
 $("uatExportJson").disabled=state.observed===0;
 $("uatExportTxt").disabled=state.observed===0;
 $("uatStatus").textContent=message||(
  state.observed+" observaciones introducidas de "+state.total+
  ". "+state.pending+" pendientes. Resultados sin verificación independiente.");
 const here=state.profiles.find(p=>p.id===selected);
 $("uatRoleProgress").textContent=here.observed+" de "+here.total+
  " tareas con resultado introducido; "+here.issues+" incidencias declaradas.";
}
function row(task,record){
 const li=make("li",undefined,"uat-task");
 li.dataset.uatId=task.id;
 const header=make("div",undefined,"uat-task-header");
 const name=make("h3",task.title);
 const code=make("span",task.id,"uat-task-code");
 header.append(name,code);li.append(header);
 li.append(make("p",task.instruction));
 li.append(make("p","Criterio observable: "+task.success,"uat-task-success"));
 const link=make("a","Abrir página para realizar la tarea ↗");
 link.href=task.url;
 link.target="_blank";link.rel="noopener noreferrer";
 li.append(link);
 li.append(make("p","Tiempo objetivo indicativo: "+task.maxSeconds+
  " segundos. El tiempo real se mide externamente, no de forma automática.","uat-small"));
 const set=make("fieldset",undefined,"uat-task-fieldset");
 const legend=make("legend","Anota solo los resultados observados (sin datos identificativos)");
 set.append(legend);
 function labeled(name,title,element){
  const label=make("label",title);
  const id="uat-"+task.id+"-"+name;
  element.id=id;
  label.htmlFor=id;
  label.append(element);
  set.append(label);
 }
 const outcome=make("select");outcome.name="outcome";
 options(outcome,[["","Elegir resultado"],["completed","Completada"],["failed","No completada"],["blocked","Bloqueada por impedimento"]],record?.outcome==="pending"?"":record?.outcome||"");
 labeled("outcome","Resultado",outcome);
 const assistance=make("select");assistance.name="assistance";
 options(assistance,[["none","Sin ayuda"],["hint","Pista necesaria"],["guided","Con intervención"]],record?.assistance||"none");
 labeled("assistance","Ayuda requerida",assistance);
 const seconds=make("input");seconds.name="seconds";seconds.type="number";
 seconds.min="1";seconds.max="3600";seconds.step="1";
 seconds.inputMode="numeric";
 seconds.placeholder="Segundos";seconds.value=record?.seconds==null?"":String(record.seconds);
 labeled("seconds","Duración medida (segundos)",seconds);
 li.append(set);
 const footer=make("div",undefined,"uat-task-footer");
 const feedback=make("span",record?.outcome&&record.outcome!=="pending"?
  "Observación registrada. No verificada independientemente.":"Pendiente de observación.","uat-task-feedback");
 feedback.dataset.outcome=record?.outcome||"pending";
 const save=make("button",record?.outcome&&record.outcome!=="pending"?
  "Actualizar observación":"Registrar observación");
 save.type="button";save.dataset.uatSave=task.id;
 footer.append(feedback,save);li.append(footer);
 return li;
}
function renderTasks(){
 const recordById=new Map(session.snapshot().tasks.map(t=>[t.id,t]));
 $("uatTasks").replaceChildren(...profileTasks(selected).map(t=>row(t,recordById.get(t.id))));
 const profile=UAT_PROFILES.find(p=>p.id===selected);
 $("uatRoleDescription").textContent=profile.goal;
 for(const button of document.querySelectorAll("[data-uat-role]"))
  button.setAttribute("aria-pressed",String(button.dataset.uatRole===selected));
 refreshOverview();
}
$("uatRoles").addEventListener("click",event=>{
 const button=event.target.closest("button[data-uat-role]");
 if(!button||!UAT_PROFILES.some(x=>x.id===button.dataset.uatRole))return;
 selected=button.dataset.uatRole;
 renderTasks();
 $("uatRoleProgress").setAttribute("tabindex","-1");
 $("uatRoleProgress").focus({preventScroll:true});
});
$("uatTasks").addEventListener("click",event=>{
 const button=event.target.closest("button[data-uat-save]");
 if(!button)return;
 const li=button.closest("li[data-uat-id]");
 const id=li?.dataset.uatId;
 if(!id)return;
 const outcome=li.querySelector('[name="outcome"]').value;
 const assistance=li.querySelector('[name="assistance"]').value;
 const raw=li.querySelector('[name="seconds"]').value.trim();
 const feedback=li.querySelector(".uat-task-feedback");
 try{
  const duration=raw===""?NaN:Number(raw);
  session.record(id,{outcome,assistance,seconds:duration});
  const task=session.snapshot().tasks.find(t=>t.id===id);
  feedback.textContent=(task.withinTarget?
   "Resultado registrado dentro del tiempo objetivo.":"Resultado registrado fuera del tiempo objetivo.")+
   " No verificado independientemente.";
  feedback.dataset.outcome=task.outcome;
  button.textContent="Actualizar observación";
  refreshOverview();
 }catch(error){
  feedback.textContent="No se ha registrado: "+error.message;
  feedback.dataset.outcome="blocked";
  li.querySelector('[name="outcome"]').focus();
 }
});
function download(filename,content,type){
 const blob=new Blob([content],{type});
 const href=URL.createObjectURL(blob);
 const a=make("a");a.href=href;a.download=filename;
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(href),1500);
 $("uatDownloadStatus").textContent="Informe generado en esta pestaña; "+
  "no se ha enviado nada a un servidor. Comprueba los archivos descargados antes de compartirlos.";
}
$("uatExportJson").addEventListener("click",()=>{
 try{
  const content=session.json();
  validatePilotExportJson(content);
  download("revops-pr103-observaciones-manuales.json",content,"application/json;charset=utf-8");
 }catch(error){$("uatDownloadStatus").textContent="Exportación cancelada: "+error.message;}
});
$("uatExportTxt").addEventListener("click",()=>{
 try{
  if(session.snapshot().observed===0)throw Error("No hay observaciones registradas.");
  download("revops-pr103-resumen-manual.txt",session.text(),"text/plain;charset=utf-8");
 }catch(error){$("uatDownloadStatus").textContent="Exportación cancelada: "+error.message;}
});
$("uatReset").addEventListener("click",()=>{
 $("uatResetWarning").hidden=false;
 $("uatResetConfirm").focus();
});
$("uatResetCancel").addEventListener("click",()=>{
 $("uatResetWarning").hidden=true;
 $("uatReset").focus();
});
$("uatResetConfirm").addEventListener("click",()=>{
 session.clear();
 $("uatResetWarning").hidden=true;
 $("uatDownloadStatus").textContent="Observaciones de esta pestaña descartadas.";
 renderTasks();refreshOverview("0 observaciones introducidas. No se han realizado ni verificado pruebas reales.");
 $("uatReset").focus();
});
renderTasks();
