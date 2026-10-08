import { SCENARIOS, runWorkflow, exportResultCsv } from "./workflow-engine.js";

const $=id=>document.getElementById(id);
const buttons=[...document.querySelectorAll("[data-scenario]")];
const storageKey="revops-studio:demo:handoff";
const allowed=Object.keys(SCENARIOS);
const query=new URLSearchParams(location.search).get("scenario");
let scenario=allowed.includes(query)?query:"orders";
let latest=null;
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
  td.colSpan=4;td.textContent="Ejecuta el proceso para ver el detalle de cada registro.";
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
  for(const row of result.rows){
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
    frag.append(tr);
  }
  body.replaceChildren(frag);
  setText("workflowStatus",result.counts.total+" registros analizados. "+result.counts.listo+" listos, "+
    result.counts.revisar+" pendientes de revisión y "+result.counts.bloqueado+" bloqueados. "+
    "Ninguna acción externa ejecutada.");
  $("exportWorkflow").disabled=false;
  $("copyWorkflow").disabled=false;
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
function downloadCsv(){
  if(!latest)return;
  const csv=exportResultCsv(latest);
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const href=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=href;
  anchor.download="revops-simulacion-"+scenario+".csv";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(href),1000);
  setText("workflowStatus","CSV exportado localmente. No se ha enviado ningún registro.");
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
$("resetWorkflow").addEventListener("click",()=>chooseScenario(scenario));
$("exportWorkflow").addEventListener("click",downloadCsv);
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
