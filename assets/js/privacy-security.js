// PR79 · No telemetry, no third-party processing and no persistent storage.
// Outputs are aggregate only, except secureCsvCell which is used exclusively
// for explicitly requested full-record CSV files.
export const REVOPS_SESSION_KEYS=Object.freeze([
 "revops-studio:demo:handoff",
 "revops-studio:p74:view-v1"
]);
const RISK_LEADING=/^[\s\u200b-\u200f\u2060\u202a-\u202e\u2066-\u2069\ufeff]*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]/u;
const SUSPICIOUS_CONTROLS=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;
const EXAMPLE_SUFFIX=/@(?:ejemplo|example)\.(?:test|invalid)$/i;
const EMAIL_TOKEN=/\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
export function isSpreadsheetFormula(value){
 if(typeof value!=="string")return false;
 return RISK_LEADING.test(value);
}
export function secureCsvCell(value){
 const raw=String(value??"");
 // Apostrophe is plain text in spreadsheet import; never eval an active prefix.
 const guarded=isSpreadsheetFormula(raw)?"'"+raw:raw;
 return '"'+guarded.replace(/"/g,'""')+'"';
}
export function validateTextBoundary(text){
 if(typeof text!=="string")throw Error("Solo se admite texto en UTF-8.");
 if(SUSPICIOUS_CONTROLS.test(text))
  throw Error("Hay caracteres invisibles de control o formato no permitidos. Limpia los datos antes de importarlos.");
 return text;
}
export function inspectDataExposure(result){
 if(!result?.rows||!Array.isArray(result.columns))
  throw Error("Ejecuta y revisa un proceso válido antes de auditar la privacidad.");
 const totals={records:result.rows.length,columns:result.columns.length,
  cells:0,emails:0,nonExampleEmails:0,formulaLike:0,
  longCells:0,controlCells:0,manualReview:0,blocked:0,actionable:0};
 for(const row of result.rows){
  if(row.status==="revisar")totals.manualReview++;
  else if(row.status==="bloqueado")totals.blocked++;
  else if(row.status==="listo"&&!/histórico/i.test(row.action))totals.actionable++;
  for(const column of result.columns){
   const value=String(row.values?.[column]??"");
   totals.cells++;
   if(isSpreadsheetFormula(value))totals.formulaLike++;
   if(SUSPICIOUS_CONTROLS.test(value))totals.controlCells++;
   if(value.length>200)totals.longCells++;
   for(const match of value.matchAll(EMAIL_TOKEN)){
    totals.emails++;
    if(!EXAMPLE_SUFFIX.test(match[0]))totals.nonExampleEmails++;
   }
  }
 }
 return Object.freeze({
  ...totals,
  fullCsvContainsRows:true,
  safeAggregateReportAvailable:true,
  requiresCare:totals.nonExampleEmails>0||totals.formulaLike>0||totals.controlCells>0,
  externallyTransmitted:0,telemetryRecorded:0
 });
}
export function clearRevopsSession(store){
 const outcome={attempted:REVOPS_SESSION_KEYS.length,cleared:0,unavailable:false};
 if(!store||typeof store.removeItem!=="function"){
  return Object.freeze({...outcome,unavailable:true});
 }
 for(const key of REVOPS_SESSION_KEYS){
  try{store.removeItem(key);outcome.cleared++;}
  catch{outcome.unavailable=true;}
 }
 return Object.freeze(outcome);
}
export function auditLocalDependencies(manifest){
 if(!manifest||!Array.isArray(manifest.scripts)||!Array.isArray(manifest.styles))
  throw Error("El manifiesto de dependencias está incompleto.");
 const list=[...manifest.scripts,...manifest.styles];
 const remote=list.filter(url=>/^https?:\/\//i.test(url)||/^\/\//.test(url));
 const invalid=list.filter(url=>typeof url!=="string"||url.includes("javascript:")||url.includes("data:"));
 return Object.freeze({
  assets:list.length,remote:remote.length,invalid:invalid.length,
  pass:remote.length===0&&invalid.length===0
 });
}
