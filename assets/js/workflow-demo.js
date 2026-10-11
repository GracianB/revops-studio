import { SCENARIOS, runWorkflow, exportResultCsv, editWorkflowRecord, exportActionQueueCsv, exportVisibleRowsCsv } from "./workflow-engine.js";
import { suggestMapping, normalizeMappedCsv } from "./column-mapper.js";
import {decodeImportBytes,inspectImport,ensureImportReady,makeMappingProfile,readMappingProfile} from "./import-contract.js";
import { analyzeWorkflow, insightsReport } from "./workflow-insights.js";
import {RECIPE_LABELS,recipe,fieldGuide,issueColumn,orderRows,qualitySnapshot} from "./workflow-product-kit.js";
import {createClientJourney} from "./client-journey.js";
import {compareWorkflow,comparisonReport} from "./workflow-comparison.js";
import {buildQualityCockpit,compareQualityCockpit,qualityCockpitReport} from "./quality-cockpit.js";
import {previewRecordEdit,createCorrectionTimeline,nextBlockedIndex,safeViewPreset} from "./correction-workbench.js";
import {installAccessibleNavigation,focusHeading} from "./a11y-workbench.js";
import {inspectDataExposure,clearRevopsSession} from "./privacy-security.js";

const $=id=>document.getElementById(id);
const buttons=[...document.querySelectorAll("[data-scenario]")];
const storageKey="revops-studio:demo:handoff";
const allowed=Object.keys(SCENARIOS);
const urlParams=new URLSearchParams(location.search);
const query=urlParams.get("scenario");
const initialMode=urlParams.get("view")==="simple"?"simple":
  urlParams.get("view")==="advanced"?"advanced":
  urlParams.has("scenario")?"advanced":"simple";
let guide=null;
let scenario=allowed.includes(query)?query:"orders";
let latest=null, baseline=null, evidence=null, qualityBaseline=null, qualityCurrent=null, qualityEvidence=null;
let activeFilter="all",editIndex=null,undoSource=null,redoSource=null;
let correctionTimeline=null, editPreview=null, editorTrigger=null, editorDirty=false;
let decisionConsole=null,candidateConsole=null,reportConsole=null,pilotConsole=null,pilotPlanConsole=null;
let mappingSource=null,mappingScenario=null;
let modifiedSource=false,pendingScenario=null;
function setText(id,text){const element=$(id);if(element)element.textContent=String(text);}
function announceWorkbench(text){setText("workbenchA11yAnnounce",String(text).slice(0,190));}
function errorText(message){
  const element=$("workflowError");
  if(!element)return;
  element.hidden=!message;
  element.textContent=message||"";
  $("workflowSource").setAttribute("aria-invalid",String(Boolean(message)));
  if(message)element.focus();
}
function invalidate(message){
  latest=null;baseline=null;evidence=null;qualityBaseline=null;qualityCurrent=null;qualityEvidence=null;
  correctionTimeline=null;editPreview=null;
  decisionConsole?.clear?.();candidateConsole?.clear?.();reportConsole?.clear?.();pilotConsole?.clear?.();pilotPlanConsole?.clear?.();
  $("pilotStudio").hidden=true;$("pilotOpen").disabled=true;
  $("pilotPlanStudio").hidden=true;$("pilotPlanOpen").disabled=true;
  $("pilotPlanOpen").setAttribute("aria-expanded","false");
  $("pilotOpen").setAttribute("aria-expanded","false");
  $("privacyInspect").disabled=true;
  $("privacyClearConfirm").hidden=true;
  $("r2Evidence").hidden=true;
  $("rulesStudio").hidden=true;
  $("candidateStudio").hidden=true;
  $("reportStudio").hidden=true;
  $("reportOpen").disabled=true;
  $("reportOpen").setAttribute("aria-expanded","false");
  announceWorkbench("Datos modificados. Debes ejecutar el proceso para recuperar informes y resultados.");
  $("candidateOpen").setAttribute("aria-expanded","false");
  $("candidateOpen").disabled=true;
  $("rulesOpen").setAttribute("aria-expanded","false");
  $("rulesOpen").disabled=true;
  $("qualityCockpit").hidden=true;
  $("qualityExport").disabled=true;
  $("r2Export").disabled=true;
  $("exportWorkflow").disabled=true;
  $("copyWorkflow").disabled=true;
  $("exportActionQueue").disabled=true;
  $("exportVisible").disabled=true;
  $("exportInsights").disabled=true;
  $("changeComparison").hidden=true;
  $("quickDemoAction").disabled=true;
  resetInsights();
  closeEditor();
  $("demoContact").dataset.ready="false";
  setText("workflowStatus",message);
}
function closeColumnMapper(){
  mappingSource=null;
  mappingScenario=null;
  $("columnMapper").hidden=true;
  $("columnMappingRows").replaceChildren();
  $("columnMappingPreview").replaceChildren();
  setText("columnMappingStatus","");
  $("confirmDiscardColumns").checked=false;
  setText("mappingProfileStatus","Un perfil solo contiene los nombres de columnas y el escenario.");
}
function auditImport(check){
  setText("importAuditTitle","Contrato: "+check.format+" · "+check.rows+" registro(s)");
  setText("importAuditSummary","Estado: "+({
    ready:"Listo para validar",confirm_discards:"Confirma columnas adicionales",
    mapping_required:"Relaciona campos obligatorios",mapping_conflict:"Corrige columnas repetidas",
    regional_ambiguous:"Corrige separadores regionales ambiguos"
  }[check.status]||"Requiere revisión")+". No se ha sustituido el archivo anterior.");
  const list=$("importAuditFindings"),frag=document.createDocumentFragment();
  const info=[
    ...(check.ignored.length?["Columnas extras: "+check.ignored.join(", ")]:[]),
    ...(check.missing.length?["Campos sin correspondencia: "+check.missing.join(", ")]:[]),
    ...(check.conflicts.length?["IDs repetidos: "+check.conflicts.map(v=>"fila "+v.line+" ("+v.kind+")").join("; ")]:[]),
    ...(check.ambiguousLines.length?["Importes ambiguos en filas "+check.ambiguousLines.join(", ")+": revisa puntos y comas antes de aplicar."]:[]),
    ...(check.counts?["Simulación: "+check.counts.listo+" listos, "+check.counts.revisar+" revisiones, "+check.counts.bloqueado+" bloqueados."]:[])
  ];
  for(const item of info.length?info:["Cabeceras y contenido estructural válidos."]){
    const li=document.createElement("li");li.textContent=item;frag.append(li);
  }
  list.replaceChildren(frag);
}
function currentMapping(){
  return Object.fromEntries([...$("columnMappingRows").querySelectorAll("select")].map(select=>
    [select.dataset.target,select.value]));
}
function downloadMappingFile(filename,body){
  const url=URL.createObjectURL(new Blob([body],{type:"application/json;charset=utf-8"}));
  const link=document.createElement("a");link.href=url;link.download=filename;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}

function mappingStatus(message,isError=false){
  const element=$("columnMappingStatus");
  element.textContent=message;
  element.dataset.error=String(isError);
}
function renderMappingPreview(){
  if(mappingSource===null || mappingScenario!==scenario)return;
  const selects=[...$("columnMappingRows").querySelectorAll("select")];
  const mapping=Object.fromEntries(selects.map(select=>[select.dataset.target,select.value]));
  const preview=$("columnMappingPreview");
  preview.replaceChildren();
  const heading=document.createElement("p");
  preview.append(heading);
  try{
    const validation=inspectImport(scenario,mappingSource,mapping);
    auditImport(validation);
    ensureImportReady(validation,true); // Preview is not applying or discarding rows.
    const converted=normalizeMappedCsv(scenario,mappingSource,mapping);
    const result=runWorkflow(scenario,converted);
    heading.textContent="VISTA PREVIA DE DESTINO · "+result.counts.total+" filas. "+
      result.counts.listo+" listas, "+result.counts.revisar+" a revisar y "+result.counts.bloqueado+" bloqueadas.";
    for(const row of result.rows.slice(0,3)){
      const line=document.createElement("div");
      line.className="workbench-preview-row";
      const id=document.createElement("strong");
      id.textContent="Fila "+row.line+" · "+row.status;
      const details=document.createElement("span");
      details.textContent=result.columns.map(col=>col+": "+row.values[col]).join(" · ");
      line.append(id,details);preview.append(line);
    }
    const note=document.createElement("p");
    note.textContent="Solo es una simulación previa. Pulsa aplicar para sustituir los datos y ver toda la tabla.";
    preview.append(note);
    mappingStatus("Correspondencias válidas. Revisa los campos de destino y confirma cuando estén bien.");
  }catch(error){
    heading.textContent="Vista previa de destino pendiente. Aún puedes ver tres filas de origen:";
    const original=suggestMapping(scenario,mappingSource);
    for(const sample of original.samples){
      const line=document.createElement("div");
      line.className="workbench-preview-row";
      const name=document.createElement("strong");
      name.textContent="Fila "+sample.line;
      const details=document.createElement("span");
      details.textContent=original.sourceHeaders.slice(0,4).map(h=>h+": "+sample.values[h]).join(" · ");
      line.append(name,details);preview.append(line);
    }
    mappingStatus(error?.message||"Faltan correspondencias para poder simular.",true);
  }
}
function openColumnMapper(text){
  const guess=suggestMapping(scenario,text);
  mappingSource=text;
  mappingScenario=scenario;
  const container=$("columnMappingRows");
  container.replaceChildren();
  for(const destination of guess.columns){
    const row=document.createElement("div");
    row.className="workbench-mapping-row";
    const label=document.createElement("label");
    label.htmlFor="mapping-"+destination;
    label.textContent=destination;
    const select=document.createElement("select");
    select.id=label.htmlFor;
    select.name=destination;
    select.dataset.target=destination;
    const option=document.createElement("option");
    option.value="";
    option.textContent="Seleccionar columna…";
    select.append(option);
    for(const header of guess.sourceHeaders){
      const choice=document.createElement("option");
      choice.value=header;
      choice.textContent=header;
      select.append(choice);
    }
    select.value=guess.mapping[destination]||"";
    const hint=document.createElement("span");
    hint.className="workbench-match-hint";
    hint.textContent=guess.mapping[destination] ?
      (guess.matches[destination]==="exacta"?"Coincidencia exacta":"Sugerencia · confirmar") :
      "Pendiente · obligatorio";
    row.append(label,select,hint);
    container.append(row);
  }
  const other=guess.ignored.length?guess.ignored.join(", "):"ninguna";
  auditImport(inspectImport(scenario,text));
  $("confirmDiscardColumns").checked=false;
  setText("columnMappingIgnored","Columnas adicionales que no se usarán: "+other+". Las originales se conservarán hasta confirmar.");
  $("columnMapper").hidden=false;
  renderMappingPreview();
  $("columnMapper").scrollIntoView({block:"nearest",behavior:"instant"});
  focusHeading(document,"columnMapper","columnMapperTitle");
}
function chooseScenario(next,force=false){
  if(!SCENARIOS[next])return;
  if(!force && modifiedSource && next!==scenario){
    pendingScenario=next;
    setText("scenarioDiscardDescription","Vas a pasar a «"+SCENARIOS[next].title+"». Tus datos actuales, incluso los editados, se perderán de esta pestaña.");
    $("scenarioDiscard").hidden=false;
    $("confirmScenarioDiscard").focus();
    return;
  }
  if(!force && modifiedSource && next===scenario)return;
  modifiedSource=false;pendingScenario=null;
  $("scenarioDiscard").hidden=true;
  scenario=next;
  const data=SCENARIOS[next];
  buttons.forEach(button=>{
    const active=button.dataset.scenario===scenario;
    button.classList.toggle("is-active",active);
    button.setAttribute("aria-pressed",String(active));
  });
  $("workflowSource").value=data.sample;
  $("importWorkflow").value="";
  closeColumnMapper();
  undoSource=null;redoSource=null;
  $("undoCorrection").disabled=true;$("redoCorrection").disabled=true;
  $("workflowSort").value="source";
  $("workflowRecipe").value="original";
  setText("recipeHint",RECIPE_LABELS.original.description);
  activeFilter="all";
  $("workflowSearch").value="";
  syncFilterButtons();
  setText("scenarioDescription",data.intro);
  errorText("");
  invalidate("Ejemplo cargado. Ejecuta el proceso para revisar cada registro.");
  renderEmpty();
  // The deep link has only a scenario id; never put row content in the URL.
  const selectedMode=guide?.state().mode||initialMode;
  history.replaceState(null,"",location.pathname+"?scenario="+encodeURIComponent(next)+
    (selectedMode==="simple"?"&view=simple":"")+"#simulador");
  guide?.setScenario(next,null);
}
function normalizeSearch(value){
  return String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}
function resetInsights(){
  for(const id of ["insightsRatio","insightsActionable","insightsHistoric","insightsReview","insightsBlocked"])
    setText(id,id==="insightsRatio"?"0 %":"0");
  setText("insightsSummary","Ejecuta el proceso y descubre qué requiere atención y qué puede prepararse para el siguiente paso.");
  for(const element of $("insightsDistribution").children)element.style.width="0%";
  const container=$("insightsSteps");
  container.replaceChildren();
  const text=document.createElement("p");
  text.className="workbench-empty-insight";
  text.textContent="Los siguientes pasos aparecerán después de ejecutar el proceso.";
  container.append(text);
}
function renderInsights(result){
  const view=analyzeWorkflow(result);
  setText("insightsSummary",view.summary);
  setText("insightsRatio",view.ratio+" %");
  setText("insightsActionable",view.actionable);
  setText("insightsHistoric",view.historical);
  setText("insightsReview",view.reviewCount);
  setText("insightsBlocked",view.blockedCount);
  // CSS percentage is derived from row counts, not from speculative ROI.
  const share=count=>view.total?(count/view.total*100).toFixed(3)+"%":"0%";
  for(const [index,count] of [
    view.actionable,view.historical,view.reviewCount,view.blockedCount
  ].entries())$("insightsDistribution").children[index].style.width=share(count);
  const steps=$("insightsSteps"),fragment=document.createDocumentFragment();
  view.steps.forEach((item,index)=>{
    const article=document.createElement("article");
    article.className="workbench-insight-item";
    const number=document.createElement("span");
    number.textContent=String(index+1).padStart(2,"0");
    const content=document.createElement("div");
    const title=document.createElement("h3");
    title.textContent=item.title;
    const description=document.createElement("p");
    description.textContent=item.detail;
    content.append(title,description);
    const action=document.createElement("button");
    action.type="button";
    action.dataset.insightsFilter=item.type;
    action.textContent=item.type==="bloqueado"?"Ir a bloqueados ↗":
      item.type==="revisar"?"Ver casos a revisar ↗":
        item.type==="listo"?"Ver registros listos ↗":"Ver todos ↗";
    article.append(number,content,action);
    fragment.append(article);
  });
  steps.replaceChildren(fragment);
}
function changeResultsFilter(next){
  activeFilter=next;
  $("workflowSearch").value="";
  syncFilterButtons();
  closeEditor();
  applyFilter();
  $("workflowRows").closest(".workbench-rows").scrollIntoView({behavior:"instant",block:"start"});
}
function firstBlocked(){
  if(!latest)return;
  const index=latest.rows.findIndex(row=>row.status==="bloqueado");
  if(index<0)return;
  activeFilter="bloqueado";
  $("workflowSearch").value="";
  syncFilterButtons();
  applyFilter();
  openEditor(index);
}
function renderQuality(){
  if(!latest)return;
  try{
    const snapshot=qualitySnapshot(scenario,$("workflowSource").value);
    setText("qualityCompleteness",snapshot.completeness+" %");
    const target=$("qualityFields"),frag=document.createDocumentFragment();
    for(const [name,count] of Object.entries(snapshot.blanks)){
      const item=document.createElement("span");
      item.className="workbench-quality-field"+(count?" has-gaps":"");
      item.textContent=name+": "+(count?count+" sin dato":"completo");
      frag.append(item);
    }
    target.replaceChildren(frag);
  }catch{
    setText("qualityCompleteness","—");
    $("qualityFields").replaceChildren();
  }
}
function sortResults(){
  if(!latest)return;
  const parent=$("workflowRows");
  const originals=new Map([...parent.querySelectorAll(".workbench-row")].map(tr=>[Number(tr.dataset.editIndex),tr]));
  for(const item of orderRows(latest,$("workflowSort").value)){
    const node=originals.get(item.sourceIndex);
    if(node)parent.append(node);
  }
}
function downloadWorkflowExample(){
  const csv=recipe(scenario,"clear").split("\n").slice(0,2).join("\n")+"\n";
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
  const uri=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=uri;a.download="revops-plantilla-"+scenario+".csv";
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(uri),1000);
  setText("recipeHint","Plantilla descargada con una fila ficticia y cabeceras correctas.");
}
function loadWorkflowExample(){
  try{
    const name=$("workflowRecipe").value,txt=recipe(scenario,name);
    const parsed=runWorkflow(scenario,txt);
    $("workflowSource").value=txt;
    modifiedSource=false;
    undoSource=null;redoSource=null;
    $("undoCorrection").disabled=true;$("redoCorrection").disabled=true;
    closeColumnMapper();errorText("");
    activeFilter="all";syncFilterButtons();
    $("workflowSort").value="source";$("workflowSearch").value="";
    baseline=null;
    render(parsed);
    $("changeComparison").hidden=true;
    setText("workflowStatus","Ejemplo «"+RECIPE_LABELS[name].label+"» procesado. Puedes editar sus filas.");
    $("lectura-resultados").scrollIntoView({behavior:"instant",block:"start"});
  }catch(error){errorText(error?.message||"No se pudo cargar el ejemplo.");}
}
function renderEmpty(){
  for(const id of ["countTotal","countReady","countReview","countBlocked"])setText(id,"0");
  const rows=$("workflowRows");
  rows.replaceChildren();
  const tr=document.createElement("tr"),td=document.createElement("td");
  td.colSpan=5;td.textContent="Ejecuta el proceso para ver el detalle de cada registro.";
  setText("workflowFilterStatus","Ejecuta un escenario para filtrar y corregir los registros.");
  $("workflowNoResults").hidden=true;
  $("qualityFields").replaceChildren();
  setText("qualityCompleteness","0 %");
  $("fixFirstIssue").disabled=true;
  $("quickDemoAction").disabled=true;
  tr.append(td);rows.append(tr);
  [...$("workflowPipeline").querySelectorAll("li")].forEach(li=>{
    li.querySelector(".workbench-step-count")?.remove();
  });
}
function cell(tr,text,className){
  const td=document.createElement("td");
  if(className)td.className=className;
  td.textContent=String(text);
  tr.append(td);return td;
}
function renderR2(result){
  if(!baseline){baseline=result;qualityBaseline=null;}
  evidence=compareWorkflow(baseline,result);
  const a=evidence.before,b=evidence.after,d=evidence.delta;
  for(const [id,value] of Object.entries({
    r2BeforePrepared:a.prepared,r2BeforeBlocked:a.blocked,r2BeforeReview:a.reviewing,
    r2AfterPrepared:b.prepared,r2AfterBlocked:b.blocked,r2AfterReview:b.reviewing
  }))setText(id,value);
  setText("r2Summary",evidence.summary);
  const signed=n=>n>0?"+"+n:String(n);
  setText("r2Delta","Cambios del cálculo: "+signed(d.prepared)+" propuestas, "+
    signed(d.blocked)+" bloqueos y "+signed(d.reviewing)+" revisiones humanas. "+
    "Acciones externas ejecutadas: 0.");
  const list=$("r2Transitions"),items=document.createDocumentFragment();
  if(evidence.transitions.length){
    for(const item of evidence.transitions){
      const li=document.createElement("li");
      li.textContent=item.description;
      items.append(li);
    }
  }else{
    const li=document.createElement("li");
    li.textContent="Sin diferencias en decisiones o motivos entre las ejecuciones comparadas.";
    items.append(li);
  }
  list.replaceChildren(items);
  setText("r2Rules",evidence.rule+" "+evidence.limitation);
  $("r2Evidence").hidden=false;
  $("r2Export").disabled=!evidence.comparable;
}

function renderQualityCockpit(result){
  const current=buildQualityCockpit(scenario,$("workflowSource").value,result);
  if(!qualityBaseline)qualityBaseline=current;
  qualityCurrent=current;
  qualityEvidence=compareQualityCockpit(qualityBaseline,current);
  const idCounts={
    qualityUniqueIds:current.uniqueIds,qualityConflicts:current.flags.conflictingIds.count,
    qualityExactDuplicates:current.flags.exactDuplicates.count,qualityOutliers:current.flags.outliers.count
  };
  for(const [name,value] of Object.entries(idCounts))setText(name,value);
  const make=(name,content)=>{
    const el=document.createElement(name);el.textContent=content;return el;
  };
  const columns=document.createDocumentFragment();
  for(const [field,state] of Object.entries(current.blanks)){
    const row=document.createElement("div");row.className="quality-cockpit-row";
    row.append(make("strong",field),make("span",state.count+" vacío(s)"));
    if(state.count){
      const button=make("button","Abrir fila "+(state.indexes[0]+1)+" ↗");
      button.type="button";button.dataset.qualityIndex=String(state.indexes[0]);row.append(button);
    }
    columns.append(row);
  }
  $("qualityColumnDetails").replaceChildren(columns);
  const descriptions={
    exactDuplicates:"Duplicados idénticos",conflictingIds:"Claves con información contradictoria",
    invalidDates:"Fechas inválidas",invalidNumbers:"Valores numéricos inválidos",
    negatives:"Importes negativos",outliers:"Candidatos a valor atípico",
    blocked:"Registros bloqueados",reviewing:"Pendientes de revisión humana",
    missing:"Filas con campos vacíos"
  };
  const issues=document.createDocumentFragment();
  for(const [name,title] of Object.entries(descriptions)){
    const state=current.flags[name];
    if(!state.count)continue;
    const button=make("button",title+" · "+state.count+" · revisar ↗");
    button.type="button";button.dataset.qualityIndex=String(state.indexes[0]);
    button.className="quality-cockpit-issue";
    issues.append(button);
  }
  if(!issues.childNodes.length)issues.append(make("p","No se han detectado incidencias por estas reglas."));
  $("qualityInvestigations").replaceChildren(issues);
  const bands=document.createDocumentFragment();
  for(const band of current.bands){
    const row=document.createElement("div");row.className="quality-cockpit-band";
    row.append(make("span",band.label),make("strong",String(band.count)));
    bands.append(row);
  }
  if(!current.bands.length)bands.append(make("p","Este proceso no tiene un campo numérico de negocio."));
  $("qualityNumericBands").replaceChildren(bands);
  setText("qualityStatNote",current.stats.insufficient?
    "Sin muestra o variación suficiente para detectar candidatos estadísticos. Se necesitan al menos cinco valores y dispersión.":
    "Candidatos calculados con regla IQR (1,5 × rango intercuartílico); requieren verificación humana.");
  const d=qualityEvidence.delta,sgn=n=>n>0?"+"+n:String(n);
  setText("qualityDelta","Desde la primera ejecución: "+sgn(d.completeness)+" puntos de integridad, "+
    sgn(d.missingCells)+" celdas vacías, "+sgn(d.conflictingIds)+" conflictos de ID, "+
    sgn(d.blocked)+" bloqueos. Sin acciones externas.");
  setText("qualityDominant",current.dominant?
    "Bloqueo más repetido: "+current.dominant.reason+" ("+current.dominant.count+" registro(s)).":
    "No hay bloqueos registrados en este conjunto.");
  $("qualityCockpit").hidden=false;
  $("qualityExport").disabled=false;
}

function historyEntry(button,label,active,index){
  button.type="button";
  button.dataset.historyIndex=String(index);
  button.setAttribute("aria-current",active?"step":"false");
  button.textContent=label+(active?" · actual":"");
  return button;
}
function updateCorrectionHistory(){
  const view=correctionTimeline?.state(),list=$("correctionHistorySteps");
  if(!list)return;
  const frag=document.createDocumentFragment();
  for(const step of view?.operations||[]){
    const li=document.createElement("li");
    const button=document.createElement("button");
    li.append(historyEntry(button,step.label,step.active,step.index));
    frag.append(li);
  }
  list.replaceChildren(frag);
  setText("correctionHistoryStatus",view?
    (view.index+" de "+(view.states-1)+" correcciones activas · "+(view.states-1)+" estados reversibles. Solo en esta pestaña."):
    "Aún no hay correcciones. Ejecuta un escenario para comenzar.");
  $("undoCorrection").disabled=!view?.canUndo;
  $("redoCorrection").disabled=!view?.canRedo;
}
function applyWorkbenchPresentation(){
  const reason=$("workbenchShowReason").checked,action=$("workbenchShowAction").checked;
  const head=$("workflowRows").closest("table");
  head.classList.toggle("workbench-p74-hide-reason",!reason);
  head.classList.toggle("workbench-p74-hide-action",!action);
  head.classList.toggle("workbench-p74-density-compact",$("workbenchDensity").value==="compact");
}
function readWorkbenchView(){
 return {
  filter:activeFilter,sort:$("workflowSort").value,density:$("workbenchDensity").value,
  reason:$("workbenchShowReason").checked,action:$("workbenchShowAction").checked
 };
}
function applyWorkbenchView(config){
 const filters=["all","bloqueado","revisar","listo"];
 const sorts=["source","risk","identifier","status"];
 if(!config||!filters.includes(config.filter)||!sorts.includes(config.sort)||
   !["compact","comfortable"].includes(config.density)||
   typeof config.reason!=="boolean"||typeof config.action!=="boolean")return false;
 activeFilter=config.filter;
 $("workflowSort").value=config.sort;
 $("workbenchDensity").value=config.density;
 $("workbenchShowReason").checked=config.reason;
 $("workbenchShowAction").checked=config.action;
 $("workflowSearch").value="";
 $("workbenchViewPreset").value="all";
 syncFilterButtons();
 sortResults();applyWorkbenchPresentation();applyFilter();
 return true;
}
function currentEdits(){
 return Object.fromEntries([...$("workflowEditFields").querySelectorAll("input")].map(input=>[input.name,input.value]));
}
function paintEditPreview(){
 if(editIndex===null||!latest)return;
 const old=$("workflowSource").value,container=$("editPreviewDiff"),warning=$("editPreviewWarning");
 container.replaceChildren();editPreview=null;
 try{
  const check=previewRecordEdit(scenario,old,editIndex,currentEdits());
  editPreview=check;
  editorDirty=check.changed;
  $("saveWorkflowEdit").disabled=!check.valid;
  setText("editDirtyStatus",check.changed?
   "Tienes cambios sin guardar. Guarda o cancela antes de navegar a otra incidencia.":
   "No hay modificaciones pendientes.");
  if(!check.valid){
   setText("editPreviewStatus","Sin cambios");
   setText("editPreviewImpact",check.message);
   warning.textContent="";return;
  }
  for(const input of $("workflowEditFields").querySelectorAll("input[aria-invalid]")){
   if(check.afterReason!==latest.rows[editIndex].reason)input.setAttribute("aria-invalid","false");
  }
  setText("editPreviewStatus",check.beforeStatus+" → "+check.afterStatus);
  setText("editPreviewImpact","Reglas recalculadas sobre "+check.counts.after.total+" registros: "+
   (check.counts.actionableDelta>0?"+":"")+check.counts.actionableDelta+" propuestas preparadas, "+
   (check.counts.blockedDelta>0?"+":"")+check.counts.blockedDelta+" bloqueos y "+
   (check.counts.reviewDelta>0?"+":"")+check.counts.reviewDelta+" revisiones. No se ha guardado.");
  for(const change of check.diff){
   const row=document.createElement("div");row.className="workbench-p74-diff-row";
   const label=document.createElement("strong");label.textContent=change.field;
   const left=document.createElement("span");left.textContent="Antes: "+(change.before||"(vacío)");
   const right=document.createElement("span");right.textContent="Propuesto: "+(change.after||"(vacío)");
   row.append(label,left,right);container.append(row);
  }
  warning.textContent=check.approvalRequired?
   "Este registro sigue requiriendo revisión humana. Guardar no equivale a aprobar ni a ejecutar.":
   check.afterStatus==="bloqueado"?"El registro seguiría bloqueado. La corrección puede guardarse, pero no se ejecutará.":check.message;
 }catch(error){
  editorDirty=true;
  $("saveWorkflowEdit").disabled=true;
  setText("editDirtyStatus","Hay cambios sin guardar; revisa el error.");
  setText("editPreviewStatus","No se puede calcular");
  setText("editPreviewImpact","Corrige el formato del registro antes de continuar.");
  warning.textContent=error?.message||"Error al recalcular.";
 }
}

function render(result){
  latest=result;
  if(!correctionTimeline||correctionTimeline.state().source!==$("workflowSource").value){
    correctionTimeline=createCorrectionTimeline(scenario,$("workflowSource").value);
  }
  updateCorrectionHistory();
  renderR2(result);
  setText("countTotal",result.counts.total);
  setText("countReady",result.counts.listo);
  setText("countReview",result.counts.revisar);
  setText("countBlocked",result.counts.bloqueado);
  $("privacyInspect").disabled=false;
  const exposure=inspectDataExposure(result);
  setText("privacyRiskStatus",exposure.records+" registros en memoria · "+exposure.emails+" apariciones de email ("+
   exposure.nonExampleEmails+" fuera de dominios de ejemplo) · "+exposure.formulaLike+
   " celda(s) con fórmulas potenciales. CSV detallado: puede contener datos privados. Los informes agregados no contienen filas.");
  const list=$("workflowPipeline").querySelectorAll("li");
  result.steps.forEach((step,index)=>{
    const li=list[index];
    if(!li)return;
    const old=li.querySelector(".workbench-step-count");
    if(old)old.remove();
    const count=document.createElement("span");
    count.className="workbench-step-count";
    count.textContent=String(step.count);
    li.querySelector("div").append(count);
  });
  const body=$("workflowRows");
  const frag=document.createDocumentFragment();
  for(const [index,row] of result.rows.entries()){
    const tr=document.createElement("tr");
    const idCell=cell(tr,row.id);idCell.dataset.label="Registro";
    const status=cell(tr,"");status.dataset.label="Resultado";
    const label=document.createElement("span");
    label.className="workbench-result-pill";
    label.dataset.state=row.status;
    label.textContent=row.status;
    status.append(label);
    const reasonCell=cell(tr,row.reason);reasonCell.dataset.label="Motivo";reasonCell.classList.add("workbench-optional-reason");
    const actionCell=cell(tr,row.action);actionCell.dataset.label="Siguiente acción";actionCell.classList.add("workbench-optional-action");
    tr.className="workbench-row";
    tr.dataset.status=row.status;
    tr.dataset.editIndex=String(index);
    tr.dataset.search=normalizeSearch([row.id,...Object.values(row.values),row.reason,row.action].join(" "));
    const edit=cell(tr,"");edit.dataset.label="Corregir";
    const trigger=document.createElement("button");
    trigger.type="button";
    trigger.className="workbench-row-edit";
    trigger.dataset.editIndex=String(index);
    trigger.setAttribute("aria-label","Editar fila "+(index+1)+". "+row.status+". "+row.reason);
    trigger.setAttribute("aria-describedby","workbenchKeyboardHelp");
    trigger.setAttribute("aria-keyshortcuts","ArrowDown ArrowUp Home End");
    trigger.textContent="Editar ↗";
    edit.append(trigger);
    frag.append(tr);
  }
  body.replaceChildren(frag);
  announceWorkbench("Proceso analizado: "+result.counts.total+" registros, "+result.counts.bloqueado+" bloqueados y "+result.counts.revisar+" pendientes de revisión.");
  applyWorkbenchPresentation();
  guide?.sync(result);
  sortResults();
  renderQuality();
  renderQualityCockpit(result);
  renderInsights(result);
  $("rulesOpen").disabled=false;
  $("candidateOpen").disabled=false;
  $("reportOpen").disabled=false;
  $("pilotOpen").disabled=false;
  $("pilotPlanOpen").disabled=false;
  if(pilotPlanConsole&&!$("pilotPlanStudio").hidden)pilotPlanConsole.sync();
  if(pilotConsole&&!$("pilotStudio").hidden)pilotConsole.sync();
  if(reportConsole&&!$("reportStudio").hidden)reportConsole.sync();
  if(candidateConsole&&!$("candidateStudio").hidden)candidateConsole.sync();
  if(decisionConsole&&!$("rulesStudio").hidden)
    decisionConsole.sync(scenario,$("workflowSource").value,result);
  applyFilter();
  setText("workflowStatus",result.counts.total+" registros analizados. "+result.counts.listo+" listos, "+
    result.counts.revisar+" pendientes de revisión y "+result.counts.bloqueado+" bloqueados. "+
    "Ninguna acción externa ejecutada.");
  $("exportWorkflow").disabled=false;
  $("copyWorkflow").disabled=false;
  $("exportActionQueue").disabled=!result.rows.some(row=>row.status==="listo" && !/histórico/i.test(row.action));
  $("exportInsights").disabled=false;
  $("fixFirstIssue").disabled=!result.rows.some(row=>row.status==="bloqueado");
  $("quickDemoAction").disabled=$("fixFirstIssue").disabled;
  $("demoContact").dataset.ready="true";
}
function summary(){
  if(!latest)return "";
  const data=SCENARIOS[scenario],counts=latest.counts,insights=analyzeWorkflow(latest);
  return [
    "Escenario de simulación: "+data.title,
    "Registros analizados: "+counts.total,
    "Acciones preparadas (excluye históricos): "+insights.actionable,
    "Históricos sin acciones nuevas: "+insights.historical,
    "Para revisión humana: "+counts.revisar,
    "Bloqueados: "+counts.bloqueado,
    "Es una simulación local con reglas deterministas: no existen conexiones al CRM/ERP ni envío de registros.",
    "Me gustaría estudiar la automatización o herramienta equivalente para mi equipo."
  ].join("\n");
}
function downloadCsv(kind="full"){
  if(!latest)return;
  const csv=kind==="queue"?exportActionQueueCsv(latest):exportResultCsv(latest);
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const href=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=href;
  anchor.download="revops-"+(kind==="queue"?"cola-preparada":"simulacion")+"-"+scenario+".csv";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(href),1000);
  setText("workflowStatus",kind==="queue"?"Cola de acciones preparada en CSV. Son propuestas, no ejecuciones.":"CSV exportado localmente. No se ha enviado ningún registro.");
}
async function copySummary(){
  if(!latest)return;
  try{
    await navigator.clipboard.writeText(summary());
    setText("workflowStatus","Resumen copiado. No incluye los datos de cada registro.");
  }catch{
    setText("workflowStatus","El navegador no ha permitido copiar. Puedes exportar el CSV.");
  }
}
$("workflowSource").addEventListener("input",()=>{
  errorText("");
  closeColumnMapper();
  modifiedSource=true;
  undoSource=null;redoSource=null;
  $("undoCorrection").disabled=true;$("redoCorrection").disabled=true;
  invalidate("Has modificado las entradas. Ejecuta el proceso para actualizar los resultados.");
  renderEmpty();
});
$("runWorkflow").addEventListener("click",()=>{
  closeColumnMapper();
  try{
    const result=runWorkflow(scenario,$("workflowSource").value);
    errorText("");
    render(result);
    $("changeComparison").hidden=true;
  }catch(error){
    invalidate("Revisa el formato de entrada antes de ejecutar.");
    renderEmpty();
    errorText(error?.message||"No se pudo leer el CSV.");
  }
});
function closeEditor(restoreFocus=false){
  const form=$("workflowEditForm");
  if(form)form.hidden=true;
  editIndex=null;editPreview=null;editorDirty=false;
  setText("workflowEditStatus","");
  if(restoreFocus){
    const focus=editorTrigger?.isConnected && !editorTrigger.closest("[hidden]")?editorTrigger:$("fixFirstIssue");
    focus?.focus();
  }
  editorTrigger=null;
}
function syncFilterButtons(){
  document.querySelectorAll("[data-workflow-filter]").forEach(button=>{
    const active=button.dataset.workflowFilter===activeFilter;
    button.setAttribute("aria-pressed",String(active));
    button.classList.toggle("is-active",active);
  });
}
function applyFilter(){
  const all=latest?.rows.length||0;
  const counts=latest?.counts;
  const labels={all:"Todos",bloqueado:"Bloqueados",revisar:"A revisar",listo:"Listos"};
  for(const button of document.querySelectorAll("[data-workflow-filter]")){
    const status=button.dataset.workflowFilter;
    const number=status==="all"?all:(counts?.[status]||0);
    button.textContent=labels[status]+" ("+number+")";
  }
  const search=normalizeSearch($("workflowSearch").value);
  let visible=0;
  $("workflowRows").querySelectorAll(".workbench-row").forEach(tr=>{
    const match=(activeFilter==="all" || tr.dataset.status===activeFilter) &&
      (!search || tr.dataset.search.includes(search));
    tr.hidden=!match;
    if(match)visible++;
  });
  setText("workflowFilterStatus",visible+" de "+all+" registros visibles"+
    (activeFilter==="all"?"":", estado: "+activeFilter)+
    (search?", búsqueda: «"+$("workflowSearch").value.trim().slice(0,90)+"»":"")+".");
  $("workflowNoResults").hidden=!latest || visible>0;
  $("exportVisible").disabled=!latest||visible===0;
  $("workflowSearchClear").disabled=!$("workflowSearch").value;
}
function openEditor(index){
  if(!latest?.rows[index])return;
  editorTrigger=document.activeElement;
  const row=latest.rows[index];
  const affected=issueColumn(scenario,row);
  editIndex=index;
  const parent=$("workflowEditFields");
  parent.replaceChildren();
  editorDirty=false;editPreview=null;
  for(const column of latest.columns){
    const wrap=document.createElement("div");
    wrap.className="workbench-edit-field";
    const label=document.createElement("label");
    label.htmlFor="editField-"+column;
    const guide=fieldGuide(scenario,column);
    label.textContent=guide.label;
    const input=document.createElement("input");
    input.id=label.htmlFor;
    input.name=column;
    input.type="text";
    input.required=false;
    input.maxLength=400;
    input.value=row.values[column]||"";
    input.placeholder=guide.example;
    const hint=document.createElement("small");
    hint.id="help-"+column;
    hint.className="workbench-field-guide";
    hint.textContent=guide.help;
    input.setAttribute("aria-describedby",hint.id);
    if(affected===column){
      wrap.classList.add("is-problem");
      input.setAttribute("aria-invalid","true");
      const msg=document.createElement("strong");
      msg.className="workbench-field-problem";
      msg.id="editIssue-"+column;
      msg.textContent="Revisar: "+row.reason;
      input.setAttribute("aria-describedby",hint.id+" "+msg.id);
      wrap.append(msg);
    }
    if(guide.options){
      const suggestions=document.createElement("datalist");
      suggestions.id="options-"+column;
      input.setAttribute("list",suggestions.id);
      for(const value of guide.options){
        const option=document.createElement("option");
        option.value=value;suggestions.append(option);
      }
      wrap.append(suggestions);
    }
    wrap.append(label,input,hint);
    parent.append(wrap);
  }
  setText("workbench-edit-title","Corregir registro "+row.id);
  setText("workflowEditHint",row.reason+". Revisa los valores y guarda para volver a procesar todas las filas.");
  $("workflowEditForm").hidden=false;
  paintEditPreview();
  $("workflowEditForm").scrollIntoView({behavior:"instant",block:"center"});
  (parent.querySelector(".is-problem input")||parent.querySelector("input"))?.focus();
}
function commitEdit(event){
  event.preventDefault();
  if(editIndex===null || !latest)return;
  const original=$("workflowSource").value;
  try{
    const preview=previewRecordEdit(scenario,original,editIndex,currentEdits());
    if(!preview.valid)throw Error(preview.message);
    const next=preview.source;
    // No state mutation until all rules and preview validation have passed.
    if(!correctionTimeline||correctionTimeline.state().source!==original)
      correctionTimeline=createCorrectionTimeline(scenario,original);
    correctionTimeline.push(preview);
    $("workflowSource").value=next;
    modifiedSource=true;
    errorText("");
    const result=runWorkflow(scenario,next);
    const originalResult=latest;
    const before=analyzeWorkflow(originalResult),after=analyzeWorkflow(result);
    undoSource=null;redoSource=null;
    closeEditor();
    render(result);
    const compare=$("changeComparison");
    compare.textContent="CAMBIO COMPROBADO · Antes: "+before.actionable+" acciones preparadas, "+
      before.blockedCount+" bloqueos, "+before.reviewCount+" revisiones. Después: "+
      after.actionable+" acciones preparadas, "+after.blockedCount+" bloqueos, "+
      after.reviewCount+" revisiones. La diferencia proviene de volver a ejecutar las reglas.";
    compare.hidden=false;
    guide?.complete(originalResult,result);
    setText("workflowStatus","Corrección aplicada y proceso recalculado. Puedes deshacerla. "+result.counts.bloqueado+" registros siguen bloqueados.");
  }catch(error){
    setText("workflowEditStatus",error?.message||"No se ha podido guardar la corrección.");
  }
}
$("workflowRows").addEventListener("click",event=>{
  const trigger=event.target.closest("[data-edit-index]");
  if(!trigger)return;
  openEditor(Number(trigger.dataset.editIndex));
});
$("insightsSteps").addEventListener("click",event=>{
  const button=event.target.closest("[data-insights-filter]");
  if(button)changeResultsFilter(button.dataset.insightsFilter);
});
$("workflowSearch").addEventListener("input",()=>{closeEditor();applyFilter();});
$("workflowSearchClear").addEventListener("click",()=>{
  $("workflowSearch").value="";applyFilter();$("workflowSearch").focus();
});
$("resetResultsView").addEventListener("click",()=>changeResultsFilter("all"));
$("fixFirstIssue").addEventListener("click",firstBlocked);
$("quickDemoAction").addEventListener("click",firstBlocked);
$("workflowEditForm").addEventListener("submit",commitEdit);
for(const id of ["cancelWorkflowEdit","cancelWorkflowEditSecondary"]){
  $(id).addEventListener("click",()=>closeEditor(true));
}
document.querySelectorAll("[data-workflow-filter]").forEach(button=>button.addEventListener("click",()=>{
  activeFilter=button.dataset.workflowFilter;
  syncFilterButtons();
  closeEditor();
  applyFilter();
}));
function restoreTimeline(snapshot,verb){
  if(!snapshot)return;
  const next=snapshot.source;
  const result=runWorkflow(scenario,next);
  closeEditor();$("workflowSource").value=next;
  modifiedSource=true;
  render(result);$("changeComparison").hidden=true;
  if(guide?.state().mode==="simple")guide.transition("result",false);
  setText("workflowStatus",verb+". Historial y resultados recalculados, sin acciones externas.");
}
$("undoCorrection").addEventListener("click",()=>restoreTimeline(correctionTimeline?.undo(),"Corrección deshecha"));
$("redoCorrection").addEventListener("click",()=>restoreTimeline(correctionTimeline?.redo(),"Corrección rehecha"));
$("correctionHistorySteps").addEventListener("click",event=>{
  const button=event.target.closest("button[data-history-index]");
  if(!button||!correctionTimeline)return;
  const index=Number(button.dataset.historyIndex);
  if(!Number.isInteger(index))return;
  try{restoreTimeline(correctionTimeline.jump(index),"Estado del historial restaurado");}
  catch(error){errorText(error?.message||"No se pudo restaurar el historial.");}
});
$("workflowEditFields").addEventListener("input",()=>paintEditPreview());
$("editNextIssue").addEventListener("click",()=>{
  if(!latest||editIndex===null)return;
  if(editorDirty){
    setText("editDirtyStatus","Primero guarda o cancela los cambios. No se ha perdido ningún dato.");
    return;
  }
  const next=nextBlockedIndex(latest,editIndex);
  if(next===null){
    setText("editDirtyStatus","No hay más registros bloqueados.");
    return;
  }
  openEditor(next);
});
$("importWorkflow").addEventListener("change",async event=>{
  const input=event.currentTarget;
  const file=input.files?.[0];
  if(!file)return;
  const selectedScenario=scenario;
  const previous=$("workflowSource").value;
  closeColumnMapper();
  try{
    if(!/\.(csv|tsv|txt)$/i.test(file.name))throw Error("Selecciona un archivo CSV, TSV o TXT.");
    if(file.size>32000)throw Error("Archivo demasiado grande. Límite de 32 KB.");
    const bytes=new Uint8Array(await file.arrayBuffer());
    if(selectedScenario!==scenario)throw Error("El escenario cambió durante la lectura. Selecciona el archivo de nuevo.");
    const text=decodeImportBytes(bytes);
    const check=inspectImport(scenario,text);
    auditImport(check);
    if(check.ambiguousLines.length)throw Error("Importe ambiguo en las filas "+check.ambiguousLines.join(", ")+". Corrige sus separadores y vuelve a importar.");
    // Inspect schema first; no file replaces the current work before validation.
    const suggestion=suggestMapping(scenario,text);
    if(suggestion.unassigned.length || suggestion.ignored.length ||
       suggestion.columns.some(name=>suggestion.matches[name]!=="exacta")){
      openColumnMapper(text);
      errorText(suggestion.unassigned.length?
        "Relaciona las columnas que faltan antes de ejecutar. No se han modificado tus datos.":
        "");
    }else{
      ensureImportReady(check);
      const result=runWorkflow(scenario,text);
      $("workflowSource").value=text;
      modifiedSource=true;
      closeColumnMapper();
      undoSource=null;redoSource=null;
      $("undoCorrection").disabled=true;$("redoCorrection").disabled=true;
      errorText("");
      baseline=null;
      render(result);
      setText("workflowStatus","Archivo leído localmente ("+result.counts.total+" filas). Revisa y corrige registros sin salir de esta pantalla.");
    }
  }catch(error){
    $("workflowSource").value=previous;
    errorText(error?.message||"No se pudo leer el archivo.");
  }finally{input.value="";}
});

$("openColumnMapper").addEventListener("click",()=>{
  try{
    openColumnMapper($("workflowSource").value);
    errorText("");
  }catch(error){errorText(error?.message||"No se pudo leer la tabla.");}
});
for(const id of ["cancelColumnMapper","cancelColumnMapping"]){
  $(id).addEventListener("click",()=>{
    closeColumnMapper();
    errorText("");
  });
}
$("applyColumnMapping").addEventListener("click",()=>{
  if(mappingSource===null || mappingScenario!==scenario)return;
  const mapping=currentMapping();
  try{
    const validation=inspectImport(scenario,mappingSource,mapping);
    auditImport(validation);
    ensureImportReady(validation,$("confirmDiscardColumns").checked);
    const converted=normalizeMappedCsv(scenario,mappingSource,mapping);
    const result=runWorkflow(scenario,converted);
    $("workflowSource").value=converted;
    modifiedSource=true;
    undoSource=null;redoSource=null;
    $("undoCorrection").disabled=true;$("redoCorrection").disabled=true;
    closeColumnMapper();
    baseline=null;
    render(result);
    $("changeComparison").hidden=true;
    errorText("");
    setText("workflowStatus","Correspondencias confirmadas. "+result.counts.total+
      " registros analizados localmente. Edita errores en la tabla; no se ha enviado nada.");
  }catch(error){
    mappingStatus(error?.message||"No se puede aplicar el mapeo.",true);
  }
});
$("confirmDiscardColumns").addEventListener("change",()=>renderMappingPreview());
$("exportMappingProfile").addEventListener("click",()=>{
  try{
    if(mappingSource===null)return;
    const profile=makeMappingProfile(scenario,currentMapping());
    downloadMappingFile("revops-perfil-columnas-"+scenario+".json",profile);
    setText("mappingProfileStatus","Perfil descargado: solo escenario y correspondencias, nunca filas.");
  }catch(error){setText("mappingProfileStatus",error?.message||"No se puede exportar el perfil.");}
});
$("importMappingProfile").addEventListener("change",async event=>{
  const input=event.currentTarget;
  const file=input.files?.[0];
  if(!file||mappingSource===null)return;
  const selectedScenario=scenario;
  try{
    if(file.size>3000||!file.name.toLowerCase().endsWith(".json"))throw Error("Elige un perfil JSON de máximo 3 KB.");
    const profile=readMappingProfile(await file.text(),scenario,suggestMapping(scenario,mappingSource).sourceHeaders);
    if(selectedScenario!==scenario||mappingSource===null)throw Error("El escenario cambió durante la lectura del perfil.");
    for(const select of $("columnMappingRows").querySelectorAll("select"))select.value=profile[select.dataset.target];
    $("confirmDiscardColumns").checked=false;
    setText("mappingProfileStatus","Perfil cargado en la vista previa. Revisa y confirma antes de aplicar.");
    renderMappingPreview();
  }catch(error){setText("mappingProfileStatus",error?.message||"Perfil inválido.");}
  finally{input.value="";}
});
$("columnMappingRows").addEventListener("change",event=>{
  if(event.target.matches("select"))renderMappingPreview();
});

$("workflowRecipe").addEventListener("change",()=>{
  setText("recipeHint",RECIPE_LABELS[$("workflowRecipe").value]?.description||"");
});
$("loadWorkflowRecipe").addEventListener("click",loadWorkflowExample);
$("downloadWorkflowTemplate").addEventListener("click",downloadWorkflowExample);
$("copyScenarioLink").addEventListener("click",async()=>{
  const link=location.origin+location.pathname+"?scenario="+encodeURIComponent(scenario);
  try{
    await navigator.clipboard.writeText(link);
    setText("recipeHint","Enlace copiado. Solo incluye el escenario, nunca tus filas ni datos importados.");
  }catch{
    setText("recipeHint","El navegador no permite copiar automáticamente. Comparte solo la dirección de esta demo, nunca los datos.");
  }
});
$("workflowSource").addEventListener("keydown",event=>{
  if(event.key==="Enter"&&(event.ctrlKey||event.metaKey)){
    event.preventDefault();$("runWorkflow").click();
  }
});
document.addEventListener("keydown",event=>{
  if(event.key!=="Escape")return;
  if(!$("columnMapper").hidden){
    closeColumnMapper();$("openColumnMapper").focus();
  }else if(!$("workflowEditForm").hidden){
    closeEditor(true);
  }
});
$("workflowSort").addEventListener("change",()=>{sortResults();applyFilter();});
const savedViewKey="revops-studio:p74:view-v1";
$("workbenchViewPreset").addEventListener("change",event=>{
 const preset=safeViewPreset(event.target.value);
 if(!preset)return;
 applyWorkbenchView({
  filter:preset.filter,sort:preset.sort,density:event.target.value==="compact"?"compact":"comfortable",
  reason:preset.columns.reason,action:preset.columns.action
 });
 setText("workbenchViewStatus","Vista "+event.target.selectedOptions[0].textContent+
  " aplicada localmente. La búsqueda se ha limpiado sin guardar su contenido.");
});
$("workbenchDensity").addEventListener("change",applyWorkbenchPresentation);
for(const name of ["workbenchShowReason","workbenchShowAction"])
 $(name).addEventListener("change",applyWorkbenchPresentation);
$("workbenchSaveView").addEventListener("click",()=>{
 try{
  // Explicit opt-in. Exact whitelisted keys only: never store the search or any row.
  sessionStorage.setItem(savedViewKey,JSON.stringify(readWorkbenchView()));
  setText("workbenchViewStatus","Preferencias de vista guardadas en esta sesión, sin búsqueda ni datos.");
 }catch{setText("workbenchViewStatus","El navegador impide el almacenamiento: la vista sigue activa solo en memoria.");}
});
$("workbenchRestoreView").addEventListener("click",()=>{
 try{
  const raw=sessionStorage.getItem(savedViewKey);
  if(!raw){setText("workbenchViewStatus","No hay ninguna vista guardada.");return;}
  if(raw.length>240||!applyWorkbenchView(JSON.parse(raw)))throw Error("La vista guardada no es válida.");
  setText("workbenchViewStatus","Vista restaurada, sin búsquedas ni valores personales.");
 }catch{setText("workbenchViewStatus","No se puede restaurar esta configuración.");}
});
$("workbenchClearView").addEventListener("click",()=>{
 try{sessionStorage.removeItem(savedViewKey);}catch{}
 setText("workbenchViewStatus","Configuración guardada borrada. Los registros no se almacenaban allí.");
});
document.addEventListener("keydown",event=>{
 const el=document.activeElement;
 const editing=el?.matches("input,textarea,select,[contenteditable]")||el?.closest("[contenteditable]");
 if(editing||!(event.ctrlKey||event.metaKey)||event.altKey)return;
 if(event.key.toLowerCase()==="z"){
  event.preventDefault();
  if(event.shiftKey)$("redoCorrection").click();
  else $("undoCorrection").click();
 }else if(event.key.toLowerCase()==="y"){
  event.preventDefault();$("redoCorrection").click();
 }
});

$("cancelScenarioDiscard").addEventListener("click",()=>{
  pendingScenario=null;
  $("scenarioDiscard").hidden=true;
  document.querySelector('[data-scenario="'+scenario+'"]')?.focus();
});
$("confirmScenarioDiscard").addEventListener("click",()=>{
  if(pendingScenario){const destination=pendingScenario;chooseScenario(destination,true);}
});
$("resetWorkflow").addEventListener("click",()=>chooseScenario(scenario,true));
$("exportWorkflow").addEventListener("click",()=>downloadCsv("full"));
$("exportActionQueue").addEventListener("click",()=>downloadCsv("queue"));
$("exportVisible").addEventListener("click",()=>{
  if(!latest)return;
  const indices=[...$("workflowRows").querySelectorAll(".workbench-row:not([hidden])")].map(tr=>Number(tr.dataset.editIndex));
  if(!indices.length)return;
  const csv=exportVisibleRowsCsv(latest,indices);
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const href=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=href;link.download="revops-vista-"+scenario+".csv";
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(href),1000);
  setText("workflowStatus","Exportadas "+indices.length+" filas visibles en su orden actual. Incluye valores de esas filas; no se han enviado.");
});
$("r2Export").addEventListener("click",()=>{
  if(!evidence?.comparable)return;
  const text=comparisonReport(evidence);
  const uri=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));
  const link=document.createElement("a");
  link.href=uri;link.download="revops-comparativa-r2-"+scenario+".txt";
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(uri),1000);
  setText("workflowStatus","Comparativa R2 descargada. Sin filas, contactos ni ejecución externa.");
});
$("privacyInspect").addEventListener("click",()=>{
 if(!latest)return;
 const exposure=inspectDataExposure(latest);
 setText("privacyRiskStatus",
  "Auditoría local: "+exposure.records+" registros, "+exposure.cells+" celdas. "+
  "Emails detectados: "+exposure.emails+"; fuera de dominios de prueba: "+exposure.nonExampleEmails+
  ". Fórmulas potenciales: "+exposure.formulaLike+
  ". Controles invisibles: "+exposure.controlCells+
  ". Textos extensos: "+exposure.longCells+
  ". Revisiones humanas: "+exposure.manualReview+
  ". Sin envío, sin telemetría. Los CSV completos o visibles sí incluyen valores; evita compartirlos sin revisarlos.");
});
const privacyConfirm=$("privacyClearConfirm");
function cancelPrivacyClear(){
 privacyConfirm.hidden=true;
 $("privacyClearOpen").setAttribute("aria-expanded","false");
 $("privacyClearOpen").focus();
}
$("privacyClearOpen").setAttribute("aria-controls","privacyClearConfirm");
$("privacyClearOpen").setAttribute("aria-expanded","false");
$("privacyClearOpen").addEventListener("click",()=>{
 privacyConfirm.hidden=false;
 $("privacyClearOpen").setAttribute("aria-expanded","true");
 $("privacyClearTitle").focus({preventScroll:true});
 privacyConfirm.scrollIntoView({block:"nearest",behavior:"instant"});
});
$("privacyClearCancel").addEventListener("click",cancelPrivacyClear);
privacyConfirm.addEventListener("keydown",event=>{
 if(event.key==="Escape"){
  event.preventDefault();event.stopPropagation();cancelPrivacyClear();return;
 }
 if(event.key!=="Tab")return;
 const a=$("privacyClearCancel"),b=$("privacyClearConfirmButton"),focused=document.activeElement;
 if(event.shiftKey && (focused===a || !privacyConfirm.contains(focused))){
  event.preventDefault();b.focus();
 }else if(!event.shiftKey && focused===b){
  event.preventDefault();a.focus();
 }
});
$("privacyClearConfirmButton").addEventListener("click",()=>{
 let store=null;
 try{store=sessionStorage;}catch{}
 const summary=clearRevopsSession(store);
 decisionConsole?.clear?.();candidateConsole?.clear?.();reportConsole?.clear?.();pilotConsole?.clear?.();pilotPlanConsole?.clear?.();
 $("importAuditFindings").replaceChildren();
 setText("importAuditTitle","Sin importación pendiente");
 setText("importAuditSummary","Historial de importaciones de esta demo limpiado.");
 setText("columnMappingIgnored","");
 setText("mappingProfileStatus","");
 setText("humanReviewFeedback","");
 setText("humanReviewState","");
 setText("candidateTemplateStatus","");
 setText("candidateDelta","");
 setText("reportStatus","");
 $("workflowSearch").value="";
 chooseScenario(scenario,true);
 $("runWorkflow").click();
 privacyConfirm.hidden=true;
 $("privacyClearOpen").setAttribute("aria-expanded","false");
 $("privacyClearOpen").focus();
 setText("privacyClearStatus","Datos y anotaciones locales descartados. "+
  (summary.unavailable?"El navegador impidió verificar todas las preferencias de sesión.":
   "Preferencias de RevOps eliminadas ("+summary.cleared+" claves).")+
  " Los ejemplos ficticios se han restaurado. Las descargas anteriores y el portapapeles no pueden revocarse.");
 announceWorkbench("Sesión de trabajo limpiada; ejemplos ficticios restaurados.");
});
$("pilotPlanOpen").addEventListener("click",async()=>{
 if(!latest)return;
 try{
  if(pilotPlanConsole)pilotPlanConsole.sync();
  else{
   const module=await import("./pilot-plan-console.js");
   if(!latest)return;
   pilotPlanConsole=module.mountPilotPlanConsole({
    getState:()=>latest?{scenario,source:$("workflowSource").value,result:latest}:null,
    onReview:()=>$("pilotOpen").click()
   });
  }
  $("pilotPlanStudio").scrollIntoView({block:"start",behavior:"instant"});
  focusHeading(document,"pilotPlanStudio","pilotPlanStudioTitle");
 }catch(error){errorText("No se pudo crear el plan supervisado: "+(error?.message||"entrada inválida"));}
});
$("pilotOpen").addEventListener("click",async()=>{
 if(!latest)return;
 try{
  if(pilotConsole)pilotConsole.sync();
  else{
   const module=await import("./pilot-console.js");
   if(!latest)return;
   pilotConsole=module.mountPilotConsole({
    getState:()=>latest?{
     scenario,source:$("workflowSource").value,result:latest
    }:null,
    onRemediate:action=>{
     if(action==="blockers"){
      firstBlocked();
     }else if(action==="human"){
      $("rulesOpen").click();
     }else if(action==="privacy"){
      $("privacyInspect").click();
      $("privacyBoundary").scrollIntoView({block:"start",behavior:"instant"});
      $("privacyInspect").focus({preventScroll:true});
     }else if(action==="report"){
      $("reportOpen").click();
     }else if(action==="result"){
      const title=$("workbench-table-title");
      title.tabIndex=-1;title.focus({preventScroll:true});
      title.scrollIntoView({block:"start",behavior:"instant"});
     }
    }
   });
  }
  $("pilotStudio").scrollIntoView({block:"start",behavior:"instant"});
  focusHeading(document,"pilotStudio","pilotStudioTitle");
 }catch(error){errorText("No se pudo evaluar la preparación del piloto: "+(error?.message||"error inesperado"));}
});
$("reportOpen").addEventListener("click",async()=>{
 if(!latest)return;
 try{
  if(reportConsole)reportConsole.sync();
  else{
   const module=await import("./report-console.js");
   if(!latest)return;
   reportConsole=module.mountExecutiveReporting({
    getState:()=>latest?{
      scenario,source:$("workflowSource").value,result:latest,quality:qualityCurrent,
      comparison:evidence,
      reviewSummary:decisionConsole?.reviewSummary?.(scenario,$("workflowSource").value)||null,
      candidate:candidateConsole?.candidateSummary?.(scenario,$("workflowSource").value)||null
    }:null
   });
  }
  $("reportStudio").scrollIntoView({behavior:"instant",block:"start"});
  focusHeading(document,"reportStudio","reportStudioTitle");
 }catch(error){errorText("No se pudo preparar el informe ejecutivo: "+(error?.message||"error inesperado"));}
});
$("candidateOpen").addEventListener("click",async()=>{
 if(!latest)return;
 try{
  if(candidateConsole)candidateConsole.sync();
  else{
   const module=await import("./scenario-console.js");
   if(!latest)return;
   candidateConsole=module.mountCandidateStudio({
    getState:()=>latest?{scenario,source:$("workflowSource").value,result:latest}:null
   });
  }
  $("candidateStudio").scrollIntoView({behavior:"instant",block:"start"});
  focusHeading(document,"candidateStudio","candidateStudioTitle");
 }catch(error){
  errorText("No se pudo abrir Scenario Builder: "+(error?.message||"error desconocido"));
 }
});
$("rulesOpen").addEventListener("click",async()=>{
  if(!latest)return;
  try{
    if(decisionConsole){
      decisionConsole.sync(scenario,$("workflowSource").value,latest);
    }else{
      // Audit UI and its rule history load only on demand.
      const module=await import("./decision-console.js");
      if(!latest)return;
      decisionConsole=module.mountDecisionConsole({
        getState:()=>latest?{scenario,source:$("workflowSource").value,result:latest}:null,
        openEditor:index=>openEditor(index)
      });
    }
    $("rulesStudio").scrollIntoView({behavior:"instant",block:"start"});
    focusHeading(document,"rulesStudio","rulesStudioTitle");
  }catch(error){
    errorText("No se pudo abrir la auditoría de reglas: "+(error?.message||"error desconocido"));
  }
});
$("qualityCockpit").addEventListener("click",event=>{
  const button=event.target.closest("[data-quality-index]");
  if(!button||!latest)return;
  const index=Number(button.dataset.qualityIndex);
  if(!Number.isInteger(index)||index<0||index>=latest.rows.length)return;
  openEditor(index);
});
$("qualityExport").addEventListener("click",()=>{
  if(!qualityCurrent||!qualityEvidence)return;
  const report=qualityCockpitReport(qualityCurrent,qualityEvidence);
  const href=URL.createObjectURL(new Blob([report],{type:"text/plain;charset=utf-8"}));
  const link=document.createElement("a");link.href=href;
  link.download="revops-calidad-pr73-"+scenario+".txt";
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(href),3000);
  setText("workflowStatus","Informe agregado de calidad descargado. Sin filas, IDs, contactos ni envío externo.");
});
$("exportInsights").addEventListener("click",()=>{
  if(!latest)return;
  const report=insightsReport(latest,SCENARIOS[scenario].title);
  const blob=new Blob([report],{type:"text/plain;charset=utf-8"});
  const href=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=href;
  link.download="revops-informe-orientativo-"+scenario+".txt";
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(href),1000);
  setText("workflowStatus","Informe de simulación descargado. Solo incluye totales y motivos generales, no filas, emails ni clientes.");
});
$("copyWorkflow").addEventListener("click",copySummary);
buttons.forEach(button=>button.addEventListener("click",()=>chooseScenario(button.dataset.scenario)));
$("demoContact").addEventListener("click",event=>{
  if(!latest){event.preventDefault();$("runWorkflow").focus();return;}
  const data={service:scenario==="data"?"Datos y BI":scenario==="support"?"Software a medida":"Automatización",
    summary:summary()};
  try{
    sessionStorage.setItem(storageKey,JSON.stringify(data));
  }catch{
    // Remain functional if sessionStorage is disabled, via a mailto with no raw records.
    event.preventDefault();
    location.href="mailto:gracianbaenagonzalez@gmail.com?subject="+encodeURIComponent("RevOps Studio | Demostración "+scenario)+
      "&body="+encodeURIComponent(summary());
  }
});
// Keyboard support without trapping ordinary navigation outside the discard confirmation.
installAccessibleNavigation({
 document,
 openRow:index=>openEditor(index),
 cancelDiscard:()=>$("cancelScenarioDiscard").click(),
 closePanels:()=>{
  // Editor and mapping preserve their existing Escape/focus recovery handlers.
  if(!$("columnMapper").hidden||!$("workflowEditForm").hidden)return false;
  for(const [panel,close] of [
   ["pilotPlanStudio","pilotPlanClose"],
   ["pilotStudio","pilotClose"],
   ["reportStudio","reportClose"],
   ["candidateStudio","candidateClose"],
   ["rulesStudio","rulesClose"]
  ]){
   if(!$(panel).hidden){$(close).click();return true;}
  }
  return false;
 }
});
chooseScenario(scenario);
// Run the real engine once; guided and advanced views share one result, not two demos.
$("runWorkflow").click();
guide=createClientJourney({
  mode:initialMode,
  onMode(next){
    const params=new URLSearchParams();
    params.set("scenario",scenario);
    if(next==="simple")params.set("view","simple");
    history.replaceState(null,"",location.pathname+"?"+params.toString()+"#simulador");
  },
  onChoose(next){
    if(next!==scenario)chooseScenario(next);
    if(scenario!==next){
      $("scenarioDiscard").scrollIntoView({block:"center",behavior:"instant"});
      return false;
    }
    if(!latest)$("runWorkflow").click();
    return true;
  },
  onFix(){firstBlocked();},
  onDownload(){$("exportInsights").click();},
  onContact(){$("demoContact").click();}
});
guide.setScenario(scenario,latest);

