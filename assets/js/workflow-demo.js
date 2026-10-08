import { SCENARIOS, runWorkflow, exportResultCsv, editWorkflowRecord, exportActionQueueCsv } from "./workflow-engine.js";
import { suggestMapping, normalizeMappedCsv } from "./column-mapper.js";
import { analyzeWorkflow, insightsReport } from "./workflow-insights.js";

const $=id=>document.getElementById(id);
const buttons=[...document.querySelectorAll("[data-scenario]")];
const storageKey="revops-studio:demo:handoff";
const allowed=Object.keys(SCENARIOS);
const query=new URLSearchParams(location.search).get("scenario");
let scenario=allowed.includes(query)?query:"orders";
let latest=null;
let activeFilter="all",editIndex=null,undoSource=null;
let mappingSource=null,mappingScenario=null;
function setText(id,text){const element=$(id);if(element)element.textContent=String(text);}
function errorText(message){
  const element=$("workflowError");
  if(!element)return;
  element.hidden=!message;
  element.textContent=message||"";
}
function invalidate(message){
  latest=null;
  $("exportWorkflow").disabled=true;
  $("copyWorkflow").disabled=true;
  $("exportActionQueue").disabled=true;
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
  setText("columnMappingIgnored","Columnas adicionales que no se usarán: "+other+". Las originales se conservarán hasta confirmar.");
  $("columnMapper").hidden=false;
  renderMappingPreview();
  $("columnMapper").scrollIntoView({block:"nearest",behavior:"instant"});
}
function chooseScenario(next){
  if(!SCENARIOS[next])return;
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
  undoSource=null;
  $("undoCorrection").disabled=true;
  activeFilter="all";
  $("workflowSearch").value="";
  syncFilterButtons();
  setText("scenarioDescription",data.intro);
  errorText("");
  invalidate("Ejemplo cargado. Ejecuta el proceso para revisar cada registro.");
  renderEmpty();
  // The deep link has only a scenario id; never put row content in the URL.
  history.replaceState(null,"",location.pathname+"?scenario="+encodeURIComponent(next)+"#simulador");
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
function renderEmpty(){
  for(const id of ["countTotal","countReady","countReview","countBlocked"])setText(id,"0");
  const rows=$("workflowRows");
  rows.replaceChildren();
  const tr=document.createElement("tr"),td=document.createElement("td");
  td.colSpan=5;td.textContent="Ejecuta el proceso para ver el detalle de cada registro.";
  setText("workflowFilterStatus","Ejecuta un escenario para filtrar y corregir los registros.");
  $("workflowNoResults").hidden=true;
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
function render(result){
  latest=result;
  setText("countTotal",result.counts.total);
  setText("countReady",result.counts.listo);
  setText("countReview",result.counts.revisar);
  setText("countBlocked",result.counts.bloqueado);
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
    cell(tr,row.id);
    const status=cell(tr,"");
    const label=document.createElement("span");
    label.className="workbench-result-pill";
    label.dataset.state=row.status;
    label.textContent=row.status;
    status.append(label);
    cell(tr,row.reason);
    cell(tr,row.action);
    tr.className="workbench-row";
    tr.dataset.status=row.status;
    tr.dataset.search=normalizeSearch([row.id,row.reason,row.action].join(" "));
    const edit=cell(tr,"");
    const trigger=document.createElement("button");
    trigger.type="button";
    trigger.className="workbench-row-edit";
    trigger.dataset.editIndex=String(index);
    trigger.setAttribute("aria-label","Editar registro "+row.id);
    trigger.textContent="Editar ↗";
    edit.append(trigger);
    frag.append(tr);
  }
  body.replaceChildren(frag);
  renderInsights(result);
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
  undoSource=null;
  $("undoCorrection").disabled=true;
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
function closeEditor(){
  const form=$("workflowEditForm");
  if(form)form.hidden=true;
  editIndex=null;
  setText("workflowEditStatus","");
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
  $("workflowSearchClear").disabled=!$("workflowSearch").value;
}
function openEditor(index){
  if(!latest?.rows[index])return;
  const row=latest.rows[index];
  editIndex=index;
  const parent=$("workflowEditFields");
  parent.replaceChildren();
  for(const column of latest.columns){
    const wrap=document.createElement("div");
    wrap.className="workbench-edit-field";
    const label=document.createElement("label");
    label.htmlFor="editField-"+column;
    label.textContent=column;
    const input=document.createElement("input");
    input.id=label.htmlFor;
    input.name=column;
    input.type="text";
    input.required=false;
    input.maxLength=400;
    input.value=row.values[column]||"";
    wrap.append(label,input);
    parent.append(wrap);
  }
  setText("workbench-edit-title","Corregir registro "+row.id);
  setText("workflowEditHint",row.reason+". Revisa los valores y guarda para volver a procesar todas las filas.");
  $("workflowEditForm").hidden=false;
  $("workflowEditForm").scrollIntoView({behavior:"instant",block:"center"});
  parent.querySelector("input")?.focus();
}
function commitEdit(event){
  event.preventDefault();
  if(editIndex===null || !latest)return;
  const inputs=[...$("workflowEditFields").querySelectorAll("input")];
  const changes=Object.fromEntries(inputs.map(input=>[input.name,input.value]));
  const original=$("workflowSource").value;
  try{
    const next=editWorkflowRecord(scenario,original,editIndex,changes);
    $("workflowSource").value=next;
    errorText("");
    const result=runWorkflow(scenario,next);
    const before=analyzeWorkflow(latest),after=analyzeWorkflow(result);
    undoSource=original;
    $("undoCorrection").disabled=false;
    closeEditor();
    render(result);
    const compare=$("changeComparison");
    compare.textContent="CAMBIO COMPROBADO · Antes: "+before.actionable+" acciones preparadas, "+
      before.blockedCount+" bloqueos, "+before.reviewCount+" revisiones. Después: "+
      after.actionable+" acciones preparadas, "+after.blockedCount+" bloqueos, "+
      after.reviewCount+" revisiones. La diferencia proviene de volver a ejecutar las reglas.";
    compare.hidden=false;
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
  $(id).addEventListener("click",closeEditor);
}
document.querySelectorAll("[data-workflow-filter]").forEach(button=>button.addEventListener("click",()=>{
  activeFilter=button.dataset.workflowFilter;
  syncFilterButtons();
  closeEditor();
  applyFilter();
}));
$("undoCorrection").addEventListener("click",()=>{
  if(undoSource===null)return;
  $("workflowSource").value=undoSource;
  undoSource=null;
  $("undoCorrection").disabled=true;
  closeEditor();
  try{render(runWorkflow(scenario,$("workflowSource").value));$("changeComparison").hidden=true;}
  catch{invalidate("No se pudo restaurar el estado previo.");}
});
$("importWorkflow").addEventListener("change",async event=>{
  const input=event.currentTarget;
  const file=input.files?.[0];
  if(!file)return;
  const selectedScenario=scenario;
  const previous=$("workflowSource").value;
  closeColumnMapper();
  try{
    if(!/\.(csv|txt)$/i.test(file.name))throw Error("Selecciona un archivo CSV o TXT.");
    if(file.size>32000)throw Error("Archivo demasiado grande. Límite de 32 KB.");
    const text=await file.text();
    if(selectedScenario!==scenario)throw Error("El escenario cambió durante la lectura. Selecciona el archivo de nuevo.");
    // A valid file may use entirely different headers. Preview/confirm mapping
    // before changing any existing input; exact headers remain one-click.
    const suggestion=suggestMapping(scenario,text);
    if(suggestion.unassigned.length || suggestion.ignored.length ||
       suggestion.columns.some(name=>suggestion.matches[name]!=="exacta")){
      openColumnMapper(text);
      errorText(suggestion.unassigned.length?
        "Relaciona las columnas que faltan antes de ejecutar. No se han modificado tus datos.":
        "");
    }else{
      const result=runWorkflow(scenario,text);
      $("workflowSource").value=text;
      closeColumnMapper();
      undoSource=null;
      $("undoCorrection").disabled=true;
      errorText("");
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
  const mapping=Object.fromEntries([...$("columnMappingRows").querySelectorAll("select")].map(select=>
    [select.dataset.target,select.value]));
  try{
    const converted=normalizeMappedCsv(scenario,mappingSource,mapping);
    const result=runWorkflow(scenario,converted);
    $("workflowSource").value=converted;
    undoSource=null;
    $("undoCorrection").disabled=true;
    closeColumnMapper();
    render(result);
    $("changeComparison").hidden=true;
    errorText("");
    setText("workflowStatus","Correspondencias confirmadas. "+result.counts.total+
      " registros analizados localmente. Edita errores en la tabla; no se ha enviado nada.");
  }catch(error){
    mappingStatus(error?.message||"No se puede aplicar el mapeo.",true);
  }
});
$("columnMappingRows").addEventListener("change",event=>{
  if(event.target.matches("select"))renderMappingPreview();
});

$("resetWorkflow").addEventListener("click",()=>chooseScenario(scenario));
$("exportWorkflow").addEventListener("click",()=>downloadCsv("full"));
$("exportActionQueue").addEventListener("click",()=>downloadCsv("queue"));
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
chooseScenario(scenario);
// Show actual results from example records on first view, not a static decorative mockup.
$("runWorkflow").click();
