// PR71 · lazy, local UI for deeper discovery. Nothing is transmitted automatically.
import {buildDiscoveryBrief,formatDiscoveryBrief,discoveryJson} from "./discovery-engine.js";

const ids=Object.freeze(["role","outcome","urgency","stage","owner","sample","integration","sensitivity","goal","constraint","exclusion"]);
const hint=Object.freeze({
 direction:"Perspectiva de dirección: acordar alcance, coste orientativo y criterios para aceptar el piloto.",
 operations:"Perspectiva operativa: comprobar excepciones, responsables, procedimientos y reversión.",
 analyst:"Perspectiva de datos: fijar definiciones, fuentes, líneas base y comparabilidad.",
 support:"Perspectiva de soporte: atender prioridades, evitar duplicados y escalar decisiones humanas."
});
export function mountDiscoveryStudio(){
 const $=id=>document.getElementById(id),root=$("discoveryStudio");
 if(!root)return;
 if(root.dataset.bound==="true"){
  root.hidden=false;$("diagStudioOpen").setAttribute("aria-expanded","true");
  root.scrollIntoView({block:"start",behavior:"instant"});return;
 }
 if(!$("diagProblem")?.value)return;
 root.dataset.bound="true";
 const css=document.createElement("link");
 css.rel="stylesheet";css.href="./assets/css/discovery-studio.css";
 document.head.append(css);
 const preview=$("discoveryPreview"),status=$("discoveryStatus"),actions=[
  $("discoveryCopy"),$("discoveryDownloadTxt"),$("discoveryDownloadJson"),$("discoveryAttach")
 ];
 let current=null,edited=false,stale=false,attachedValue="";
 const context=()=>({
  problem:$("diagProblem").value,tools:$("diagTools").value,scope:$("diagScope").value,
  ...Object.fromEntries(ids.map(k=>[k,$("discovery"+k[0].toUpperCase()+k.slice(1)).value]))
 });
 const describe=msg=>{status.textContent=msg;};
 const notifyContact=()=>{
  const field=$("diagnosticoBrief"),form=$("briefForm");
  if(!field||!form)return;
  if(attachedValue && field.value===attachedValue){
   field.value="";$("diagnosticContext").hidden=true;
   $("diagnosticContextSummary").textContent="";
   form.dispatchEvent(new Event("input",{bubbles:true}));
  }
  attachedValue="";
 };
 const displayList=(id,items)=>{
  const ul=$(id),fragment=document.createDocumentFragment();
  for(const item of items){
   const li=document.createElement("li");li.textContent=item;fragment.append(li);
  }
  ul.replaceChildren(fragment);
 };
 const activate=()=>{
  actions.forEach(button=>button.disabled=!current||stale);
  $("discoveryRegenerate").disabled=!current;
  $("discoveryDemoLink").href="./demo.html?scenario="+(current?.demo||"orders");
 };
 function evaluate(reason=""){
  const next=buildDiscoveryBrief(context());
  notifyContact();
  current=next;
  if(!next){
   stale=true;
   $("discoveryReadiness").textContent="Elige un problema en el diagnóstico inicial.";
   displayList("discoveryGaps",["Selecciona un problema para continuar."]);
   displayList("discoveryRisks",[]);
   describe("Selecciona un problema antes de generar este brief.");
   activate();return;
  }
  $("discoveryReadiness").textContent=next.readiness;
  $("discoveryRoleHint").textContent=hint[context().role]||hint.operations;
  displayList("discoveryGaps",next.gaps);
  displayList("discoveryRisks",next.risks);
  if(edited){
   stale=true;
   describe("Has cambiado el contexto. El texto editado se conserva, pero debes regenerarlo para usarlo.");
  }else{
   preview.value=formatDiscoveryBrief(next);
   stale=false;
   describe(reason||"Brief actualizado con las condiciones y criterios de aceptación.");
  }
  activate();
 }
 for(const key of ids){
  const item=$("discovery"+key[0].toUpperCase()+key.slice(1));
  item.addEventListener("input",()=>evaluate());
 }
 for(const key of ["diagProblem","diagTools","diagScope"])
  $(key).addEventListener("change",()=>evaluate("El diagnóstico inicial cambió. Brief recalculado."));
 preview.addEventListener("input",()=>{
  edited=true;
  if(!stale)describe("Tus ediciones se conservarán en TXT, JSON y el extracto voluntario de consulta.");
 });
 $("discoveryRegenerate").addEventListener("click",()=>{
  if(!current)return;
  preview.value=formatDiscoveryBrief(current);
  edited=false;stale=false;activate();
  describe("Brief regenerado. Se ha sustituido el texto editado por la nueva versión estructurada.");
 });
 $("discoveryClose").addEventListener("click",()=>{
  root.hidden=true;$("diagStudioOpen").setAttribute("aria-expanded","false");
  $("diagStudioOpen").focus();
 });
 function download(filename,body,type){
  const objectUrl=URL.createObjectURL(new Blob([body],{type}));
  const link=document.createElement("a");
  link.href=objectUrl;link.download=filename;document.body.append(link);
  link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),3000);
 }
 const usable=()=>Boolean(current&&!stale&&preview.value.trim());
 $("discoveryCopy").addEventListener("click",async()=>{
  if(!usable())return;
  try{await navigator.clipboard.writeText(preview.value);describe("Brief copiado localmente.");}
  catch{describe("Este navegador no permite copiar. Puedes descargar el archivo TXT.");}
 });
 $("discoveryDownloadTxt").addEventListener("click",()=>{
  if(!usable())return;
  download("revops-discovery-pr71-"+current.demo+".txt",preview.value,"text/plain;charset=utf-8");
  describe("Brief editable descargado. No se ha enviado ninguna consulta.");
 });
 $("discoveryDownloadJson").addEventListener("click",()=>{
  if(!usable())return;
  const json=JSON.parse(discoveryJson(current));
  json.edited_text=preview.value;
  download("revops-discovery-pr71-"+current.demo+".json",JSON.stringify(json,null,2),"application/json;charset=utf-8");
  describe("Datos del brief y texto editado exportados en JSON a tu dispositivo.");
 });
 $("discoveryAttach").addEventListener("click",()=>{
  if(!usable())return;
  const field=$("diagnosticoBrief"),form=$("briefForm");
  if(!field||!form)return;
  // Explicit opt-in. Limit contact handoff size to keep the mail fallback usable.
  attachedValue="Brief PR71 · extracto voluntario (texto completo en la descarga local):\n"+
   preview.value.trim().slice(0,1350);
  field.value=attachedValue;
  $("diagnosticContext").hidden=false;
  $("diagnosticContextSummary").textContent="Extracto PR71 añadido a la consulta. Puedes quitarlo; no se envía nada hasta enviar el formulario con consentimiento.";
  const service=$("servicio"),message=$("dolor");
  if(service&&!service.value)service.value=current.service;
  if(message&&!message.value.trim())message.value="Quiero estudiar un piloto para: "+current.fields.problem.toLowerCase()+".";
  form.dispatchEvent(new Event("input",{bubbles:true}));
  describe("Extracto adjuntado. Revisa el formulario antes de enviarlo voluntariamente.");
  $("contacto").scrollIntoView({block:"start",behavior:"instant"});
 });
 root.hidden=false;$("diagStudioOpen").setAttribute("aria-expanded","true");
 evaluate();
 root.scrollIntoView({block:"start",behavior:"instant"});
}
