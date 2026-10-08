import { SCENARIOS, runWorkflow, exportResultCsv, editWorkflowRecord, exportActionQueueCsv } from "./workflow-engine.js";

const $=id=>document.getElementById(id);
const buttons=[...document.querySelectorAll("[data-scenario]")];
const storageKey="revops-studio:demo:handoff";
const allowed=Object.keys(SCENARIOS);
const query=new URLSearchParams(location.search).get("scenario");
let scenario=allowed.includes(query)?query:"orders";
let latest=null;
let activeFilter="all",editIndex=null,undoSource=null;
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
  closeEditor();
  $("demoContact").dataset.ready="false";
  setText("workflowStatus",message);
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
  undoSource=null;
  $("undoCorrection").disabled=true;
  activeFilter="all";
  syncFilterButtons();
  setText("scenarioDescription",data.intro);
  errorText("");
  invalidate("Ejemplo cargado. Ejecuta el proceso para revisar cada registro.");
  renderEmpty();
  // The deep link has only a scenario id; never put row content in the URL.
  history.replaceState(null,"",location.pathname+"?scenario="+encodeURIComponent(next)+"#simulador");
}
function renderEmpty(){
  for(const id of ["countTotal","countReady","countReview","countBlocked"])setText(id,"0");
  const rows=$("workflowRows");
  rows.replaceChildren();
  const tr=document.createElement("tr"),td=document.createElement("td");
  td.colSpan=5;td.textContent="Ejecuta el proceso para ver el detalle de cada registro.";
  setText("workflowFilterStatus","Ejecuta un escenario para filtrar y corregir los registros.");
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
  applyFilter();
  setText("workflowStatus",result.counts.total+" registros analizados. "+result.counts.listo+" listos, "+
    result.counts.revisar+" pendientes de revisión y "+result.counts.bloqueado+" bloqueados. "+
    "Ninguna acción externa ejecutada.");
  $("exportWorkflow").disabled=false;
  $("copyWorkflow").disabled=false;
  $("exportActionQueue").disabled=!result.rows.some(row=>row.status==="listo" && !/histórico/i.test(row.action));
  $("demoContact").dataset.ready="true";
}
function summary(){
  if(!latest)return "";
  const data=SCENARIOS[scenario],counts=latest.counts;
  return [
    "Escenario de simulación: "+data.title,
    "Registros analizados: "+counts.total,
    "Preparados: "+counts.listo,
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
  undoSource=null;
  $("undoCorrection").disabled=true;
  invalidate("Has modificado las entradas. Ejecuta el proceso para actualizar los resultados.");
});
$("runWorkflow").addEventListener("click",()=>{
  try{
    const result=runWorkflow(scenario,$("workflowSource").value);
    errorText("");
    render(result);
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
  let visible=0;
  $("workflowRows").querySelectorAll(".workbench-row").forEach(tr=>{
    const match=activeFilter==="all" || tr.dataset.status===activeFilter;
    tr.hidden=!match;
    if(match)visible++;
  });
  setText("workflowFilterStatus",visible+" de "+all+" registros visibles"+(activeFilter==="all"?"":", filtro: "+activeFilter)+". Puedes editar cualquiera de ellos.");
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
    undoSource=original;
    $("undoCorrection").disabled=false;
    closeEditor();
    render(result);
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
  try{render(runWorkflow(scenario,$("workflowSource").value));}
  catch{invalidate("No se pudo restaurar el estado previo.");}
});
$("importWorkflow").addEventListener("change",async event=>{
  const input=event.currentTarget;
  const file=input.files?.[0];
  if(!file)return;
  const selectedScenario=scenario;
  const previous=$("workflowSource").value;
  try{
    if(!/\.(csv|txt)$/i.test(file.name))throw Error("Selecciona un archivo CSV o TXT.");
    if(file.size>32000)throw Error("Archivo demasiado grande. Límite de 32 KB.");
    const text=await file.text();
    if(selectedScenario!==scenario)throw Error("El escenario cambió durante la lectura. Selecciona el archivo de nuevo.");
    // Validate before changing the input. Never transmit or persist imported rows.
    const result=runWorkflow(scenario,text);
    $("workflowSource").value=text;
    undoSource=null;
    $("undoCorrection").disabled=true;
    errorText("");
    render(result);
    setText("workflowStatus","Archivo leído localmente ("+result.counts.total+" filas). Revisa y corrige registros sin salir de esta pantalla.");
  }catch(error){
    $("workflowSource").value=previous;
    errorText(error?.message||"No se pudo leer el archivo.");
  }finally{input.value="";}
});

$("resetWorkflow").addEventListener("click",()=>chooseScenario(scenario));
$("exportWorkflow").addEventListener("click",()=>downloadCsv("full"));
$("exportActionQueue").addEventListener("click",()=>downloadCsv("queue"));
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
