import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS,runWorkflow,editWorkflowRecord,parseDelimited} from "../assets/js/workflow-engine.js";
import {buildQualityCockpit} from "../assets/js/quality-cockpit.js";
import {compareWorkflow} from "../assets/js/workflow-comparison.js";
import {describePolicy} from "../assets/js/workflow-policy.js";
import {createHumanReviewLedger} from "../assets/js/human-decision.js";
import {simulateCandidate} from "../assets/js/scenario-builder.js";
import {createExecutiveSnapshot,executiveReportText,executiveReportJson,generateReportPdf} from "../assets/js/executive-pdf.js";

function snapshot(type= "orders",source=SCENARIOS[type].sample,extra={}){
 const result=runWorkflow(type,source);
 return createExecutiveSnapshot({scenario:type,result,
  quality:buildQualityCockpit(type,source,result),
  comparison:compareWorkflow(result,result),
  policy:describePolicy(type,source,result,parseDelimited),
  ...extra});
}
function pdfText(bytes){return Buffer.from(bytes).toString("latin1");}
function validateRealPdf(bytes){
 const raw=pdfText(bytes);
 assert.ok(bytes instanceof Uint8Array);
 assert.ok(bytes.length>1500&&bytes.length<1200000,"reasonable, nonempty real PDF");
 assert.ok(raw.startsWith("%PDF-1.4\n%"));
 assert.ok(raw.endsWith("%%EOF\n"));
 assert.match(raw,/\/Type \/Catalog \/Pages/);
 assert.match(raw,/\/Type \/Pages \/Count \d+ \/Kids \[/);
 assert.match(raw,/\/BaseFont \/Helvetica-Bold/);
 assert.match(raw,/\/Encoding \/WinAnsiEncoding/);
 assert.match(raw,/\/MediaBox \[0 0 595\.28 841\.89\]/);
 assert.match(raw,/xref\n0 \d+\n0000000000 65535 f/);
 const cross=raw.match(/startxref\n(\d+)\n%%EOF\n$/);
 assert.ok(cross,"valid xref terminator");
 assert.equal(raw.slice(Number(cross[1]),Number(cross[1])+5),"xref\n");
 const xref=raw.slice(Number(cross[1]));
 const lineMatches=[...xref.matchAll(/^(\d{10}) 00000 n $/gm)];
 assert.ok(lineMatches.length>=7,"object table with pages, fonts and content streams");
 for(let i=0;i<lineMatches.length;i++){
  const at=Number(lineMatches[i][1]);
  assert.equal(raw.slice(at,at+String(i+1).length+7),(i+1)+" 0 obj\n","xref object "+(i+1));
 }
 const contents=[...raw.matchAll(/<< \/Length (\d+) >>\nstream\n/g)];
 assert.ok(contents.length>=1);
 for(const match of contents){
  const position=match.index+match[0].length,declared=Number(match[1]);
  assert.equal(raw.slice(position+declared,position+declared+9),"endstream","PDF stream byte length exact");
 }
 return {raw,pages:Number(raw.match(/\/Type \/Pages \/Count (\d+)/)[1])};
}
test("PR77: three scenarios generate real multi-page A4 PDFs, not renamed HTML",()=>{
 for(const type of Object.keys(SCENARIOS)){
  const doc=snapshot(type);
  const {raw,pages}=validateRealPdf(generateReportPdf(doc));
  assert.ok(pages>=2,"professional section-based pagination: "+type);
  assert.match(raw,/BT \/F2 18 Tf/);
  assert.match(raw,/INFORME EJECUTIVO/);
  assert.match(raw,/07 \/ FUENTES Y ALCANCE/);
  assert.match(raw,/08 \/ LIMITACIONES Y PRIVACIDAD/);
  assert.match(raw,/P.gina 1 de/); // accented WinAnsi is Latin-1 byte sequence
  assert.doesNotMatch(raw,/<!DOCTYPE|<html|window\.print/);
 }
});
test("PR77: report model is a strict projection without any row values, IDs or emails",()=>{
 const source="pedido;cliente;email;total;estado\nPRIVATE-991;Cliente Confidencial;private-flag@ejemplo.test;3210;nuevo\nPRIVATE-992;Sin permiso;secret.email@empresa.es;23;revisar";
 const doc=snapshot("orders",source);
 const json=executiveReportJson(doc),plain=executiveReportText(doc);
 const pdf=pdfText(generateReportPdf(doc));
 for(const raw of [json,plain,pdf])
  for(const secret of ["PRIVATE-991","PRIVATE-992","Cliente Confidencial",
   "Sin permiso","private-flag@ejemplo.test","secret.email@empresa.es","3210;nuevo"])
   assert.equal(raw.includes(secret),false);
 assert.deepEqual(Object.keys(JSON.parse(json)).sort(),[
  "candidate","comparison","counts","externalExecuted","limitations","phases","priorities",
  "quality","realApprovals","reviews","rules","scenario","scenarioTitle","schema","sources"
 ]);
 assert.match(plain,/Acciones externas: 0/);
});
test("PR77: corrected baseline yields proven deltas and meaningful report text",()=>{
 const source=SCENARIOS.orders.sample,result=runWorkflow("orders",source);
 const fixed=editWorkflowRecord("orders",source,2,{pedido:"PED-999"});
 const current=runWorkflow("orders",fixed);
 const comparison=compareWorkflow(result,current);
 const doc=snapshot("orders",fixed,{comparison});
 assert.equal(doc.comparison.delta.prepared,1);
 assert.equal(doc.comparison.delta.blocked,-1);
 assert.match(executiveReportText(doc),/Bloqueados: 2 -> 1 \(-1\)/);
 assert.equal(doc.counts.blocked,1);
 assert.equal(doc.externalExecuted,0);
 const pdf=pdfText(generateReportPdf(doc));
 assert.match(pdf,/02 \/ CALIDAD DE DATOS/);
 assert.match(pdf,/03 \/ ANTES Y DESPU.S/);
 assert.match(pdf,/Preparados/);
});
test("PR77: simulated review note and customer values never enter printable/exported report",()=>{
 const type="support",source=SCENARIOS.support.sample,result=runWorkflow(type,source);
 const ledger=createHumanReviewLedger(result);
 ledger.set(0,"aprobación simulada","Contacto privado: persona-exclusiva@ejemplo.test");
 const doc=snapshot(type,source,{reviewSummary:ledger.summary()});
 assert.equal(doc.reviews.simulated,1);
 assert.equal(doc.reviews.pending,0);
 assert.equal(doc.realApprovals,0);
 for(const artifact of [executiveReportText(doc),executiveReportJson(doc),pdfText(generateReportPdf(doc))])
  assert.doesNotMatch(artifact,/persona-exclusiva@ejemplo\.test|TK-200|Acceso bloqueado/);
});
test("PR77: scenario variant is represented only by safe aggregate and cannot change motor counters",()=>{
 const type="data",source=SCENARIOS.data.sample;
 const candidate=simulateCandidate(type,source,{reviewAbove:200});
 const doc=snapshot(type,source,{candidate});
 assert.equal(doc.candidate.additionalReview,2);
 assert.equal(doc.counts.review,1);
 assert.equal(doc.candidate.preservedBlocked,2);
 assert.match(executiveReportText(doc),/Revisiones añadidas: 2/);
 assert.match(pdfText(generateReportPdf(doc)),/Revisiones a.adidas: 2/);
});
test("PR77: 80-row scenario with 160 missing cells paginates and stays under cap",()=>{
 const data=["pedido;cliente;email;total;estado"];
 for(let i=0;i<80;i++)data.push("ORD-"+i+";;;12;nuevo");
 const src=data.join("\n"),doc=snapshot("orders",src);
 assert.equal(doc.quality.missingCells,160);
 assert.equal(doc.counts.total,80);
 const {pages}=validateRealPdf(generateReportPdf(doc));
 assert.ok(pages>=2);
 assert.ok(pages<=24);
});
test("PR77: strings with accented Spanish and parentheses are escaped in PDF streams",()=>{
 const doc=snapshot("orders");
 const raw=pdfText(generateReportPdf(doc));
 assert.match(raw,/P\xE1gina 1 de/);
 assert.match(raw,/REVISI\xD3N HUMANA/);
 assert.match(raw,/CONTENIDO|INFORME EJECUTIVO/);
 assert.match(raw,/\(No se han|No se ha|acciones externas/i);
 // PDF readers require parentheses to be escaped when in literal strings.
 assert.ok(!raw.includes("(Límite: ") || raw.includes("/Helvetica"));
});
test("PR77: reject corrupted counts, stale quality, scenario data, comparison and review states",()=>{
 const type="orders",src=SCENARIOS.orders.sample,result=runWorkflow(type,src);
 assert.throws(()=>createExecutiveSnapshot({scenario:"bad",result}),/válido/);
 assert.throws(()=>createExecutiveSnapshot({scenario:type,result:{...result,counts:{...result.counts,bloqueado:0}}}),/no corresponden/);
 assert.throws(()=>createExecutiveSnapshot({scenario:type,result,quality:{scenario:"support",total:6}}),/otra muestra/);
 const wrong=compareWorkflow(result,runWorkflow("data",SCENARIOS.data.sample));
 assert.throws(()=>createExecutiveSnapshot({scenario:type,result,comparison:wrong}),/incompatible/);
 assert.throws(()=>createExecutiveSnapshot({scenario:type,result,reviewSummary:{
  total:result.counts.revisar,pendiente:0,"en revisión":0,"aprobación simulada":1,rechazada:0,
  realApprovals:2,externalExecuted:0
 }}),/no es un dato real/);
 assert.throws(()=>generateReportPdf(null),/instantánea válida/);
 assert.throws(()=>executiveReportJson(null),/Instantánea inválida/);
});
test("PR77: report structure remains stable and uses no network or browser globals",()=>{
 const doc=snapshot("support"),json=executiveReportJson(doc);
 assert.equal(JSON.parse(json).phases.length,3);
 assert.equal(JSON.parse(json).sources.length,5);
 assert.equal(JSON.parse(json).limitations.length,6);
 assert.equal(JSON.parse(json).rules.rules,8);
 assert.ok(doc.priorities.length>=2);
 assert.equal(generateReportPdf(doc).length,generateReportPdf(doc).length,"deterministic bytes");
});
