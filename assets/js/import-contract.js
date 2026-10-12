// RevOps PR72: local, fail-closed import contract. No network, no persistence.
import {SCENARIOS,parseDelimited,runWorkflow} from "./workflow-engine.js";
import {suggestMapping,normalizeMappedCsv} from "./column-mapper.js";
import {validateTextBoundary} from "./privacy-security.js";
const MAX_BYTES=32000,MAX_CHARS=12000,MAX_ROWS=80;
const idKey={orders:"pedido",support:"ticket",data:"registro"};
const amountKey={orders:"total",data:"valor"};
const dataKey=value=>String(value??"").trim().toLocaleLowerCase("es-ES");
const errors=(message)=>{throw Error(message);};
function canonical(source) {
 if(typeof source!=="string"||!source.trim())errors("El archivo está vacío.");
 if(source.length>MAX_CHARS)errors("Más de 12.000 caracteres. Divide el archivo antes de importarlo.");
 if(source.includes("\u0000"))errors("El contenido contiene caracteres nulos o una codificación incompatible.");
 if(source.includes("\uFFFD"))errors("Hay caracteres de reemplazo: comprueba que el archivo esté en UTF-8.");
 if(/[\u0001-\u0008\u000b\u000c\u000e-\u001f]/.test(source))errors("El archivo contiene caracteres de control no admitidos.");
 return validateTextBoundary(source.replace(/^\uFEFF/,""));
}
export function decodeImportBytes(value) {
 if(!(value instanceof Uint8Array))errors("La entrada debe ser un archivo binario.");
 if(value.byteLength>MAX_BYTES)errors("Archivo demasiado grande. Límite de 32 KB.");
 if(value.byteLength===0)errors("El archivo está vacío.");
 if(value[0]===0xff&&value[1]===0xfe || value[0]===0xfe&&value[1]===0xff)errors("El archivo está en UTF-16. Expórtalo como CSV UTF-8.");
 if(value[0]===0xef&&value[1]===0xbb&&value[2]!==0xbf)errors("BOM UTF-8 incompleto. Vuelve a exportar el archivo.");
 let text;
 try{text=new TextDecoder("utf-8",{fatal:true,ignoreBOM:false}).decode(value);}
 catch{errors("Codificación no válida: guarda el archivo como UTF-8 sin pérdida de caracteres.");}
 return canonical(text);
}
function delimiterOf(text) {
 const header=text.split(/\r?\n/,1)[0];
 let quotes=false,comma=0,semi=0,tab=0;
 for(let i=0;i<header.length;i++){
  if(header[i]==='"') {if(quotes&&header[i+1]==='"')i++;else quotes=!quotes;}
  else if(!quotes){if(header[i]===",")comma++;else if(header[i]===";")semi++;else if(header[i]==="\t")tab++;}
 }
 const character=tab>Math.max(comma,semi)?"\t":semi>comma?";":",";
 return {character,label:character==="\t"?"TSV (tabulaciones)":character===";"?"CSV (punto y coma)":"CSV (comas)"};
}
export function inspectImport(type,source,mapping=null) {
 if(!Object.hasOwn(SCENARIOS,type))errors("Escenario de importación no reconocido.");
 const text=canonical(source);
 const parsed=parseDelimited(text);
 if(parsed.rows.length>MAX_ROWS)errors("Máximo 80 registros por ejecución.");
 const suggested=suggestMapping(type,text);
 const chosen=mapping||suggested.mapping;
 const missing=SCENARIOS[type].columns.filter(name=>!chosen[name]||!parsed.headers.includes(chosen[name]));
 const used=SCENARIOS[type].columns.map(name=>chosen[name]).filter(Boolean);
 const duplicates=used.filter((name,i)=>used.indexOf(name)!==i);
 const ignored=parsed.headers.filter(name=>!used.includes(name));
 const idName=chosen[idKey[type]];
 const keyCounts=new Map(),conflicts=[];
 if(idName&&parsed.headers.includes(idName)){
  for(const row of parsed.rows){
   const id=dataKey(row[idName]);if(!id)continue;
   const signature=SCENARIOS[type].columns.map(c=>String(row[chosen[c]]??"").trim()).join("\u001f");
   const last=keyCounts.get(id);
   if(last)conflicts.push({line:row._line,kind:last.signature===signature?"duplicado idéntico":"conflicto de identificador"});
   else keyCounts.set(id,{signature});
  }
 }
 const amountName=chosen[amountKey[type]];
 const ambiguous=[];
 if(amountName&&parsed.headers.includes(amountName))for(const row of parsed.rows){
  const v=String(row[amountName]||"").trim();
  // 1.234 and 1,234 could mean thousands or decimals. Reject silently guessed conversions.
  if(/^-?\d{1,3}[.,]\d{3}$/.test(v)||/^-?\d{1,3}(?:[.,]\d{3})+[.,]\d{1,2}$/.test(v))
   ambiguous.push(row._line);
 }
 const verdict=missing.length?"mapping_required":duplicates.length?"mapping_conflict":
  ambiguous.length?"regional_ambiguous":ignored.length?"confirm_discards":"ready";
 let outcome=null;
 if(!missing.length&&!duplicates.length&&!ambiguous.length){
  const transformed=normalizeMappedCsv(type,text,chosen);
  outcome=runWorkflow(type,transformed);
 }
 return Object.freeze({
  format:delimiterOf(text).label,delimiter:delimiterOf(text).character,
  headers:Object.freeze([...parsed.headers]),rows:parsed.rows.length,
  mapping:Object.freeze({...chosen}),
  matches:Object.freeze({...suggested.matches}),
  missing:Object.freeze(missing),duplicates:Object.freeze([...new Set(duplicates)]),
  ignored:Object.freeze(ignored),conflicts:Object.freeze(conflicts),
  ambiguousLines:Object.freeze(ambiguous),status:verdict,
  counts:outcome?Object.freeze({...outcome.counts}):null,
  // Previews may contain user data: show only when explicitly importing locally, never in URLs or aggregate reports.
  preview:Object.freeze(outcome?outcome.rows.slice(0,3).map(row=>Object.freeze({
   line:row.line,status:row.status,reason:row.reason,values:Object.freeze({...row.values})
  })):[])
 });
}
export function ensureImportReady(check,confirmedDiscard=false) {
 if(check?.status==="mapping_required")errors("Hay campos obligatorios sin relacionar.");
 if(check?.status==="mapping_conflict")errors("Una misma columna no puede ocupar dos campos.");
 if(check?.status==="regional_ambiguous")errors("Formato numérico ambiguo en filas "+check.ambiguousLines.join(", ")+". Corrige separadores decimales antes de importar.");
 if(check?.ignored?.length&&!confirmedDiscard)errors("Confirma expresamente las columnas que se omitirán antes de aplicar el mapeo.");
 if(!check||!["ready","confirm_discards"].includes(check.status))errors("Importación pendiente de validar.");
 return true;
}
export function makeMappingProfile(type,mapping) {
 if(!SCENARIOS[type]||!mapping||typeof mapping!=="object"||Array.isArray(mapping))errors("Perfil de correspondencias no válido.");
 const obj={};
 for(const column of SCENARIOS[type].columns){
  const from=mapping[column];
  if(typeof from!=="string"||!from||from.length>100||/[\r\n\0]/.test(from))errors("Falta una correspondencia válida para «"+column+"».");
  obj[column]=from;
 }
 if(new Set(Object.values(obj)).size!==Object.keys(obj).length)errors("Una misma columna no puede ocupar dos campos.");
 return JSON.stringify({schema:"revops-mapping-profile-v1",scenario:type,mapping:obj},null,2);
}
export function readMappingProfile(source,type,headers) {
 if(typeof source!=="string"||source.length>3000)errors("Perfil inválido o demasiado grande.");
 let input;
 try{input=JSON.parse(source);}catch{errors("El perfil no es JSON válido.");}
 if(!input||input.schema!=="revops-mapping-profile-v1"||input.scenario!==type)errors("El perfil no corresponde al proceso actual.");
 const normalized=JSON.parse(makeMappingProfile(type,input.mapping));
 const unknown=Object.values(normalized.mapping).filter(col=>!headers.includes(col));
 if(unknown.length)errors("El archivo no contiene: "+unknown.join(", ")+". Revisa el mapeo.");
 return normalized.mapping;
}
