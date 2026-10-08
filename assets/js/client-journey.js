import {analyzeWorkflow} from "./workflow-insights.js";
import {issueColumn,fieldGuide} from "./workflow-product-kit.js";

// Four real user tasks, all deriving their numbers from the workflow engine.
// No fake animations, no saved personal data, no remote requests.
const QUESTIONS=Object.freeze({
  orders:{label:"pedidos",problem:"pedidos repetidos",action:"Ver qué pasa con estos pedidos ↗"},
  support:{label:"tickets",problem:"incidencias pendientes",action:"Ver qué pasa con estos tickets ↗"},
  data:{label:"registros",problem:"datos que no cuadran",action:"Ver qué pasa con estos datos ↗"}
});
const TITLE=Object.freeze({
  problem:"Empecemos con un problema de tu día a día.",
  result:"Estos son los problemas que hemos encontrado.",
  fix:"Prueba una corrección. No necesitas tocar el archivo.",
  finished:"Has visto cómo cambia el resultado."
});
const STEP=Object.freeze({problem:0,result:1,fix:2,finished:3});
export function createClientJourney({mode,onMode,onChoose,onFix,onDownload,onContact}){
  if(!["simple","advanced"].includes(mode))throw Error("Modo de visita no válido.");
  const $=id=>document.getElementById(id);
  let currentMode=mode,stage="problem",scenario="orders",result=null,comparison=null;
  const panel=$("clientJourney"),primary=$("clientPrimaryAction"),secondary=$("clientSecondaryAction"),
    contact=$("clientContactAction"),switcher=$("experienceToggle");
  const state=()=>({mode:currentMode,stage,scenario});
  const focus=()=>{
    const title=$("clientStepTitle");
    title.setAttribute("tabindex","-1");title.focus({preventScroll:true});
  };
  function summary(){
    if(!result)return {total:0,blockedCount:0,reviewCount:0,actionable:0};
    return analyzeWorkflow(result);
  }
  function refresh(){
    document.body.dataset.experience=currentMode;
    document.body.dataset.guideStage=stage;
    panel.hidden=currentMode!=="simple";
    switcher.setAttribute("aria-pressed",String(currentMode==="advanced"));
    switcher.textContent=currentMode==="simple"?"Abrir todas las herramientas ↗":"Volver a la prueba guiada ↗";
    switcher.setAttribute("aria-label",currentMode==="simple"?"Abrir herramientas avanzadas":"Volver al recorrido sencillo");
    const scenarioText=QUESTIONS[scenario];
    const numbers=summary();
    document.querySelectorAll("[data-client-problem]").forEach(button=>{
      const active=button.dataset.clientProblem===scenario;
      button.classList.toggle("is-active",active);
      button.setAttribute("aria-pressed",String(active));
    });
    document.querySelectorAll("[data-client-step]").forEach((node,index)=>{
      const current=index===STEP[stage];
      const completed=index<STEP[stage];
      if(current)node.setAttribute("aria-current","step");
      else node.removeAttribute("aria-current");
      node.classList.toggle("is-complete",completed);
    });
    $("clientStepLabel").textContent="PASO "+(STEP[stage]+1)+" DE 4";
    $("clientStepTitle").textContent=TITLE[stage];
    $("clientEvidence").hidden=stage==="problem"||!result;
    $("clientChange").hidden=stage!=="finished"||!comparison;
    contact.hidden=stage!=="finished";
    secondary.hidden=stage==="problem";
    secondary.textContent=stage==="finished"&&numbers.blockedCount?
      "Corregir otro registro ↗":"Volver al principio";
    $("clientDetected").textContent=String(numbers.blockedCount);
    $("clientAttention").textContent=String(numbers.reviewCount);
    $("clientPrepared").textContent=String(numbers.actionable);
    if(stage==="problem"){
      $("clientStepDescription").textContent="Usaremos "+(result?.counts.total||6)+" "+
        scenarioText.label+" ficticios. Pulsa el botón y verás qué se detecta, sin subir ningún archivo.";
      primary.textContent=scenarioText.action;
    }else if(stage==="result"){
      $("clientStepDescription").textContent="En este ejemplo hay "+numbers.blockedCount+" "+
        scenarioText.label+" que no pueden avanzar, "+numbers.reviewCount+
        " para decidir con una persona y "+numbers.actionable+
        " acciones que se podrían preparar. Son cifras del ejemplo, no ahorros de tu empresa.";
      primary.textContent=numbers.blockedCount?"Quiero corregir uno de estos errores ↗":
        "Abrir herramientas para probar otros datos ↗";
    }else if(stage==="fix"){
      const failing=result?.rows.find(row=>row.status==="bloqueado");
      const column=failing?issueColumn(scenario,failing):null;
      const label=column?fieldGuide(scenario,column).label.toLowerCase():"dato señalado";
      $("clientStepDescription").textContent=failing?
        "Este registro está detenido porque: "+failing.reason+". En el formulario de abajo aparece marcado el "+label+
        ". Cambia su valor por uno válido y pulsa «Guardar y volver a procesar».":
        "No hay bloqueos en este ejemplo. Puedes explorar otros escenarios en las herramientas completas.";
      primary.textContent="Volver a mostrar el registro ↗";
    }else{
      const before=comparison?.before,after=comparison?.after;
      $("clientStepDescription").textContent=before&&after?
        "Antes había "+before.blockedCount+" bloqueos y "+before.actionable+" acciones preparadas. Después hay "+
        after.blockedCount+" bloqueos y "+after.actionable+
        " acciones preparadas. Esto demuestra cómo cambian las reglas con los datos de prueba, no una mejora real en tu empresa.":
        "La herramienta ha vuelto a analizar el ejemplo y ha actualizado las conclusiones.";
      $("clientChange").textContent=numbers.blockedCount?
        "Todavía quedan "+numbers.blockedCount+" registros bloqueados. Puedes probar otra corrección.":"No quedan registros bloqueados en este ejemplo.";
      primary.textContent="Descargar explicación sin filas ni emails ↗";
    }
  }
  function transition(next,scroll=true){
    if(!Object.hasOwn(STEP,next))throw Error("Paso desconocido.");
    stage=next;
    refresh();
    if(currentMode==="simple"&&scroll){
      const target=next==="fix"?$("workflowEditForm"):panel;
      if(target && (next!=="fix"||!target.hidden)){
        target.scrollIntoView({block:"start",behavior:"instant"});
        if(next!=="fix")focus();
      }
    }
  }
  function setScenario(next,data){
    if(!QUESTIONS[next])throw Error("Escenario no reconocido.");
    scenario=next;result=data||null;comparison=null;
    transition("problem",false);
  }
  function sync(data){
    result=data;
    refresh();
  }
  function complete(before,after){
    result=after;
    comparison={before:analyzeWorkflow(before),after:analyzeWorkflow(after)};
    if(currentMode==="simple")transition("finished");
    else refresh();
  }
  function setMode(next){
    if(next!=="simple"&&next!=="advanced")return;
    currentMode=next;
    onMode(next);
    refresh();
    if(next==="simple")panel.scrollIntoView({block:"start",behavior:"instant"});
  }
  switcher.addEventListener("click",()=>setMode(currentMode==="simple"?"advanced":"simple"));
  document.querySelectorAll("[data-client-problem]").forEach(button=>button.addEventListener("click",()=>{
    const next=button.dataset.clientProblem;
    const didChange=onChoose(next);
    if(didChange)setScenario(next,null);
  }));
  primary.addEventListener("click",()=>{
    if(stage==="problem"){transition("result");return;}
    if(stage==="result"){
      if(!summary().blockedCount){setMode("advanced");return;}
      transition("fix",false);
      onFix();
      if(!$("workflowEditForm").hidden)$("workflowEditForm").scrollIntoView({block:"start",behavior:"instant"});
      return;
    }
    if(stage==="fix"){onFix();return;}
    onDownload();
  });
  secondary.addEventListener("click",()=>{
    if(stage==="finished"&&summary().blockedCount){
      transition("fix",false);onFix();
      if(!$("workflowEditForm").hidden)$("workflowEditForm").scrollIntoView({block:"start",behavior:"instant"});
    }else transition("problem");
  });
  contact.addEventListener("click",event=>{
    event.preventDefault();onContact();
  });
  refresh();
  return {state,setScenario,sync,complete,setMode,transition};
}
