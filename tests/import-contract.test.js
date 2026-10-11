import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS,runWorkflow} from "../assets/js/workflow-engine.js";
import {suggestMapping,normalizeMappedCsv} from "../assets/js/column-mapper.js";
import {decodeImportBytes,inspectImport,ensureImportReady,makeMappingProfile,readMappingProfile} from "../assets/js/import-contract.js";
const bytes=text=>new TextEncoder().encode(text);
const input="Order ID;Company;Correo;Amount;Status;Internal note\n0007;Acme;a@ejemplo.test;12;nuevo;no exportar";
const mapped={pedido:"order id",cliente:"company",email:"correo",total:"amount",estado:"status"};
test("PR72: strict UTF-8 BOM, CRLF, quoted fields and original string preservation",()=>{
 const csv="pedido;cliente;email;total;estado\r\n0007;\"Almacén \"\"Sol\"\"\";a@b.es;18,5;nuevo\r\n";
 const safe=decodeImportBytes(bytes(csv));
 assert.equal(runWorkflow("orders",safe).rows[0].id,"0007");
 assert.equal(runWorkflow("orders",decodeImportBytes(bytes("\uFEFF"+csv))).counts.listo,1);
 assert.equal(inspectImport("orders",safe).format,"CSV (punto y coma)");
 assert.equal(inspectImport("orders","pedido\tcliente\temail\ttotal\testado\n0007\tTienda\ta@b.es\t18\tnuevo").format,"TSV (tabulaciones)");
 assert.equal(inspectImport("orders",'pedido,cliente,email,total,estado\n0007,Acme,a@b.es,18,nuevo').format,"CSV (comas)");
});
test("PR72: bad byte streams and UTF-16 fail closed before replacing user records",()=>{
 for(const raw of [new Uint8Array(),new Uint8Array([0xff,0xfe,65,0]),new Uint8Array([0xfe,0xff,0,65]),
   new Uint8Array([0xc3,0x28]),new Uint8Array([0xef,0xbb,0x28]),new Uint8Array(32001)]){
   assert.throws(()=>decodeImportBytes(raw),/vacío|UTF-16|Codificación|BOM|32 KB/);
 }
 assert.throws(()=>decodeImportBytes("hello"),/binario/);
 assert.throws(()=>inspectImport("orders","a;b\n1;\uFFFD"),/reemplazo/);
 assert.throws(()=>inspectImport("orders","a;b\n1;\u0000"),/nulos/);
 assert.throws(()=>inspectImport("orders","a;b\n1;\u0001"),/control/);
});
test("PR72: exact headers and scenario-specific aliases, prepared counts from real engine",()=>{
 const original=inspectImport("orders",SCENARIOS.orders.sample);
 assert.equal(original.status,"ready");
 assert.deepEqual(original.counts,runWorkflow("orders",SCENARIOS.orders.sample).counts);
 assert.equal(original.rows,6);
 assert.equal(original.preview.length,3);
 assert.equal(ensureImportReady(original),true);
 const synonyms=inspectImport("orders",input);
 assert.equal(synonyms.status,"confirm_discards");
 assert.deepEqual(synonyms.ignored,["internal note"]);
 assert.equal(synonyms.rows,1);
 assert.equal(synonyms.counts.listo,1);
 assert.throws(()=>ensureImportReady(synonyms),/Confirma/);
 assert.equal(ensureImportReady(synonyms,true),true);
});
test("PR72: required mapping cannot be guessed from a row and duplicated columns are blocked",()=>{
 const missing=inspectImport("orders","id;company;correo;amount;status\nA;Acme;a@b.es;1;nuevo");
 assert.deepEqual(missing.missing,["pedido"]);
 assert.equal(missing.status,"mapping_required");
 assert.throws(()=>ensureImportReady(missing,true),/obligatorios/);
 const collision=inspectImport("orders",input,{...mapped,email:"company"});
 assert.equal(collision.status,"mapping_conflict");
 assert.throws(()=>ensureImportReady(collision,true),/misma columna/);
 const complete=inspectImport("orders",input,mapped);
 assert.equal(complete.status,"confirm_discards");
});
test("PR72: distinguish identical duplicates from conflicting records, no leaking row values",()=>{
 const same="pedido;cliente;email;total;estado\n001;Acme;a@b.es;10;nuevo\n001;Acme;a@b.es;10;nuevo";
 const clash="pedido;cliente;email;total;estado\n001;Acme;a@b.es;10;nuevo\n001;Other;a@b.es;20;nuevo";
 assert.deepEqual(inspectImport("orders",same).conflicts,[{line:3,kind:"duplicado idéntico"}]);
 assert.deepEqual(inspectImport("orders",clash).conflicts,[{line:3,kind:"conflicto de identificador"}]);
 assert.doesNotMatch(JSON.stringify(inspectImport("orders",clash).conflicts),/Acme|Other|a@b.es/);
});
test("PR72: refuse ambiguous locale groupings rather than invent conversion",()=>{
 for(const value of ["1.234","1,234","1.234,56","1,234.56"]){
  const amount='pedido;cliente;email;total;estado\n0007;Acme;a@b.es;"'+value+'";nuevo';
  const check=inspectImport("orders",amount);
  assert.equal(check.status,"regional_ambiguous",value);
  assert.deepEqual(check.ambiguousLines,[2]);
  assert.throws(()=>ensureImportReady(check,true),/Formato numérico ambiguo/);
 }
 for(const value of ["12.34","12,34","1250"]){
  const check=inspectImport("orders",'pedido;cliente;email;total;estado\n0007;Acme;a@b.es;"'+value+'";nuevo');
  assert.equal(check.status,"ready");
 }
 const data=inspectImport("data",'registro;fuente;valor;fecha\nR;CRM;"1.234";2026-10-01');
 assert.equal(data.status,"regional_ambiguous");
});
test("PR72: exporting a mapping profile contains no rows or customer records",()=>{
 const value=makeMappingProfile("orders",mapped);
 assert.match(value,/revops-mapping-profile-v1/);
 assert.deepEqual(Object.keys(JSON.parse(value)).sort(),["mapping","scenario","schema"]);
 assert.equal(value.includes("Acme"),false);
 assert.equal(value.includes("a@ejemplo.test"),false);
 const parsed=readMappingProfile(value,"orders",inspectImport("orders",input).headers);
 assert.deepEqual(parsed,mapped);
 assert.equal(runWorkflow("orders",normalizeMappedCsv("orders",input,parsed)).rows[0].id,"0007");
});
test("PR72: mapping profile rejects scope mismatch, collisions and stale headers",()=>{
 const profile=makeMappingProfile("orders",mapped);
 const headers=inspectImport("orders",input).headers;
 assert.throws(()=>readMappingProfile(profile,"support",headers),/no corresponde/);
 assert.throws(()=>readMappingProfile(profile,"orders",["pedido"]),/no contiene/);
 assert.throws(()=>readMappingProfile("{","orders",headers),/JSON válido/);
 assert.throws(()=>readMappingProfile("x".repeat(3001),"orders",headers),/demasiado grande/);
 assert.throws(()=>makeMappingProfile("orders",{...mapped,email:"company"}),/misma columna/);
 assert.throws(()=>makeMappingProfile("orders",{...mapped,email:""}),/Falta/);
 assert.throws(()=>makeMappingProfile("orders",{...mapped,email:"a\nb"}),/Falta/);
});
test("PR72: imported profile cannot use extra keys to change the scenario",()=>{
 const profile=JSON.parse(makeMappingProfile("orders",mapped));
 profile.mapping.cliente="internal note";
 assert.deepEqual(readMappingProfile(JSON.stringify(profile),"orders",inspectImport("orders",input).headers).cliente,"internal note");
 // Unrelated props never enter the generated canonical profile.
 profile.mapping.hacker="secret";
 const applied=readMappingProfile(JSON.stringify(profile),"orders",inspectImport("orders",input).headers);
 assert.equal("hacker" in applied,false);
});
test("PR72: all three existing sample workflows remain readable and nonexecuting",()=>{
 for(const scenario of ["orders","support","data"]){
  const check=inspectImport(scenario,SCENARIOS[scenario].sample);
  assert.equal(check.status,"ready");
  assert.equal(check.rows,6);
  assert.deepEqual(check.counts,{total:6,listo:3,revisar:1,bloqueado:2});
 }
});
