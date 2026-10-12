// PR77 · Lazy reporting panel. Aggregates only; true PDF bytes from local writer.
import {parseDelimited} from "./workflow-engine.js";
import {describePolicy} from "./workflow-policy.js";
import {
 createExecutiveSnapshot,executiveReportText,executiveReportJson,generateReportPdf
} from "./executive-pdf.js";

export function mountExecutiveReporting({getState}){
 const $=id=>document.getElementById(id);
 let documentModel=null;
 function status(message){$("reportStatus").textContent=message;}
 function gather(){
  const state=getState();
  if(!state?.result)throw Error("Ejecuta primero el proceso.");
  const policy=describePolicy(state.scenario,state.source,state.result,parseDelimited);
  return createExecutiveSnapshot({
   scenario:state.scenario,result:state.result,quality:state.quality,
   comparison:state.comparison,policy,
   reviewSummary:state.reviewSummary,candidate:state.candidate
  });
 }
 function sync(){
  documentModel=gather();
  for(const [id,value] of Object.entries({
   reportRows:documentModel.counts.total,
   reportReady:documentModel.counts.prepared,
   reportReview:documentModel.counts.review,
   reportBlocked:documentModel.counts.blocked
  }))$(id).textContent=String(value);
  status("Informe actualizado sobre "+documentModel.counts.total+
   " registros. PDF y exportaciones contienen exclusivamente datos agregados.");
  $("reportStudio").hidden=false;
  $("reportOpen").setAttribute("aria-expanded","true");
 }
 function exportFile(data,filename,mimetype,ttl=2500){
  const url=URL.createObjectURL(new Blob([data],{type:mimetype}));
  const a=document.createElement("a");
  a.href=url;a.download=filename;
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),ttl);
 }
 $("reportPdf").addEventListener("click",()=>{
  try{
   sync();
   const binary=generateReportPdf(documentModel);
   exportFile(binary,"revops-informe-ejecutivo-"+documentModel.scenario+".pdf","application/pdf");
   status("PDF auténtico descargado, con páginas numeradas y contenido agregado. No se ha enviado información.");
  }catch(error){status("No se pudo generar PDF: "+(error?.message||"revisa los datos."));}
 });
 $("reportTxt").addEventListener("click",()=>{
  try{
   sync();
   exportFile(executiveReportText(documentModel),
    "revops-informe-ejecutivo-"+documentModel.scenario+".txt","text/plain;charset=utf-8");
   status("TXT agregado descargado. Sin filas ni valores originales.");
  }catch(error){status("No se pudo crear TXT: "+(error?.message||"revisa los datos."));}
 });
 $("reportJson").addEventListener("click",()=>{
  try{
   sync();
   exportFile(executiveReportJson(documentModel),
    "revops-informe-ejecutivo-"+documentModel.scenario+".json","application/json;charset=utf-8");
   status("JSON estructurado descargado. Contiene solo métricas, reglas predefinidas y advertencias.");
  }catch(error){status("No se pudo crear JSON: "+(error?.message||"revisa los datos."));}
 });
 $("reportPrint").addEventListener("click",()=>{
  // Opening a PDF in a new tab lets the user's own browser PDF viewer print it.
  // Avoid window.print() on the HTML page, which would print original row data.
  let popup;
  try{
   sync();
   const binary=generateReportPdf(documentModel);
   // Called from synchronous real button click, before any await.
   popup=window.open("about:blank","_blank");
   if(!popup){status("El navegador bloquea ventanas nuevas. Descarga el PDF y ábrelo para imprimir.");return;}
   const url=URL.createObjectURL(new Blob([binary],{type:"application/pdf"}));
   popup.location.href=url;
   setTimeout(()=>URL.revokeObjectURL(url),60000);
   status("PDF abierto en otra pestaña. Usa Imprimir en el visor del navegador; nunca se imprime el CSV.");
  }catch(error){
   if(popup&&!popup.closed)popup.close();
   status("No se pudo abrir el PDF para imprimir: "+(error?.message||"error desconocido."));
  }
 });
 $("reportClose").addEventListener("click",()=>{
  $("reportStudio").hidden=true;
  $("reportOpen").setAttribute("aria-expanded","false");
  $("reportOpen").focus();
 });
 sync();
 return Object.freeze({sync,clear(){
  documentModel=null;
  for(const id of ["reportRows","reportReady","reportReview","reportBlocked"])$(id).textContent="0";
  status("Se ha descartado el resumen temporal del informe.");
 },close(){
  $("reportStudio").hidden=true;
  $("reportOpen").setAttribute("aria-expanded","false");
 }});
}
