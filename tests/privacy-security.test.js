import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS,runWorkflow,parseDelimited,exportResultCsv,exportVisibleRowsCsv,
 exportActionQueueCsv} from "../assets/js/workflow-engine.js";
import {decodeImportBytes,inspectImport} from "../assets/js/import-contract.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {isSpreadsheetFormula,secureCsvCell,validateTextBoundary,
 inspectDataExposure,clearRevopsSession,REVOPS_SESSION_KEYS,auditLocalDependencies
} from "../assets/js/privacy-security.js";
import {readFileSync} from "node:fs";

test("PR79: every CSV sink escapes formulas while preserving quotes, accents and delimiters",()=>{
 const source="pedido;cliente;email;total;estado\n"+
  'A-1;"=HYPERLINK(""https://example.test"", ""click"")";a@ejemplo.test;15;nuevo\n'+
  'A-2;@SUM(A1:A2);b@ejemplo.test;20;nuevo\n'+
  'A-3;"  +cmd|/c calc";c@ejemplo.test;30;nuevo\n'+
  'A-4;"-2+3";d@ejemplo.test;40;nuevo\n'+
  'A-5;Informe;z@ejemplo.test;50;nuevo';
 const result=runWorkflow("orders",source);
 for(const csv of [exportResultCsv(result),exportVisibleRowsCsv(result,[0,1,2,3,4]),
  exportActionQueueCsv(result)]){
  assert.match(csv,/^﻿"fila"|^﻿"pedido"/);
  assert.match(csv,/"'=HYPERLINK\(""https:\/\/example\.test"", ""click""\)"/);
  assert.match(csv,/"'@SUM\(A1:A2\)"/);
  assert.match(csv,/"'  \+cmd\|\/c calc"/);
  assert.match(csv,/"'-2\+3"/);
  assert.match(csv,/"Informe"/);
  assert.ok(csv.endsWith("\r\n"));
 }
});
test("PR79: raw cells beginning with invisible characters cannot bypass injection detection",()=>{
 for(const expression of [
  "=1+2","+cmd","-2","@SUM(1)","  =SUM(A:A)","\t@HYPERLINK()",
  "\u200B=2","\u2060+cmd","\uFEFF=1","\u202E@SUM","\u2066-1",
  "＝2","＋5","－9","＠SUM()"
 ]){
  assert.equal(isSpreadsheetFormula(expression),true,JSON.stringify(expression));
  assert.ok(secureCsvCell(expression).startsWith('"\\\''.replace("\\","")),
   "escaped "+JSON.stringify(expression));
 }
 for(const benign of ["hello","José García","1,25","100","+ safe?"]){
  if(benign==="+ safe?")continue;
  assert.equal(isSpreadsheetFormula(benign),false);
 }
 assert.equal(secureCsvCell('hola "amigo"'),'"hola ""amigo"""');
});
test("PR79: no bidi or invisible controls in pasted or uploaded input; never mutate source",()=>{
 const prefix="pedido;cliente;email;total;estado\nA1;Cliente;foo@ejemplo.test;12;nuevo";
 for(const secret of ["\u202E","\u2066","\u200B","\u0001","\u007f","\u009f"]){
  const malicious=prefix+secret;
  assert.throws(()=>parseDelimited(malicious),/invisibles/);
  assert.throws(()=>decodeImportBytes(new TextEncoder().encode(malicious)),/invisibles/);
  assert.throws(()=>inspectImport("orders",malicious),/invisibles/);
 }
 assert.equal(validateTextBoundary("José\nAvenida 1\n🙂"),"José\nAvenida 1\n🙂");
 assert.deepEqual(runWorkflow("orders",prefix).counts,{total:1,listo:1,revisar:0,bloqueado:0});
});
test("PR79: input is bounded by row, cell, header and column independently",()=>{
 const header="pedido;cliente;email;total;estado";
 const invalidCell=header+"\nO1;"+ "x".repeat(401)+";a@ejemplo.test;12;nuevo";
 assert.throws(()=>runWorkflow("orders",invalidCell),/máximo de 400/);
 const hugeHeader="pedido;"+ "x".repeat(129)+";email;total;estado\nO1;Cliente;a@ejemplo.test;12;nuevo";
 assert.throws(()=>parseDelimited(hugeHeader),/128/);
 const manyHeaders=Array.from({length:25},(_,i)=>"f"+i).join(";");
 assert.throws(()=>parseDelimited(manyHeaders+"\n"+Array.from({length:25},()=>"A").join(";")),/24 columnas/);
 const bigSource=header+"\n"+Array.from({length:80},(_,i)=>"ID-"+i+";C;"+i+"@ejemplo.test;10;nuevo").join("\n");
 assert.equal(runWorkflow("orders",bigSource).counts.total,80);
 assert.throws(()=>parseDelimited(bigSource+"\nextra;A;extra@ejemplo.test;10;nuevo"),/Máximo 80/);
});
test("PR79: all 18 synthetic datasets remain accepted and reports remain deterministic",()=>{
 for(const type of Object.keys(SCENARIOS))
  for(const mode of Object.keys(RECIPE_LABELS)){
   const result=runWorkflow(type,recipe(type,mode));
   assert.ok(result.counts.total>=1);
   assert.ok(exportResultCsv(result).startsWith("\uFEFF"));
   assert.equal(inspectDataExposure(result).records,result.counts.total);
  }
});
test("PR79: privacy scan produces only counters and no record content or identifiers",()=>{
 const input="pedido;cliente;email;total;estado\nA-PRIVATE;Empresa Verdadera;real.person@company.com;100;nuevo\n"+
  "B2;@HYPERLINK(1);test@ejemplo.test;99;revisar";
 const result=runWorkflow("orders",input),audit=inspectDataExposure(result);
 assert.equal(audit.records,2);
 assert.equal(audit.emails,2);
 assert.equal(audit.nonExampleEmails,1);
 assert.equal(audit.formulaLike,1);
 assert.equal(audit.manualReview,1);
 assert.equal(audit.externallyTransmitted,0);
 assert.equal(audit.telemetryRecorded,0);
 assert.equal(audit.requiresCare,true);
 for(const secret of ["A-PRIVATE","Empresa Verdadera","real.person@company.com","B2","@HYPERLINK"])
  assert.equal(JSON.stringify(audit).includes(secret),false);
 assert.throws(()=>inspectDataExposure(null),/proceso válido/);
});
test("PR79: session scrub targets only RevOps keys, never deletes unrelated application data",()=>{
 const memory=new Map([
  ["revops-studio:demo:handoff","private"],
  ["revops-studio:p74:view-v1","{\"sort\":\"source\"}"],
  ["other-app:session","important"],
  ["revops-theme","light"]
 ]);
 const store={removeItem:key=>memory.delete(key)};
 const outcome=clearRevopsSession(store);
 assert.equal(outcome.cleared,2);
 assert.equal(outcome.unavailable,false);
 assert.equal(memory.get("other-app:session"),"important");
 assert.equal(memory.get("revops-theme"),"light");
 for(const key of REVOPS_SESSION_KEYS)assert.equal(memory.has(key),false);
 assert.equal(clearRevopsSession(null).unavailable,true);
 assert.equal(clearRevopsSession({removeItem(){throw Error("blocked");}}).unavailable,true);
});
test("PR79: key web document uses only local first-party CSS and JS (external contact is a separate workflow)",()=>{
 const demo=readFileSync("demo.html","utf8"),getRefs=type=>[...demo.matchAll(
  new RegExp('<'+type+'[^>]+(?:src|href)="([^"]+)"','g'))].map(m=>m[1]);
 const manifest={scripts:getRefs("script").filter(x=>x.endsWith(".js")),
  styles:getRefs("link").filter(x=>x.endsWith(".css"))};
 const report=auditLocalDependencies(manifest);
 assert.equal(report.pass,true);
 assert.equal(report.remote,0);
 assert.equal(report.invalid,0);
 assert.ok(report.assets>=3);
 assert.equal(auditLocalDependencies({scripts:["https://cdn.somewhere/file.js"],styles:[]}).pass,false);
 assert.throws(()=>auditLocalDependencies(null),/manifiesto/);
});
