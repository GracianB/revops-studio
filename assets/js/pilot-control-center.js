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
import {mountPilotSectionNavigation} from "./pilot-section-navigation.js";
import {buildPilotGuidedRoute,guidedRouteJson} from "./pilot-guided-route.js";
import {createPilotSessionJournal,pilotSessionJournalJson} from "./pilot-session-journal.js";
import {buildPilotEvidenceReview,pilotEvidenceReviewJson} from "./pilot-evidence-review.js";
import {buildPilotSupervisedReview,pilotSupervisedReviewJson,pilotSupervisedReviewText} from "./pilot-supervised-review.js";
import {validatePilotExportJson,validatePilotHtmlHandoff} from "./pilot-export-integrity.js";
import {createPilotComputationCache} from "./pilot-computation-cache.js";
import {runPilotAccessibilityPreflight,pilotAccessibilityJson} from "./pilot-accessibility-protocol.js";
import {buildPilotV100Snapshot,pilotV100SnapshotJson,pilotV100SnapshotText} from "./pilot-v100-snapshot.js";
import {mountPilotUX} from "./pilot-ux-progressive.js";

export function mountPilotControlCenter({getState}){
 if(typeof getState!=="function")throw Error("Falta origen de datos del centro de control.");
 const $=id=>document.getElementById(id);
 const root=$("pilotControlStudio");
 const sectionNavigation=mountPilotSectionNavigation(root);
 const ux=mountPilotUX(root,{onClose:()=>close()});
 let scenario=null,source=null,readiness=null,plan=null,risks=null,ledger=null;
 let rehearsed=[],drills=null,atlasReport=null,atlasModule=null,atlasGeneration=0;
 const sessionJournal=createPilotSessionJournal();
 const workCache=createPilotComputationCache();
 let prepared=null;
 let accessibilityReport=null;
 const set=(id,value)=>{$(id).textContent=String(value);};
 const el=(tag,txt,className)=>{
  const node=document.createElement(tag);
  if(txt!==undefined)node.textContent=txt;
  if(className)node.className=className;
  return node;
 };
 const drawSessionJournal=()=>{
  const snapshot=sessionJournal.snapshot();
  const fragment=document.createDocumentFragment();
  for(const entry of snapshot.entries){
   const li=el("li",entry.sequence+". "+entry.label);
   fragment.append(li);
  }
  $("pilotSessionAuditEntries").replaceChildren(fragment);
  set("pilotSessionAuditCount",snapshot.visible+" acciones locales visibles; "+
    snapshot.discarded+" descartadas por el límite de "+32+".");
 };
 const remember=type=>{sessionJournal.add(type);drawSessionJournal();};
 function rebuild(){
  const state=getState();
  if(!state?.result||!state.scenario||typeof state.source!=="string")
   throw Error("Vuelve a ejecutar la muestra actual.");
  workCache.setSource(state.scenario,state.source,state.result);
  if(prepared&&prepared.scenario===state.scenario&&
     prepared.source===state.source&&prepared.result===state.result)return;
  if(scenario!==state.scenario||source!==state.source){
   rehearsed=[];drills=null;
   sessionJournal.clear();drawSessionJournal();
   scenario=state.scenario;source=state.source;
  }
  readiness=assessPilotReadiness(scenario,source,state.result);
  plan=createPilotExecutionPlan(readiness);
  risks=buildPilotRiskRegister(readiness,plan);
  ledger=buildPilotEvidenceLedger(plan,risks);
  prepared={scenario,source,result:state.result};
 }
 function paint(){
  const coverage=simulateEvidenceCoverage(ledger,rehearsed);
  const roleLimit=Number($("pilotCapacityRoleLimit").value);
  const capacity=workCache.capacity(roleLimit,()=>buildPilotCapacityExplorer(readiness,roleLimit));
  const authorization=buildPilotAuthorizationBoard({readiness,plan,risks,ledger,drills});
  const stress=workCache.stress(()=>buildPilotStressMatrix(readiness));
  const guided=buildPilotGuidedRoute(readiness,plan,ledger,coverage,drills);
  const evidenceReview=buildPilotEvidenceReview(plan,ledger,risks,coverage);
  const finalReview=buildPilotSupervisedReview({
   readiness,plan,risks,ledger,coverage,drills,capacity,evidenceReview,atlas:atlasReport
  });
  const milestone=buildPilotV100Snapshot({readiness,review:finalReview,risks,capacity,evidenceReview,atlas:atlasReport});
  ux.setPending(guided.pending);
  set("pilotGuidedSummary",guided.pending+" pasos pendientes; "+guided.blocked+
   " bloqueantes y "+guided.review+" por revisar. Siguiente: "+guided.next.title+".");
  const routeFragment=document.createDocumentFragment();
  for(const step of guided.steps){
   const li=el("li");
   li.append(el("strong",step.title));
   li.append(el("small",step.state==="blocked"?"BLOQUEO":step.state==="review"?
    "REVISIÓN":step.state==="external"?"VALIDACIÓN EXTERNA":"ENSAYO LOCAL"));
   li.append(el("p",step.summary+" · "+step.role));
   const jump=el("button",step.state==="external"?
    "Autorización externa obligatoria":"Ir al control ↗");
   jump.type="button";jump.dataset.pilotRouteTarget=step.target;
   jump.disabled=step.state==="external";
   li.append(jump);routeFragment.append(li);
  }
  $("pilotGuidedList").replaceChildren(routeFragment);
  set("pilotV100Stage",milestone.stage);
  set("pilotV100Outcome",milestone.outcome);
  set("pilotV100Checks",milestone.metrics.localControlsPassed+"/8");
  set("pilotV100External",milestone.metrics.externalChecksOpen);
  set("pilotV100Risks",milestone.metrics.risksOpen);
  set("pilotV100Atlas",milestone.metrics.atlasExecuted?
   milestone.metrics.atlasFixturesPassed+"/18":"Pendiente");
  const actionFragment=document.createDocumentFragment();
  for(const next of milestone.actions){
   const li=el("li");
   li.append(el("strong",next.title),el("small",next.role+" · "+
    (next.kind==="external"?"Revisión fuera de la demo":"Corrección local pendiente")));
   const link=el("button","Ir a revisión ↗");
   link.type="button";link.dataset.v100Target=next.destination;
   li.append(link);actionFragment.append(li);
  }
  $("pilotV100Actions").replaceChildren(actionFragment);
  const highlights=document.createDocumentFragment();
  for(const risk of milestone.riskHighlights){
   const li=el("li");
   li.append(el("strong",risk.id+" · "+risk.title),
    el("small",risk.level.toUpperCase()+" · Score "+risk.score));
   highlights.append(li);
  }
  $("pilotV100RiskHighlights").replaceChildren(highlights);
  set("pilotV100Summary",milestone.metrics.evidenceRequirements+
   " requisitos documentales pendientes de verificación humana. "+
   "Aprobaciones reales: 0. Ninguna ejecución externa.");
  set("pilotFinalReviewVerdict",finalReview.outcome);
  set("pilotFinalLocal",finalReview.localPassed+"/8");
  set("pilotFinalAttention",finalReview.attention);
  set("pilotFinalExternal",finalReview.externalRequired);
  set("pilotFinalApprovals","0");
  const finalRows=document.createDocumentFragment();
  for(const gate of finalReview.gates){
   const li=el("li");
   li.append(el("strong",gate.id+" · "+gate.title));
   li.append(el("small",gate.state==="local_pass"?"CONTROL LOCAL CORRECTO":
    gate.state==="attention"?"REQUIERE CORRECCIÓN O ENSAYO":"REVISIÓN EXTERNA OBLIGATORIA"));
   li.append(el("p",gate.reason+" · Función: "+gate.role));
   finalRows.append(li);
  }
  $("pilotFinalReviewList").replaceChildren(finalRows);
  set("pilotFinalReviewStatus",finalReview.localPassed+
   "/8 comprobaciones locales correctas, "+finalReview.externalRequired+
   " validaciones externas abiertas. Producción NO autorizada.");
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
  const evidenceFilter=$("pilotEvidenceReviewFilter");
  const selectedRole=evidenceReview.roles.includes(evidenceFilter.value)?evidenceFilter.value:"all";
  const roleFragment=document.createDocumentFragment();
  const allRoles=el("option","Todas las funciones");allRoles.value="all";roleFragment.append(allRoles);
  for(const role of evidenceReview.roles){
   const option=el("option",role);option.value=role;roleFragment.append(option);
  }
  evidenceFilter.replaceChildren(roleFragment);evidenceFilter.value=selectedRole;
  const reviewItems=evidenceReview.entries.filter(e=>selectedRole==="all"||e.role===selectedRole);
  const evidenceRows=document.createDocumentFragment();
  for(const entry of reviewItems){
   const li=el("li");
   li.append(el("strong",entry.id+" · "+entry.kind));
   li.append(el("small",entry.phase+" · Función: "+entry.role));
   li.append(el("p",entry.requirement));
   li.append(el("small","Riesgos: "+(entry.risks.join(", ")||"sin vincular")+
    " · "+(entry.highRisk?"Incluye riesgo alto":"Sin riesgo alto vinculado")));
   li.append(el("small",entry.level==="external"?"VERIFICACIÓN EXTERNA":
    entry.level==="rehearsed"?"ENSAYO DE LISTA REALIZADO":"EVIDENCIA NO ENSAYADA"));
   const jump=el("button",entry.externalOnly?"Requiere autorización externa":
    "Ir a requisito en la lista ↗");
   jump.type="button";jump.dataset.evidenceReviewFocus=entry.id;
   jump.disabled=entry.externalOnly;li.append(jump);evidenceRows.append(li);
  }
  $("pilotEvidenceReviewList").replaceChildren(evidenceRows);
  set("pilotEvidenceReviewSummary",reviewItems.length+" de "+evidenceReview.required+
   " requisitos visibles; "+evidenceReview.rehearsed+" ensayados, "+
   evidenceReview.external+" externos, "+evidenceReview.verifiedReal+" evidencias reales verificadas.");
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
 $("pilotGuidedList").addEventListener("click",event=>{
  const button=event.target.closest("button[data-pilot-route-target]");
  if(!button||button.disabled||!ledger)return;
  try{ux.showDetails();sectionNavigation.selectById(button.dataset.pilotRouteTarget);remember("route_navigation");}
  catch(error){set("pilotGuidedStatus","No se puede navegar: "+error.message);}
 });
 $("pilotGuidedExport").addEventListener("click",()=>{
  try{
   rebuild();
   const guided=buildPilotGuidedRoute(readiness,plan,ledger,
    simulateEvidenceCoverage(ledger,rehearsed),drills);
   const payload=guidedRouteJson(guided);
   validatePilotExportJson(payload);
   const url=URL.createObjectURL(new Blob([payload],{type:"application/json;charset=utf-8"}));
   const a=document.createElement("a");a.href=url;
   a.download="revops-ruta-guiada-"+scenario+".json";
   document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2500);
   set("pilotGuidedStatus","Ruta agregada descargada. Sin filas ni autorizaciones reales.");
   remember("route_export");
  }catch(error){set("pilotGuidedStatus","Ruta no exportable: "+error.message);}
 });
 $("pilotEvidenceReviewFilter").addEventListener("change",()=>{if(ledger)paint();});
 $("pilotEvidenceReviewList").addEventListener("click",event=>{
  const button=event.target.closest("button[data-evidence-review-focus]");
  if(!button||button.disabled)return;
  const checkbox=[...$("pilotControlChecklist").querySelectorAll("input[data-evidence-id]")]
   .find(box=>box.dataset.evidenceId===button.dataset.evidenceReviewFocus);
  if(checkbox){checkbox.focus();checkbox.scrollIntoView({block:"center",behavior:"instant"});}
 });
 $("pilotEvidenceReviewExport").addEventListener("click",()=>{
  try{
   rebuild();
   const payload=pilotEvidenceReviewJson(buildPilotEvidenceReview(plan,ledger,risks,
    simulateEvidenceCoverage(ledger,rehearsed)));
   validatePilotExportJson(payload);
   const url=URL.createObjectURL(new Blob([payload],{type:"application/json;charset=utf-8"}));
   const link=document.createElement("a");link.href=url;
   link.download="revops-matriz-evidencias-"+scenario+".json";
   document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2500);
   set("pilotEvidenceReviewStatus","Matriz de requisitos descargada; evidencias reales verificadas: 0.");
  }catch(error){set("pilotEvidenceReviewStatus","La matriz no es exportable: "+error.message);}
 });
 $("pilotStressFilter").addEventListener("change",()=>{if(ledger)paint();});
 $("pilotCapacityRoleLimit").addEventListener("change",()=>{
  if(ledger){paint();remember("capacity_change");}
 });
 $("pilotControlFilter").addEventListener("change",()=>{
  if(ledger){paint();remember("severity_filter");}
 });
 $("pilotControlChecklist").addEventListener("change",event=>{
  const input=event.target.closest("input[data-evidence-id]");
  if(!input||!ledger)return;
  const id=input.dataset.evidenceId;
  const next=input.checked?[...rehearsed,id]:rehearsed.filter(value=>value!==id);
  try{
   simulateEvidenceCoverage(ledger,next);rehearsed=next;paint();
   remember(input.checked?"evidence_mark":"evidence_unmark");
  }catch(error){
   input.checked=!input.checked;
   set("pilotControlStatus","No se puede ensayar esta evidencia: "+error.message);
  }
 });
 $("pilotControlRun").addEventListener("click",()=>{
  try{rebuild();drills=runPilotFailureDrills(readiness,plan,risks,ledger);paint();remember("drill_run");}
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
    guided:JSON.parse(guidedRouteJson(buildPilotGuidedRoute(readiness,plan,ledger,coverage,drills))),
    evidenceReview:JSON.parse(pilotEvidenceReviewJson(buildPilotEvidenceReview(plan,ledger,risks,coverage))),
    drills:drills?JSON.parse(pilotDrillReportJson(drills)):null,
    realApprovals:0,externalExecutions:0,
    notice:"Informe de simulación; no existe autorización real."},null,2)+"\n";
   validatePilotExportJson(payload);
   const url=URL.createObjectURL(new Blob([payload],{type:"application/json;charset=utf-8"}));
   const a=document.createElement("a");a.href=url;
   a.download="revops-control-piloto-"+scenario+".json";
   document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2500);
   set("pilotControlStatus","Informe agregado exportado. Sin filas, correos, notas ni aprobaciones reales.");
   remember("report_export");
  }catch(error){set("pilotControlStatus","Exportación rechazada: "+error.message);}
 });
 const exportHandoff=(format,extension,mime)=>{
  try{
   rebuild();
   const board=buildPilotAuthorizationBoard({readiness,plan,risks,ledger,drills});
   const capacity=buildPilotCapacityExplorer(readiness,Number($("pilotCapacityRoleLimit").value));
   const pack=buildPilotHandoffPack(board,plan,risks,ledger,capacity);
   const content=format(pack);
   if(extension==="html")validatePilotHtmlHandoff(content);
   const url=URL.createObjectURL(new Blob([content],{type:mime}));
   const link=document.createElement("a");
   link.href=url;
   link.download="revops-revision-piloto-"+scenario+"."+extension;
   document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2500);
   remember("handoff_export");
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
 const drawAtlas=report=>{
  set("pilotAtlasCases",report.fixtureCount);
  set("pilotAtlasGates",report.gatesEvaluated);
  set("pilotAtlasDrills",report.defensesRehearsed);
  set("pilotAtlasIssues",report.fixtureFailures);
  const fragment=document.createDocumentFragment();
  for(const entry of report.results){
   const li=el("li");
   li.append(el("strong",entry.scenario+" · "+entry.label));
   li.append(el("small",(entry.state==="pass"?"Invariantes locales correctos":"Revisión técnica requerida")+
    " · "+entry.gatePasses+"/8 controles superados · defensas "+entry.drillsPassed+"/7"));
   fragment.append(li);
  }
  $("pilotAtlasResults").replaceChildren(fragment);
  set("pilotAtlasStatus",report.status+" No equivale a certificación ni autorización de producción.");
  $("pilotAtlasExportJson").disabled=false;
  $("pilotAtlasExportTxt").disabled=false;
 };
 $("pilotAtlasRun").addEventListener("click",async()=>{
  const button=$("pilotAtlasRun"),generation=atlasGeneration;
  button.disabled=true;
  set("pilotAtlasStatus","Calculando pruebas funcionales locales...");
  try{
   const module=atlasModule||await import("./pilot-validation-atlas.js");
   if(generation!==atlasGeneration)return;
   atlasModule=module;
   const report=module.runPilotValidationAtlas();
   if(generation!==atlasGeneration)return;
   atlasReport=report;drawAtlas(report);paint();remember("atlas_run");
  }catch(error){
   if(generation===atlasGeneration){
    atlasReport=null;
    $("pilotAtlasExportJson").disabled=true;$("pilotAtlasExportTxt").disabled=true;
    set("pilotAtlasStatus","Validación no completada: "+error.message);
   }
  }finally{if(generation===atlasGeneration)button.disabled=false;}
 });
 const saveAtlas=(mode,mime,extension)=>{
  if(!atlasReport||!atlasModule)return;
  try{
   const text=mode==="json"?atlasModule.pilotValidationAtlasJson(atlasReport):
    atlasModule.pilotValidationAtlasText(atlasReport);
   if(mode==="json")validatePilotExportJson(text);
   const url=URL.createObjectURL(new Blob([text],{type:mime}));
   const a=document.createElement("a");
   a.href=url;a.download="revops-validacion-sintetica-pr90."+extension;
   document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2500);
   remember("atlas_export");
   set("pilotAtlasStatus","Informe "+extension.toUpperCase()+
    " descargado. Todas las pruebas son locales y sintéticas; no existe autorización real.");
  }catch(error){set("pilotAtlasStatus","No se pudo descargar el atlas: "+error.message);}
 };
 $("pilotAtlasExportJson").addEventListener("click",()=>saveAtlas("json","application/json;charset=utf-8","json"));
 $("pilotAtlasExportTxt").addEventListener("click",()=>saveAtlas("txt","text/plain;charset=utf-8","txt"));
 $("pilotV100Actions").addEventListener("click",event=>{
  const button=event.target.closest("button[data-v100-target]");
  if(!button)return;
  try{ux.showDetails();const target=$(button.dataset.v100Target);target?.focus({preventScroll:true});
   target?.scrollIntoView({block:"start",behavior:"instant"});}
  catch(error){set("pilotV100Summary","Navegación no disponible: "+error.message);}
 });
 const currentV100=()=>{
  rebuild();
  const coverage=simulateEvidenceCoverage(ledger,rehearsed);
  const roleLimit=Number($("pilotCapacityRoleLimit").value);
  const capacity=workCache.capacity(roleLimit,()=>buildPilotCapacityExplorer(readiness,roleLimit));
  const evidenceReview=buildPilotEvidenceReview(plan,ledger,risks,coverage);
  const review=buildPilotSupervisedReview({
   readiness,plan,risks,ledger,coverage,drills,capacity,evidenceReview,atlas:atlasReport
  });
  return buildPilotV100Snapshot({readiness,review,risks,capacity,evidenceReview,atlas:atlasReport});
 };
 for(const [id,format,ext,mime] of [
  ["pilotV100ExportJson",pilotV100SnapshotJson,"json","application/json;charset=utf-8"],
  ["pilotV100ExportTxt",pilotV100SnapshotText,"txt","text/plain;charset=utf-8"]
 ]){
  $(id).addEventListener("click",()=>{
   try{
    const body=format(currentV100());
    if(ext==="json")validatePilotExportJson(body);
    const url=URL.createObjectURL(new Blob([body],{type:mime}));
    const a=document.createElement("a");a.href=url;
    a.download="revops-v100-resumen-ejecutivo."+ext;
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2500);
    set("pilotV100Summary","Informe V100 descargado sin datos personales ni aprobaciones reales.");
   }catch(error){set("pilotV100Summary","Informe V100 no exportable: "+error.message);}
  });
 }
 const currentFinalReview=()=>{
  rebuild();
  const coverage=simulateEvidenceCoverage(ledger,rehearsed);
  const capacity=buildPilotCapacityExplorer(readiness,Number($("pilotCapacityRoleLimit").value));
  const evidenceReview=buildPilotEvidenceReview(plan,ledger,risks,coverage);
  return buildPilotSupervisedReview({
   readiness,plan,risks,ledger,coverage,drills,capacity,evidenceReview,atlas:atlasReport
  });
 };
 $("pilotFinalReviewRefresh").addEventListener("click",()=>{
  try{rebuild();paint();}
  catch(error){set("pilotFinalReviewStatus","Revisión no calculada: "+error.message);}
 });
 for(const [id,format,ext,mime] of [
  ["pilotFinalReviewJson",pilotSupervisedReviewJson,"json","application/json;charset=utf-8"],
  ["pilotFinalReviewTxt",pilotSupervisedReviewText,"txt","text/plain;charset=utf-8"]
 ]){
  $(id).addEventListener("click",()=>{
   try{
    const content=format(currentFinalReview());
    if(ext==="json")validatePilotExportJson(content);
    const url=URL.createObjectURL(new Blob([content],{type:mime}));
    const a=document.createElement("a");a.href=url;
    a.download="revops-revision-supervisada-pr95."+ext;
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2500);
    set("pilotFinalReviewStatus","Revisión "+ext.toUpperCase()+
     " descargada. Sin aprobaciones ni evidencias empresariales verificadas.");
   }catch(error){set("pilotFinalReviewStatus","Revisión no exportable: "+error.message);}
  });
 }
 $("pilotA11yRun").addEventListener("click",()=>{
  try{
   accessibilityReport=runPilotAccessibilityPreflight(root);
   const auto=document.createDocumentFragment();
   for(const check of accessibilityReport.automatic){
    const li=el("li",check.title+" · "+(check.state==="local_pass"?"Correcto en DOM":"Revisar"));
    auto.append(li);
   }
   $("pilotA11yAutomated").replaceChildren(auto);
   const manual=document.createDocumentFragment();
   for(const step of accessibilityReport.manual){
    const li=el("li");
    li.append(el("strong",step.title),el("small",step.how),el("small","PENDIENTE DE PRUEBA HUMANA"));
    manual.append(li);
   }
   $("pilotA11yManual").replaceChildren(manual);
   set("pilotA11ySummary",accessibilityReport.automatedPassed+
    "/6 comprobaciones estructurales; 8 evaluaciones humanas pendientes y 0 verificadas.");
   $("pilotA11yExport").disabled=false;
  }catch(error){
   accessibilityReport=null;$("pilotA11yExport").disabled=true;
   set("pilotA11ySummary","Evaluación incompleta: "+error.message);
  }
 });
 $("pilotA11yExport").addEventListener("click",()=>{
  if(!accessibilityReport)return;
  try{
   const payload=pilotAccessibilityJson(accessibilityReport);
   validatePilotExportJson(payload);
   const url=URL.createObjectURL(new Blob([payload],{type:"application/json;charset=utf-8"}));
   const a=document.createElement("a");a.href=url;a.download="revops-accesibilidad-pendiente.json";
   document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2500);
  }catch(error){set("pilotA11ySummary","Exportación rechazada: "+error.message);}
 });
 $("pilotSessionAuditExport").addEventListener("click",()=>{
  try{
   const payload=pilotSessionJournalJson(sessionJournal.snapshot());
   validatePilotExportJson(payload);
   const url=URL.createObjectURL(new Blob([payload],{type:"application/json;charset=utf-8"}));
   const link=document.createElement("a");link.href=url;
   link.download="revops-eventos-locales.json";
   document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2500);
  }catch(error){set("pilotSessionAuditCount","No se puede exportar el historial: "+error.message);}
 });
 $("pilotSessionAuditClear").addEventListener("click",()=>{sessionJournal.clear();drawSessionJournal();});
 $("pilotControlReset").addEventListener("click",()=>{
  rehearsed=[];drills=null;if(ledger){paint();remember("reset");}
  set("pilotControlStatus","Ensayos reiniciados. Los requisitos externos siguen pendientes.");
 });
 const close=()=>{
  ux.showSummary();
  root.hidden=true;$("pilotControlOpen").setAttribute("aria-expanded","false");
  $("pilotControlOpen").focus();
 };
 $("pilotControlClose").addEventListener("click",close);
 const api=Object.freeze({
  sync,close,clear(){
   sectionNavigation.reset();ux.reset();
   rehearsed=[];drills=null;scenario=null;source=null;
   prepared=null;workCache.clear();
   accessibilityReport=null;
   $("pilotA11yAutomated").replaceChildren();
   $("pilotA11yManual").replaceChildren();
   $("pilotA11yExport").disabled=true;
   set("pilotA11ySummary","La muestra ha cambiado; comprobar de nuevo.");
   sessionJournal.clear();drawSessionJournal();
   readiness=null;plan=null;risks=null;ledger=null;
   root.hidden=true;
   $("pilotControlOpen").setAttribute("aria-expanded","false");
   $("pilotEvidenceReviewList").replaceChildren();
   $("pilotEvidenceReviewFilter").value="all";
   set("pilotEvidenceReviewSummary","Sin revisión activa.");
   set("pilotEvidenceReviewStatus","0 evidencias reales verificadas.");
   $("pilotGuidedList").replaceChildren();
   set("pilotGuidedSummary","Sin ruta: ejecuta el proceso.");
   $("pilotFinalReviewList").replaceChildren();
   $("pilotV100Actions").replaceChildren();
   $("pilotV100RiskHighlights").replaceChildren();
   set("pilotV100Checks","0/8");
   set("pilotV100Atlas","Pendiente");
   set("pilotV100Stage","Ejecuta la muestra actual para regenerar el resumen.");
   set("pilotFinalLocal","0/8");
   set("pilotFinalAttention","0");
   set("pilotFinalExternal","4");
   set("pilotFinalApprovals","0");
   set("pilotFinalReviewStatus","Revisión invalidada al modificar la muestra.");
   set("pilotGuidedStatus","Ruta invalidada por el cambio de muestra.");
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
   atlasGeneration++;atlasReport=null;
   $("pilotAtlasResults").replaceChildren();
   for(const id of ["pilotAtlasCases","pilotAtlasGates","pilotAtlasDrills","pilotAtlasIssues"])set(id,"0");
   $("pilotAtlasRun").disabled=false;
   $("pilotAtlasExportJson").disabled=true;$("pilotAtlasExportTxt").disabled=true;
   set("pilotAtlasStatus","Validación sintética descartada en esta pestaña.");
   set("pilotControlStatus","Muestra modificada o sesión limpiada. Ejecuta el proceso nuevamente.");
  }
 });
 api.sync();return api;
}
