// PR77 · Real in-browser PDF report with built-in PDF 1.4 objects and WinAnsi fonts.
// Absolutely no remote rendering, record values, emails, identifiers or row serialization.
import {SCENARIOS} from "./workflow-engine.js";
import {RULE_CATALOG} from "./workflow-policy.js";

const LIMIT=80;
const count=(value,label)=>{
 if(!Number.isInteger(value)||value<0||value>LIMIT)throw Error("Recuento inválido: "+label);
 return value;
};
const delta=(value,label)=>{
 if(!Number.isInteger(value)||Math.abs(value)>LIMIT)throw Error("Diferencia inválida: "+label);
 return value;
};
const signed=value=>value>0?"+"+value:String(value);
const labelState={listo:"Preparado",revisar:"Revisión humana",bloqueado:"Bloqueado"};
const staticPhases=Object.freeze([
 Object.freeze({title:"01 · Diagnóstico",detail:"Identificar las causas repetidas, validar campos y acordar criterios de aceptación."}),
 Object.freeze({title:"02 · Revisión humana",detail:"Resolver excepciones con responsables y evidencia. No aprobar automáticamente."}),
 Object.freeze({title:"03 · Piloto controlado",detail:"Probar en entorno aislado, confirmar permisos, volver a medir y diseñar reversión."})
]);
function ensureCounts(obj,total){
 if(!obj||typeof obj!=="object")throw Error("Faltan resultados calculados.");
 const prepared=count(obj.listo,"listos"),review=count(obj.revisar,"revisiones"),
  blocked=count(obj.bloqueado,"bloqueados");
 if(count(obj.total,"total")!==total||prepared+review+blocked!==total)
  throw Error("Los contadores no corresponden a la muestra.");
 return Object.freeze({total,prepared,review,blocked});
}
function readPolicy(type,policy){
 if(!policy)return Object.freeze({rules:RULE_CATALOG[type].length,covered:null,overlaps:null,
  humanGates:null,top:Object.freeze([])});
 if(policy.scenario!==type||policy.total<1)throw Error("El análisis de reglas no corresponde al escenario.");
 const known=RULE_CATALOG[type];
 const byId=new Map(policy.catalog?.map(r=>[r.id,r])||[]);
 if(byId.size!==known.length)throw Error("El catálogo no corresponde al motor actual.");
 const names=known.map(r=>({
  id:r.id,title:r.reason,applied:count(byId.get(r.id)?.applied,r.id),
  shadowed:count(byId.get(r.id)?.shadowed,r.id)
 }));
 return Object.freeze({
  rules:known.length,covered:names.filter(r=>r.applied).length,
  overlaps:count(policy.overlapCount,"solapamientos"),
  humanGates:count(policy.pendingHuman,"revisión humana"),
  top:Object.freeze(names.filter(r=>r.applied||r.shadowed).map(r=>Object.freeze(r)))
 });
}
function readQuality(type,quality,total){
 if(!quality)return null;
 if(quality.scenario!==type||quality.total!==total)throw Error("El análisis de calidad corresponde a otra muestra.");
 const fields={};
 for(const name of SCENARIOS[type].columns)
  fields[name]=count(quality.blanks?.[name]?.count,"vacíos en "+name);
 const completeness=quality.completeness;
 if(!Number.isInteger(completeness)||completeness<0||completeness>100)
  throw Error("Integridad de celdas no válida.");
 return Object.freeze({
  completeness,missingCells:count(quality.missingCells,"celdas vacías"),
  uniqueIds:count(quality.uniqueIds,"IDs distintos"),
  conflicts:count(quality.flags?.conflictingIds?.count,"conflictos"),
  identical:count(quality.flags?.exactDuplicates?.count,"duplicados idénticos"),
  invalidDates:count(quality.flags?.invalidDates?.count,"fechas"),
  invalidNumbers:count(quality.flags?.invalidNumbers?.count,"numéricos inválidos"),
  outliers:count(quality.flags?.outliers?.count,"atípicos"),
  fields:Object.freeze(fields)
 });
}
function readComparison(type,comparison,total){
 if(!comparison)return null;
 if(!comparison.comparable||comparison.before?.total!==total||comparison.after?.total!==total)
  throw Error("Comparación incompatible. Necesitas la misma muestra.");
 return Object.freeze({
  before:Object.freeze({
   prepared:count(comparison.before.prepared,"listos anteriores"),
   review:count(comparison.before.reviewing,"revisión anterior"),
   blocked:count(comparison.before.blocked,"bloqueados anteriores")
  }),
  after:Object.freeze({
   prepared:count(comparison.after.prepared,"listos actuales"),
   review:count(comparison.after.reviewing,"revisión actual"),
   blocked:count(comparison.after.blocked,"bloqueados actuales")
  }),
  delta:Object.freeze({
   prepared:delta(comparison.delta.prepared,"variación listos"),
   review:delta(comparison.delta.reviewing,"variación revisión"),
   blocked:delta(comparison.delta.blocked,"variación bloqueados")
  })
 });
}
function readReviews(review,required){
 if(!review)return Object.freeze({pending:required,active:0,simulated:0,rejected:0,realApprovals:0});
 if(count(review.total,"revisión total")!==required)throw Error("Las anotaciones no corresponden a esta ejecución.");
 const pending=count(review.pendiente,"pendientes"),active=count(review["en revisión"],"en curso"),
 simulated=count(review["aprobación simulada"],"simuladas"),rejected=count(review.rechazada,"rechazos");
 if(pending+active+simulated+rejected!==required||review.realApprovals!==0||review.externalExecuted!==0)
  throw Error("El estado de revisión no es un dato real verificable.");
 return Object.freeze({pending,active,simulated,rejected,realApprovals:0});
}
function readCandidate(type,candidate,total,counts){
 if(!candidate)return null;
 if(candidate.type!==type||!candidate.comparable||
  candidate.baseline?.counts?.total!==total||candidate.externalExecuted!==0||
  candidate.realApprovals!==0)
  throw Error("La variante no corresponde a los datos actuales.");
 if(candidate.baseline.counts.bloqueado!==counts.blocked||
  candidate.baseline.counts.revisar!==counts.review||
  candidate.baseline.counts.listo!==counts.prepared)
  throw Error("La variante se calculó sobre otro estado del motor.");
 const fields=candidate.countsByOutcome;
 return Object.freeze({
  additionalReview:count(fields.newlyReview,"revisión adicional"),
  preservedBlocked:count(fields.preservedBlocked,"bloqueos conservados"),
  preservedHuman:count(fields.alreadyReview,"revisiones conservadas"),
  preservedHistorical:count(fields.preservedHistorical,"históricos conservados"),
  deltaPrepared:delta(candidate.delta.prepared,"acciones cambiadas"),
  deltaReview:delta(candidate.delta.review,"revisiones cambiadas")
 });
}
export function createExecutiveSnapshot({scenario,result,quality=null,comparison=null,
 policy=null,reviewSummary=null,candidate=null}){
 if(!Object.hasOwn(SCENARIOS,scenario)||!result?.rows||result.scenario!==scenario)
  throw Error("Ejecuta un proceso válido antes de crear el informe.");
 const total=count(result.rows.length,"número de filas");
 if(total===0)throw Error("El informe requiere registros.");
 const counts=ensureCounts(result.counts,total);
 const q=readQuality(scenario,quality,total),compare=readComparison(scenario,comparison,total);
 const rules=readPolicy(scenario,policy);
 if(rules.humanGates!==null&&rules.humanGates!==counts.review)
  throw Error("El motor y la auditoría no coinciden en las revisiones humanas.");
 const reviews=readReviews(reviewSummary,counts.review);
 const variant=readCandidate(scenario,candidate,total,counts);
 const priorities=Object.freeze([
  counts.blocked>0?"Corregir "+counts.blocked+" registros bloqueados antes de cualquier propuesta.":null,
  counts.review>0?"Pedir valoración humana para "+counts.review+" excepciones.":null,
  q?.conflicts>0?"Investigar "+q.conflicts+" claves con contenido contradictorio.":null,
  q?.missingCells>0?"Completar o justificar "+q.missingCells+" celdas vacías.":null,
  "Validar las acciones propuestas en un piloto sin conexión automática a terceros."
 ].filter(Boolean));
 return Object.freeze({
  schema:"revops-executive-report-v1",scenario,
  scenarioTitle:SCENARIOS[scenario].title,counts,quality:q,comparison:compare,
  rules,reviews,candidate:variant,priorities,
  phases:staticPhases,
  sources:Object.freeze([
   "Motor local de reglas deterministas RevOps Studio",
   "Mismo conjunto de registros del editor, procesado solo en el navegador",
   "PR73: mediciones de integridad, duplicados y formatos, cuando están disponibles",
   "PR75: reglas con IDs estables y anotaciones simuladas, si se consultaron",
   "PR76: simulación de variantes conservadoras, si está abierta"
  ]),
  limitations:Object.freeze([
   "Son resultados de demostración, no una auditoría de sistemas empresariales.",
   "Las acciones preparadas NO se han enviado ni ejecutado.",
   "Las anotaciones humanas son simuladas. Aprobaciones reales verificadas: 0.",
   "Completitud no implica exactitud; valores atípicos no demuestran errores.",
   "Los cambios antes/después no acreditan causalidad, ahorro, ingresos ni ROI.",
   "El informe solo incluye agregados y texto predefinido; nunca filas, IDs, emails, notas ni nombres de clientes."
  ]),
  externalExecuted:0,realApprovals:0
 });
}
export function executiveReportText(doc){
 if(doc?.schema!=="revops-executive-report-v1")throw Error("Crea primero una instantánea válida.");
 const c=doc.counts;
 const sections=[
  "REVOPS STUDIO | INFORME EJECUTIVO · SIMULACIÓN LOCAL",
  "Proceso: "+doc.scenarioTitle,
  "Registros: "+c.total+" | Preparados: "+c.prepared+" | Revisión humana: "+c.review+" | Bloqueados: "+c.blocked,
  "",
  "RESUMEN EJECUTIVO",
  ...doc.priorities.map((p,i)=>(i+1)+". "+p),
  "",
  "CALIDAD DE DATOS",
  ...(doc.quality?[
   "Completitud: "+doc.quality.completeness+" % | Celdas vacías: "+doc.quality.missingCells,
   "Claves únicas: "+doc.quality.uniqueIds+" | Conflictos: "+doc.quality.conflicts+
    " | Duplicados idénticos: "+doc.quality.identical,
   "Fechas inválidas: "+doc.quality.invalidDates+" | Números inválidos: "+doc.quality.invalidNumbers+
    " | Candidatos a atípicos: "+doc.quality.outliers,
   ...Object.entries(doc.quality.fields).map(([name,n])=>name+": "+n+" sin dato")
  ]:["No disponible para esta ejecución."]),
  "",
  "EVIDENCIA ANTES Y DESPUÉS",
  ...(doc.comparison?[
   "Preparados: "+doc.comparison.before.prepared+" -> "+doc.comparison.after.prepared+" ("+signed(doc.comparison.delta.prepared)+")",
   "Revisión: "+doc.comparison.before.review+" -> "+doc.comparison.after.review+" ("+signed(doc.comparison.delta.review)+")",
   "Bloqueados: "+doc.comparison.before.blocked+" -> "+doc.comparison.after.blocked+" ("+signed(doc.comparison.delta.blocked)+")"
  ]:["Sin línea base comparable."]),
  "",
  "REGLAS Y REVISIÓN HUMANA",
  "Catálogo: "+doc.rules.rules+" | Con aplicación: "+(doc.rules.covered??"sin auditar")+
   " | Restricciones simultáneas: "+(doc.rules.overlaps??"sin auditar"),
  ...doc.rules.top.map(r=>r.id+" · "+r.title+" · aplicada "+r.applied+" · secundaria "+r.shadowed),
  "Pendientes: "+doc.reviews.pending+" | En revisión: "+doc.reviews.active+
   " | Aprobaciones simuladas: "+doc.reviews.simulated+" | Rechazos simulados: "+doc.reviews.rejected,
  "Aprobaciones verificadas: 0 | Acciones externas: 0",
  "",
  "ESCENARIO ALTERNATIVO",
  ...(doc.candidate?[
   "Revisiones añadidas: "+doc.candidate.additionalReview,
   "Bloqueos preservados: "+doc.candidate.preservedBlocked+
    " | Humanos preservados: "+doc.candidate.preservedHuman+
    " | Históricos preservados: "+doc.candidate.preservedHistorical,
   "Cambio propuestas: "+signed(doc.candidate.deltaPrepared)+
    " | Cambio revisión: "+signed(doc.candidate.deltaReview)
  ]:["Sin candidato configurado."]),
  "",
  "FASES PROPUESTAS",
  ...doc.phases.map(p=>p.title+": "+p.detail),
  "",
  "FUENTES Y LÍMITES",
  ...doc.sources.map(p=>"Fuente: "+p),
  ...doc.limitations.map(p=>"Límite: "+p)
 ];
 return sections.join("\n")+"\n";
}
export function executiveReportJson(doc){
 if(doc?.schema!=="revops-executive-report-v1")throw Error("Instantánea inválida.");
 return JSON.stringify(doc,null,2)+"\n";
}

// Portable PDF 1.4 generator using standard embedded-font references.
// PDF text streams encode as WinAnsi (Base14 Helvetica). No JS library,
// HTML renderer, server, print-to-HTML, dynamic fonts or network involved.
const PAGE_W=595.28,PAGE_H=841.89,LEFT=47,RIGHT=47,TOP=75,BOTTOM=61;
const SAFE_WIDTH=PAGE_W-LEFT-RIGHT;
const cp1252=Object.freeze({8216:145,8217:146,8220:147,8221:148,8211:150,
 8212:151,8226:149,8364:128,8230:133});
function byteFor(char){
 const n=char.codePointAt(0);
 if(n>=32&&n<=126||n>=160&&n<=255)return n;
 if(n===10)return 10;
 if(Object.hasOwn(cp1252,n))return cp1252[n];
 return 63;
}
function normalizedWinAnsi(value){
 const s=String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/→/g,"->");
 let result="";
 for(const ch of s)result+=String.fromCharCode(byteFor(ch));
 return result;
}
function pdfEscape(value){
 return normalizedWinAnsi(value).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
}
const fmt=n=>Number(n.toFixed(2));
const widthOf=(value,size)=>{
 const text=String(value);
 let unit=0;
 for(const char of text){
  if("ilI.,:;!|' ".includes(char))unit+=.27;
  else if("mwMW@%".includes(char))unit+=.85;
  else if("0123456789".includes(char))unit+=.57;
  else if(char===char.toUpperCase())unit+=.65;
  else unit+=.53;
 }
 return unit*size;
};
function wrapLines(value,fontSize=10,width=SAFE_WIDTH){
 const output=[],words=normalizedWinAnsi(value).split(/\s+/).filter(Boolean);
 let current="";
 for(let word of words){
  // Prevent pathologically long tokens from escaping the page.
  while(widthOf(word,fontSize)>width){
   let n=Math.max(1,Math.floor(word.length*width/widthOf(word,fontSize))-2);
   while(n>1&&widthOf(word.slice(0,n),fontSize)>width)n--;
   if(current){output.push(current);current="";}
   output.push(word.slice(0,n));word=word.slice(n);
  }
  if(!word)continue;
  const next=current?current+" "+word:word;
  if(widthOf(next,fontSize)<=width)current=next;
  else{if(current)output.push(current);current=word;}
 }
 if(current)output.push(current);
 return output.length?output:[""];
}
export function generateReportPdf(doc){
 if(doc?.schema!=="revops-executive-report-v1")throw Error("Crea una instantánea válida.");
 const pages=[];let commands=[],y=PAGE_H-TOP;
 const ink="0.10 0.17 0.25",muted="0.35 0.40 0.46",accent="0.05 0.45 0.48";
 const rect=(x,at,w,h,color)=>commands.push(color+" rg "+fmt(x)+" "+fmt(at)+" "+fmt(w)+" "+fmt(h)+" re f");
 const rule=(at)=>rect(LEFT,at,SAFE_WIDTH,.8,"0.83 0.88 0.90");
 const text=(value,x,at,size=10,bold=false,color=ink)=>{
  if(!String(value??"").length)return;
  commands.push(color+" rg BT /"+(bold?"F2":"F1")+" "+fmt(size)+" Tf "+
   fmt(x)+" "+fmt(at)+" Td ("+pdfEscape(value)+") Tj ET");
 };
 function newPage(){
  if(commands.length)pages.push(commands.join("\n")+"\n");
  commands=[];y=PAGE_H-TOP;
  rect(0,PAGE_H-40,PAGE_W,40,ink);
  text("REVOPS STUDIO",LEFT,PAGE_H-25,12,true,"1 1 1");
  text("INFORME · SIMULACIÓN LOCAL",PAGE_W-RIGHT-177,PAGE_H-25,8,true,"0.72 0.92 0.92");
  rule(y+9);
 }
 function ensure(height){
  if(y-height<BOTTOM)newPage();
 }
 function space(n=9){ensure(n);y-=n;}
 function section(title){
  ensure(42);space(17);
  rect(LEFT,y-1,3,15,accent);
  text(title,LEFT+11,y,12,true,ink);
  y-=21;rule(y+9);space(5);
 }
 function paragraph(content,{size=9.5,bold=false,color=ink,indent=0,gap=6}={}){
  const lines=wrapLines(content,size,SAFE_WIDTH-indent);
  const height=lines.length*(size+4)+gap;
  if(height>PAGE_H-TOP-BOTTOM){
   for(const ln of lines)paragraph(ln,{size,bold,color,indent,gap:0});
   space(gap);return;
  }
  ensure(height);
  for(const ln of lines){text(ln,LEFT+indent,y,size,bold,color);y-=size+4;}
  space(gap);
 }
 function metricCards(items){
  const cardGap=8,cardW=(SAFE_WIDTH-(items.length-1)*cardGap)/items.length;
  ensure(77);
  for(let i=0;i<items.length;i++){
   const x=LEFT+i*(cardW+cardGap);
   rect(x,y-62,cardW,67,"0.93 0.96 0.97");
   text(String(items[i].value),x+11,y-28,23,true,accent);
   text(items[i].title,x+11,y-47,8,false,muted);
  }
  y-=81;
 }
 function twoValueLine(name,before,after){
  ensure(23);
  text(name,LEFT,y,10,true,ink);
  const value=before+"  ->  "+after;
  text(value,PAGE_W-RIGHT-Math.min(SAFE_WIDTH*.38,widthOf(value,10)+6),y,10,true,accent);
  y-=21;rule(y+7);
 }
 newPage();
 paragraph("INFORME EJECUTIVO DE OPERACIONES",{size:18,bold:true,gap:6});
 paragraph(doc.scenarioTitle,{size:12,color:muted,gap:17});
 metricCards([
  {title:"REGISTROS",value:doc.counts.total},
  {title:"PREPARADOS",value:doc.counts.prepared},
  {title:"REVISIÓN HUMANA",value:doc.counts.review},
  {title:"BLOQUEADOS",value:doc.counts.blocked}
 ]);
 paragraph("Estado del informe: evidencia local y orientativa. Ninguna propuesta ha sido enviada ni aprobada en sistemas reales.",
  {size:9.2,color:muted,gap:5});
 section("01 / RESUMEN EJECUTIVO");
 for(const p of doc.priorities)paragraph("• "+p,{size:10,gap:7,indent:6});
 section("02 / CALIDAD DE DATOS");
 if(doc.quality){
  paragraph("Completitud "+doc.quality.completeness+" %  |  Celdas vacías "+doc.quality.missingCells+
   "  |  Claves únicas "+doc.quality.uniqueIds,{bold:true,gap:7});
  paragraph("Conflictos ID: "+doc.quality.conflicts+"  |  Duplicados idénticos: "+doc.quality.identical+
   "  |  Fechas inválidas: "+doc.quality.invalidDates,{gap:4});
  paragraph("Números inválidos: "+doc.quality.invalidNumbers+
   "  |  Candidatos a atípicos: "+doc.quality.outliers,{gap:8});
  for(const [field,n] of Object.entries(doc.quality.fields))
   paragraph("Campo "+field+": "+n+" celda(s) vacía(s)",{size:9,color:muted,gap:2,indent:7});
 }else paragraph("Análisis de calidad no disponible para esta ejecución.",{color:muted});
 section("03 / ANTES Y DESPUÉS · MISMA MUESTRA");
 if(doc.comparison){
  twoValueLine("Preparados",doc.comparison.before.prepared,doc.comparison.after.prepared);
  twoValueLine("Revisión humana",doc.comparison.before.review,doc.comparison.after.review);
  twoValueLine("Bloqueados",doc.comparison.before.blocked,doc.comparison.after.blocked);
  paragraph("Diferencias: "+signed(doc.comparison.delta.prepared)+" preparados, "+
   signed(doc.comparison.delta.review)+" revisiones, "+signed(doc.comparison.delta.blocked)+" bloqueos.",
   {size:9,color:muted,gap:7});
 }else paragraph("No existe una línea base compatible para comparar.",{color:muted});
 section("04 / REGLAS Y DECISIONES HUMANAS");
 paragraph(doc.rules.rules+" reglas catalogadas · "+
  (doc.rules.covered===null?"Cobertura no auditada":doc.rules.covered+" aplicadas")+" · "+
  (doc.rules.overlaps===null?"Sin estudio de concurrencia":doc.rules.overlaps+" restricciones simultáneas"),
  {bold:true,gap:9});
 for(const r of doc.rules.top){
  paragraph(r.id+" · "+r.title+" · "+r.applied+" principal(es), "+r.shadowed+" secundaria(s).",
   {size:9,color:muted,gap:4,indent:7});
 }
 paragraph("Bandeja: "+doc.reviews.pending+" pendientes; "+doc.reviews.active+
  " en revisión; "+doc.reviews.simulated+" aprobaciones simuladas; "+doc.reviews.rejected+" rechazos simulados.",
  {size:9.5,gap:5});
 paragraph("Ninguna anotación altera las reglas ni constituye aprobación verificable.",{size:9,color:muted});
 section("05 / VARIANTE DE REGLAS");
 if(doc.candidate){
  paragraph("Revisiones añadidas: "+doc.candidate.additionalReview+
   ". Bloqueados preservados: "+doc.candidate.preservedBlocked+
   ". Humanos anteriores: "+doc.candidate.preservedHuman+".",{gap:6});
  paragraph("Históricos conservados: "+doc.candidate.preservedHistorical+
   ". Diferencia de preparados: "+signed(doc.candidate.deltaPrepared)+
   ". Diferencia de revisiones: "+signed(doc.candidate.deltaReview)+".",
   {color:muted});
 }else paragraph("Sin variante adicional validada para esta muestra.",{color:muted});
 section("06 / FASES SUGERIDAS");
 for(const phase of doc.phases){
  paragraph(phase.title,{size:10,bold:true,gap:3});
  paragraph(phase.detail,{size:9.3,color:muted,indent:8,gap:10});
 }
 section("07 / FUENTES Y ALCANCE");
 for(const value of doc.sources)paragraph("• "+value,{size:8.5,color:muted,gap:4,indent:4});
 section("08 / LIMITACIONES Y PRIVACIDAD");
 for(const value of doc.limitations)paragraph("• "+value,{size:8.8,color:muted,gap:5,indent:4});
 paragraph("ACCIONES EJECUTADAS EXTERNAMENTE: 0   |   APROBACIONES REALES: 0",
  {size:10,bold:true,gap:5});
 if(commands.length)pages.push(commands.join("\n")+"\n");
 if(pages.length>24)throw Error("Informe demasiado largo para esta demo.");

 const objects=[""]; // object id 0 is xref free
 function obj(content){objects.push(content);return objects.length-1;}
 const catalogId=obj("");
 const pagesId=obj("");
 const normalId=obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
 const boldId=obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
 const pageIds=[];
 pages.forEach((stream,index)=>{
  const footer=[
   muted+" rg BT /F1 8 Tf "+fmt(LEFT)+" 36 Td ("+pdfEscape("RevOps Studio · Local / No ejecutado")+") Tj ET",
   muted+" rg BT /F1 8 Tf "+fmt(PAGE_W-RIGHT-95)+" 36 Td ("+pdfEscape("Página "+(index+1)+" de "+pages.length)+") Tj ET"
  ].join("\n")+"\n";
  const data=stream+footer;
  const contentId=obj("<< /Length "+data.length+" >>\nstream\n"+data+"endstream");
  const pageId=obj("<< /Type /Page /Parent "+pagesId+" 0 R /MediaBox [0 0 "+
   fmt(PAGE_W)+" "+fmt(PAGE_H)+"] /Resources << /Font << /F1 "+
   normalId+" 0 R /F2 "+boldId+" 0 R >> >> /Contents "+contentId+" 0 R >>");
  pageIds.push(pageId);
 });
 objects[pagesId]="<< /Type /Pages /Count "+pageIds.length+" /Kids ["+
  pageIds.map(n=>n+" 0 R").join(" ")+"] >>";
 objects[catalogId]="<< /Type /Catalog /Pages "+pagesId+" 0 R >>";
 let raw="%PDF-1.4\n%\xE2\xE3\xCF\xD3\n",offsets=[0];
 for(let i=1;i<objects.length;i++){
  offsets[i]=raw.length;
  raw+=i+" 0 obj\n"+objects[i]+"\nendobj\n";
 }
 const xref=raw.length;
 raw+="xref\n0 "+objects.length+"\n0000000000 65535 f \n";
 for(let i=1;i<objects.length;i++)raw+=String(offsets[i]).padStart(10,"0")+" 00000 n \n";
 raw+="trailer\n<< /Size "+objects.length+" /Root "+catalogId+" 0 R >>\nstartxref\n"+
  xref+"\n%%EOF\n";
 const bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++){
  const char=raw.charCodeAt(i);
  if(char>255)throw Error("Carácter fuera de la codificación PDF en byte "+i+".");
  bytes[i]=char;
 }
 return bytes;
}
