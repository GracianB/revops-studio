// PR76 · Optional, offline candidate-workflow UI. All changes are prospective only.
import {
 SCENARIO_PRESETS,SCENARIO_POLICY_LABELS,normalizeScenarioSettings,presetFor,
 simulateCandidate,encodeScenarioTemplate,decodeScenarioTemplate,scenarioComparisonReport
} from "./scenario-builder.js";

export function mountCandidateStudio({getState}){
 const $=id=>document.getElementById(id);
 const root=$("candidateStudio"),preset=$("candidatePreset");
 let type=null,source=null,current=null,settings=null;
 const label=text=>document.createTextNode(String(text));
 function say(value){$("candidateStatus").textContent=value;}
 function templateSay(value){$("candidateTemplateStatus").textContent=value;}
 function refreshInputs(){
  const support=type==="support";
  $("candidateAmountLabel").hidden=support;
  $("candidateEscalateLabel").hidden=!support;
  if(support)$("candidateEscalate").checked=settings.escalateMedium;
  else $("candidateThreshold").value=String(type==="orders"?settings.reviewBelow:settings.reviewAbove);
  $("candidateControlExplain").textContent=SCENARIO_POLICY_LABELS[type]+
   ". 0 desactiva el umbral; un valor más estricto puede añadir revisión, no desbloquear casos.";
 }
 function readInputs(){
  return normalizeScenarioSettings(type,type==="support"?
   {escalateMedium:$("candidateEscalate").checked}:
   {[type==="orders"?"reviewBelow":"reviewAbove"]:Number($("candidateThreshold").value)});
 }
 function renderCandidate(){
  const snapshot=getState();
  if(!snapshot?.result){say("Primero ejecuta los datos actuales.");return;}
  try{
   const proposed=readInputs();
   const next=simulateCandidate(type,snapshot.source,proposed);
   current=next;settings=proposed;source=snapshot.source;
   const original=next.baseline.counts,after=next.candidate.counts,delta=next.delta;
   for(const [id,val] of Object.entries({
    candidateOriginalReady:original.listo,candidateNewReady:after.listo,
    candidateOriginalReview:original.revisar,candidateNewReview:after.revisar
   }))$(id).textContent=String(val);
   const sign=n=>n>0?"+"+n:String(n);
   $("candidateDelta").textContent=next.countsByOutcome.newlyReview+
    " caso(s) añadidos a revisión · "+sign(delta.prepared)+" acciones preparadas · "+
    sign(delta.review)+" revisiones · "+sign(delta.blocked)+" bloqueos. "+
    "Se compara exactamente la misma muestra, sin ejecución externa.";
   const list=$("candidateAffected"),nodes=document.createDocumentFragment();
   if(!next.changedIndexes.length){
    const p=document.createElement("p");p.textContent="No hay registros adicionales que requieran revisión con esta configuración.";nodes.append(p);
   }
   for(const index of next.changedIndexes.slice(0,15)){
    const item=document.createElement("span");
    item.append(label("Fila "+(index+1)+" · listo → revisión humana adicional"));
    nodes.append(item);
   }
   list.replaceChildren(nodes);
   $("candidateSafety").textContent="Protecciones verificadas: "+next.countsByOutcome.preservedBlocked+
    " bloqueados, "+next.countsByOutcome.alreadyReview+" revisiones anteriores y "+
    next.countsByOutcome.preservedHistorical+" históricos preservados. Aprobaciones reales: 0.";
   $("candidateExportTemplate").disabled=false;
   $("candidateDownloadReport").disabled=false;
   say("Simulación recalculada. Tabla de datos original intacta. Ninguna regla de validación se ha desactivado.");
  }catch(error){
   current=null;
   $("candidateExportTemplate").disabled=true;$("candidateDownloadReport").disabled=true;
   say("Candidato no válido: "+(error?.message||"corrige el control."));
  }
 }
 function reset(typeValue,sourceValue){
  type=typeValue;source=sourceValue;
  preset.value="base";
  settings=presetFor(type,"base");
  refreshInputs();renderCandidate();
 }
 const api={
  sync(){
   const state=getState();
   if(!state?.result)return;
   if(state.scenario!==type||state.source!==source){
    reset(state.scenario,state.source);
    templateSay("Se ha actualizado la muestra. La variante anterior no se mantiene sobre datos distintos.");
   }else renderCandidate();
   root.hidden=false;$("candidateOpen").setAttribute("aria-expanded","true");
  },
  close(){
   root.hidden=true;$("candidateOpen").setAttribute("aria-expanded","false");
   $("candidateOpen").focus();
  }
 };
 preset.addEventListener("change",()=>{
  if(preset.value==="custom"){say("Edita el umbral o la excepción y calcula el candidato.");return;}
  settings=presetFor(type,preset.value);refreshInputs();renderCandidate();
 });
 $("candidateThreshold").addEventListener("input",()=>{preset.value="custom";current=null;
  $("candidateDownloadReport").disabled=true;$("candidateExportTemplate").disabled=true;
  say("Hay cambios en el umbral. Pulsa «Calcular candidato» para comprobarlos.");});
 $("candidateEscalate").addEventListener("change",()=>{preset.value="custom";renderCandidate();});
 $("candidateApply").addEventListener("click",renderCandidate);
 $("candidateRollback").addEventListener("click",()=>{
  settings=presetFor(type,"base");preset.value="base";
  refreshInputs();renderCandidate();
  say("Restablecido a las reglas originales. No se ha modificado ningún registro.");
 });
 function download(name,data,mime){
  const uri=URL.createObjectURL(new Blob([data],{type:mime}));
  const a=document.createElement("a");a.href=uri;a.download=name;
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(uri),1500);
 }
 $("candidateExportTemplate").addEventListener("click",()=>{
  if(!current)return;
  download("revops-variante-pr76-"+type+".json",encodeScenarioTemplate(type,current.settings),"application/json;charset=utf-8");
  templateSay("Configuración descargada sin ningún registro ni dato de cliente.");
 });
 $("candidateDownloadReport").addEventListener("click",()=>{
  if(!current)return;
  download("revops-comparacion-pr76-"+type+".txt",scenarioComparisonReport(current),"text/plain;charset=utf-8");
  templateSay("Comparativa agregada descargada sin filas ni valores de usuario.");
 });
 $("candidateImportTemplate").addEventListener("change",async event=>{
  const input=event.currentTarget,file=input.files?.[0],sourceType=type;
  try{
   if(!file)return;
   if(file.size>1200||!file.name.toLowerCase().endsWith(".json"))
    throw Error("Solo se admiten plantillas JSON de hasta 1,2 KB.");
   const decoded=decodeScenarioTemplate(await file.text(),type);
   if(sourceType!==type)throw Error("El escenario cambió durante la lectura.");
   settings=decoded;preset.value="custom";refreshInputs();renderCandidate();
   templateSay("Plantilla validada y comparada. Nunca contiene ni aplica registros.");
  }catch(error){templateSay("Perfil rechazado: "+(error?.message||"formato inválido"));}
  finally{input.value="";}
 });
 $("candidateClose").addEventListener("click",api.close);
 const initial=getState();
 if(initial?.result)api.sync();
 return api;
}
