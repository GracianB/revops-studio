// PR76 · Safe candidate scenario simulations. The baseline engine is immutable.
// Candidate rules may ONLY add human review to records already marked "listo".
// Blocked, already-reviewing and historical rows can never be promoted.
import {SCENARIOS,runWorkflow} from "./workflow-engine.js";
import {analyzeWorkflow} from "./workflow-insights.js";

export const SCENARIO_PRESETS=Object.freeze({
 base:Object.freeze({orders:Object.freeze({reviewBelow:0}),support:Object.freeze({escalateMedium:false}),data:Object.freeze({reviewAbove:5000})}),
 cautious:Object.freeze({orders:Object.freeze({reviewBelow:500}),support:Object.freeze({escalateMedium:true}),data:Object.freeze({reviewAbove:350})}),
 strict:Object.freeze({orders:Object.freeze({reviewBelow:1000}),support:Object.freeze({escalateMedium:true}),data:Object.freeze({reviewAbove:200})})
});
export const SCENARIO_POLICY_LABELS=Object.freeze({
 orders:"Pedidos nuevos preparados con importe inferior al límite pasarán a revisión humana",
 support:"Tickets abiertos de prioridad media pasarán a revisión humana",
 data:"Registros consistentes con valor superior al límite pasarán a revisión humana"
});
const isType=type=>Object.hasOwn(SCENARIOS,type);
export function normalizeScenarioSettings(type,input){
 if(!isType(type))throw Error("Escenario no reconocido.");
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Configuración de candidato no válida.");
 const name=type==="orders"?"reviewBelow":type==="support"?"escalateMedium":"reviewAbove";
 if(Object.keys(input).length!==1||!Object.hasOwn(input,name))throw Error("Solo se admite el control de reglas documentado.");
 const value=input[name];
 if(type==="support"){
  if(typeof value!=="boolean")throw Error("La revisión de prioridad media debe ser verdadera o falsa.");
 }else if(!Number.isInteger(value)||value<0||value>5000){
  throw Error("El umbral debe ser un número entero entre 0 y 5000.");
 }
 return Object.freeze({[name]:value});
}
export function presetFor(type,preset){
 if(!isType(type)||!Object.hasOwn(SCENARIO_PRESETS,preset))throw Error("Plantilla de escenario no reconocida.");
 return normalizeScenarioSettings(type,SCENARIO_PRESETS[preset][type]);
}
function numeric(value){
 const raw=String(value??"").trim();
 return /^-?\d+(?:[.,]\d{1,2})?$/.test(raw)?Number(raw.replace(",",".")):NaN;
}
function eligible(type,row,settings){
 if(row.status!=="listo"||/histórico/i.test(row.action))return false;
 if(type==="orders")return numeric(row.values.total)<settings.reviewBelow;
 if(type==="support")return row.values.prioridad.trim().toLocaleLowerCase("es-ES")==="media"&&
  row.values.estado.trim().toLocaleLowerCase("es-ES")==="abierto"&&settings.escalateMedium;
 return numeric(row.values.valor)>settings.reviewAbove;
}
export function simulateCandidate(type,source,input){
 const settings=normalizeScenarioSettings(type,input);
 const baseline=runWorkflow(type,source);
 let changed=0;
 const candidateRows=baseline.rows.map((row,index)=>{
  if(!eligible(type,row,settings))return {...row,values:{...row.values}};
  changed++;
  return {...row,values:{...row.values},status:"revisar",
   reason:"Regla de escenario PR76: revisión adicional antes de cualquier acción",
   action:"Revisión manual de candidato. No ejecutar en sistemas externos",
   candidateRule:type==="orders"?"CAND-ORD-01":type==="support"?"CAND-SUP-01":"CAND-DAT-01"};
 });
 const counts={total:candidateRows.length,listo:0,revisar:0,bloqueado:0};
 for(const row of candidateRows)counts[row.status]++;
 const candidate={
  scenario:type,columns:baseline.columns,rows:candidateRows,counts,
  steps:baseline.steps.map(step=>({
   ...step,count:step.name==="Revisión"?counts.revisar:
    step.name==="Salida"?counts.listo:step.count
  }))
 };
 // Guardrails verified on every run. No exception can be magically promoted.
 for(let i=0;i<baseline.rows.length;i++){
  const before=baseline.rows[i],after=candidate.rows[i];
  if((before.status==="bloqueado"&&after.status!=="bloqueado")||
   (before.status==="revisar"&&after.status!=="revisar")||
   (/histórico/i.test(before.action)&&after.status!==before.status)||
   (after.status==="listo"&&before.status!=="listo"))
   throw Error("Regla insegura: el candidato intentó evitar un bloqueo o una decisión humana.");
 }
 const original=analyzeWorkflow(baseline),proposed=analyzeWorkflow(candidate);
 const countsByOutcome=Object.freeze({
  newlyReview:changed,alreadyReview:baseline.counts.revisar,
  preservedBlocked:counts.bloqueado,preservedHistorical:original.historical,
  stillPrepared:proposed.actionable
 });
 const delta=Object.freeze({
  prepared:proposed.actionable-original.actionable,
  review:counts.revisar-baseline.counts.revisar,
  blocked:counts.bloqueado-baseline.counts.bloqueado,
  historical:proposed.historical-original.historical
 });
 return Object.freeze({
  type,settings,baseline,candidate,countsByOutcome,delta,
  changedIndexes:Object.freeze(candidate.rows.flatMap((row,i)=>row.candidateRule?[i]:[])),
  comparable:true,externalExecuted:0,realApprovals:0,
  limits:"El candidato solo eleva casos válidos a revisión humana. Nunca desbloquea errores, elude revisiones, reabre históricos ni ejecuta acciones externas."
 });
}
export function encodeScenarioTemplate(type,settings){
 const normalized=normalizeScenarioSettings(type,settings);
 return JSON.stringify({
  schema:"revops-scenario-settings-v1",scenario:type,settings:normalized,
  execution:"NOT_EXECUTED"
 },null,2);
}
export function decodeScenarioTemplate(raw,type){
 if(typeof raw!=="string"||raw.length>1200)throw Error("La plantilla de escenario es inválida o supera 1.200 caracteres.");
 let parsed;
 try{parsed=JSON.parse(raw);}catch{throw Error("La plantilla no contiene JSON válido.");}
 if(!parsed||parsed.schema!=="revops-scenario-settings-v1"||parsed.scenario!==type||
  parsed.execution!=="NOT_EXECUTED"||Object.keys(parsed).length!==4)
  throw Error("La plantilla no corresponde al escenario actual.");
 return normalizeScenarioSettings(type,parsed.settings);
}
export function scenarioComparisonReport(result){
 if(!result?.comparable||!result.baseline||!result.candidate)throw Error("Ejecuta una simulación de candidato.");
 return [
  "REVOPS STUDIO | ESCENARIOS DE PRUEBA PR76",
  "Configuración y resultado agregado. Sin filas, IDs, emails ni datos importados.",
  "Escenario: "+result.type,
  "Control: "+SCENARIO_POLICY_LABELS[result.type],
  "Casos que pasan adicionalmente a revisión: "+result.countsByOutcome.newlyReview,
  "Revisiones humanas previas preservadas: "+result.countsByOutcome.alreadyReview,
  "Bloqueos preservados: "+result.countsByOutcome.preservedBlocked,
  "Históricos preservados: "+result.countsByOutcome.preservedHistorical,
  "Propuestas preparadas en candidato: "+result.countsByOutcome.stillPrepared,
  "Diferencia de preparados: "+result.delta.prepared,
  "Diferencia de revisiones: "+result.delta.review,
  "Diferencia de bloqueos: "+result.delta.blocked,
  "Cambios externos ejecutados: 0",
  "Aprobaciones reales verificadas: 0",
  result.limits,
  "La comparación se basa en la misma muestra sintética o local, sin causalidad ni ROI medido."
 ].join("\n")+"\n";
}
