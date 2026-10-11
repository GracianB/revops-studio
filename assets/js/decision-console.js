// PR75 · On-demand UI: declarative rule catalogue + ephemeral simulated approvals.
import {parseDelimited} from "./workflow-engine.js";
import {describePolicy} from "./workflow-policy.js";
import {createHumanReviewLedger,humanDecisionReport} from "./human-decision.js";

export function mountDecisionConsole({getState,openEditor}){
 const $=id=>document.getElementById(id);
 const panel=$("rulesStudio");
 let currentSource=null,currentScenario=null,policy=null,ledger=null;
 const make=(tag,text)=>{const el=document.createElement(tag);el.textContent=String(text);return el;};
 const status=(value)=>{$("humanReviewFeedback").textContent=value;};
 const buttons=["humanReviewStart","humanReviewApprove","humanReviewReject"];
 function updateHumanReview(){
  if(!ledger)return;
  const summary=ledger.summary(),list=ledger.list();
  $("humanReviewCounters").textContent="Pendientes: "+summary.pendiente+
   " · En revisión: "+summary["en revisión"]+
   " · Aprobación simulada: "+summary["aprobación simulada"]+
   " · Rechazo simulado: "+summary.rechazada+
   " · Autorizaciones reales: 0";
  const row=Number($("humanReviewRow").value);
  const record=ledger.state(row);
  $("humanReviewState").textContent=record?
   "Fila "+(row+1)+" · "+record.status+" · La regla del motor continúa en revisión humana.":
   "Este escenario no tiene casos pendientes de revisión humana.";
  for(const id of buttons)$(id).disabled=!record;
  $("rulesExport").disabled=false;
 }
 function renderAudit(){
  if(!policy)return;
  $("rulesCount").textContent=String(policy.catalog.length);
  $("rulesCovered").textContent=String(policy.catalog.filter(x=>x.applied).length);
  $("rulesOverlaps").textContent=String(policy.overlapCount);
  $("rulesHumanGates").textContent=String(policy.pendingHuman);
  const ul=$("ruleCatalogList"),frag=document.createDocumentFragment();
  for(const rule of policy.catalog){
   const li=document.createElement("li"),strong=make("strong",rule.id+" · "+rule.reason);
   li.append(strong,make("span","Prioridad "+rule.position+" · "+rule.status+
    " · Aplicada "+rule.applied+" veces · Restricción secundaria "+rule.shadowed+" veces"));
   if(!rule.applied)li.classList.add("is-unused");
   frag.append(li);
  }
  ul.replaceChildren(frag);
  const selector=$("ruleTraceRow"),prev=selector.value,options=document.createDocumentFragment();
  policy.traces.forEach(trace=>{
   const item=make("option","Fila "+(trace.index+1)+" · "+trace.status+" · "+trace.ruleId);
   item.value=String(trace.index);options.append(item);
  });
  selector.replaceChildren(options);
  if(policy.traces.some(trace=>String(trace.index)===prev))selector.value=prev;
  renderTrace();
  const conflictContainer=$("ruleConflicts"),content=document.createDocumentFragment();
  if(!policy.overlaps.length)content.append(make("p","Sin restricciones simultáneas detectadas en esta ejecución."));
  for(const item of policy.overlaps){
   const row=document.createElement("div"),explanation=make("p",
    "Fila "+(item.index+1)+" · gana "+item.winning+"; quedan detrás: "+item.shadowed.join(", "));
   const button=make("button","Inspeccionar fila "+(item.index+1)+" ↗");
   button.type="button";button.dataset.ruleTraceIndex=String(item.index);
   row.append(explanation,button);content.append(row);
  }
  conflictContainer.replaceChildren(content);
  const selected=$("humanReviewRow"),previous=selected.value,reviewOptions=document.createDocumentFragment();
  for(const trace of policy.traces.filter(t=>t.humanGate)){
   const item=make("option","Fila "+(trace.index+1)+" · "+trace.ruleId);
   item.value=String(trace.index);reviewOptions.append(item);
  }
  selected.replaceChildren(reviewOptions);
  if([...selected.options].some(option=>option.value===previous))selected.value=previous;
  updateHumanReview();
  $("rulesPolicyStatus").textContent="Motor y auditoría coinciden: "+policy.total+
   " decisiones verificadas. Acciones externas: 0.";
 }
 function renderTrace(){
  if(!policy)return;
  const index=Number($("ruleTraceRow").value),record=policy.traces[index];
  const container=$("ruleTraceDetail"),fragment=document.createDocumentFragment();
  if(!record){container.replaceChildren(make("p","No se encontró el registro."));return;}
  fragment.append(
   make("strong","Fila "+(index+1)+" · "+record.status),
   make("p","Regla ganadora: "+record.ruleId+" · precedencia "+record.priority),
   make("p","Decisión: "+record.reason),
   make("p",record.shadowed.length?
    "Restricciones adicionales ocultas por prioridad: "+record.shadowed.join(", "):
    "Ninguna restricción adicional detectada."),
   make("p",record.humanGate?"Requiere criterio humano. Ninguna aprobación real.":
    record.status==="bloqueado"?"Corregir datos antes de continuar. No autorizar.":
    "Resultado propuesto, nunca ejecutado."));
  const action=make("button","Abrir fila para investigar ↗");
  action.type="button";action.dataset.inspectRow=String(index);fragment.append(action);
  container.replaceChildren(fragment);
 }
 const controller={
  sync(type,source,result){
   if(!result)return;
   if(type!==currentScenario||source!==currentSource){
    policy=describePolicy(type,source,result,parseDelimited);
    ledger=createHumanReviewLedger(result);
    currentScenario=type;currentSource=source;
    $("humanReviewNote").value="";
    status("Las anotaciones anteriores se han invalidado al cambiar los datos o el escenario.");
   }
   renderAudit();
   panel.hidden=false;
   $("rulesOpen").setAttribute("aria-expanded","true");
  },
  close(){
   panel.hidden=true;
   $("rulesOpen").setAttribute("aria-expanded","false");
   $("rulesOpen").focus();
  }
 };
 $("ruleTraceRow").addEventListener("change",renderTrace);
 $("ruleTraceDetail").addEventListener("click",event=>{
  const button=event.target.closest("button[data-inspect-row]");
  if(!button||!policy)return;
  const index=Number(button.dataset.inspectRow);
  if(Number.isInteger(index)&&index>=0&&index<policy.traces.length)openEditor(index);
 });
 $("ruleConflicts").addEventListener("click",event=>{
  const btn=event.target.closest("button[data-rule-trace-index]");
  if(!btn)return;
  $("ruleTraceRow").value=btn.dataset.ruleTraceIndex;
  renderTrace();$("ruleTraceRow").focus();
 });
 $("humanReviewRow").addEventListener("change",()=>{
  $("humanReviewNote").value="";updateHumanReview();
  status("Selecciona una actuación. La revisión no autoriza ninguna acción externa.");
 });
 for(const [id,state] of [["humanReviewStart","en revisión"],
  ["humanReviewApprove","aprobación simulada"],["humanReviewReject","rechazada"]]){
  $(id).addEventListener("click",()=>{
   const row=Number($("humanReviewRow").value);
   try{
    if(!$("humanReviewRow").options.length)throw Error("No hay una excepción humana seleccionada.");
    const decision=ledger.set(row,state,$("humanReviewNote").value);
    updateHumanReview();
    status("Fila "+(row+1)+": "+decision.status+
     ". Es una anotación simulada, no una aprobación verificable ni un envío.");
   }catch(error){status(error?.message||"No se puede registrar la decisión.");}
  });
 }
 $("rulesClose").addEventListener("click",controller.close);
 $("rulesExport").addEventListener("click",()=>{
  if(!policy||!ledger)return;
  try{
   const body=humanDecisionReport(policy,ledger);
   const url=URL.createObjectURL(new Blob([body],{type:"text/plain;charset=utf-8"}));
   const a=document.createElement("a");a.href=url;
   a.download="revops-reglas-pr75-"+policy.scenario+".txt";
   document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1500);
   status("Auditoría agregada descargada. Sin filas, valores, justificaciones ni identidades.");
  }catch(error){status(error?.message||"La auditoría ya no es válida.");}
 });
 const initial=getState();
 if(initial?.result)controller.sync(initial.scenario,initial.source,initial.result);
 return controller;
}
