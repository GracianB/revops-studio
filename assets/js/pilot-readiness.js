// PR80 · Integrated, conservative preflight for a SUPERVISED DEMO ONLY.
// This is NOT production approval, a certification, a verified business KPI,
// or a permission to run actions in any connected third-party system.
import {SCENARIOS,runWorkflow,parseDelimited} from "./workflow-engine.js";
import {analyzeWorkflow} from "./workflow-insights.js";
import {buildQualityCockpit} from "./quality-cockpit.js";
import {inspectDataExposure} from "./privacy-security.js";
import {describePolicy} from "./workflow-policy.js";

const gate=(id,title,state,count,why,next,action)=>Object.freeze({id,title,state,count,why,next,action});
export const PILOT_ACTIONS=Object.freeze({
 blockers:"Corregir el primer bloqueo",
 human:"Inspeccionar reglas y excepciones",
 privacy:"Inspeccionar la privacidad del CSV",
 report:"Preparar informe agregado",
 result:"Revisar las acciones preparadas"
});
export function assessPilotReadiness(type,source,reported=null){
 if(!Object.hasOwn(SCENARIOS,type))throw Error("Escenario de preparación no reconocido.");
 const actual=runWorkflow(type,source);
 if(reported){
  if(reported.scenario!==type||reported.rows?.length!==actual.rows.length)
   throw Error("La instantánea no pertenece a estos datos. Vuelve a ejecutar el motor.");
  for(let i=0;i<actual.rows.length;i++){
   const a=actual.rows[i],b=reported.rows[i];
   if(a.status!==b.status||a.reason!==b.reason||a.action!==b.action||
      a.id!==b.id||SCENARIOS[type].columns.some(c=>a.values[c]!==b.values?.[c]))
    throw Error("Los resultados han cambiado. Ejecuta nuevamente antes de preparar el piloto.");
  }
 }
 const quality=buildQualityCockpit(type,source,actual);
 const policy=describePolicy(type,source,actual,parseDelimited);
 const risk=inspectDataExposure(actual),insights=analyzeWorkflow(actual);
 const flags=Object.freeze({
  total:actual.counts.total,prepared:insights.actionable,historical:insights.historical,
  blocked:actual.counts.bloqueado,review:actual.counts.revisar,
  completeness:quality.completeness,missingCells:quality.missingCells,
  conflicts:quality.flags.conflictingIds.count,duplicates:quality.flags.exactDuplicates.count,
  nonExampleEmails:risk.nonExampleEmails,formulaLike:risk.formulaLike,
  rulesApplied:policy.catalog.filter(r=>r.applied).length,overlaps:policy.overlapCount
 });
 const checks=Object.freeze([
  gate("PIL-01","Formato y reglas coherentes","pass",flags.total,
   "La entrada se ha procesado y la trazabilidad coincide con el motor determinista.",
   "Conservar la misma muestra para las siguientes comprobaciones.","result"),
  gate("PIL-02","Bloqueos por resolver",flags.blocked?"blocked":"pass",flags.blocked,
   flags.blocked?"Hay registros que no cumplen reglas obligatorias.":"No quedan bloqueos de validación.",
   flags.blocked?"Corregir y volver a ejecutar.":"Mantener el control de entradas.","blockers"),
  gate("PIL-03","Criterio humano",flags.review?"attention":"pass",flags.review,
   flags.review?"Existen casos que requieren una decisión humana no automatizada.":"No quedan excepciones humanas en la muestra.",
   flags.review?"Revisar las excepciones, sin tratar la aprobación simulada como real.":"Conservar una revisión supervisada.","human"),
  gate("PIL-04","Datos sensibles y fórmulas",risk.requiresCare?"attention":"pass",
   flags.nonExampleEmails+flags.formulaLike+risk.controlCells,
   risk.requiresCare?"Se detectan indicadores de datos no ficticios o contenido que exige cautela.":"No hay indicadores evidentes de datos no ficticios o fórmulas.",
   risk.requiresCare?"Sustituir por datos ficticios y revisar cualquier CSV detallado.":"Inspeccionar la exportación antes de compartir.","privacy"),
  gate("PIL-05","Integridad de campos",flags.missingCells?"attention":"pass",flags.missingCells,
   flags.missingCells?"Hay celdas vacías. Completitud no implica exactitud.":"No se detectan celdas vacías.",
   flags.missingCells?"Completar datos o justificar su ausencia.":"Verificar exactitud con una fuente autorizada.","result"),
  gate("PIL-06","Propuestas útiles",flags.prepared?"pass":"attention",flags.prepared,
   flags.prepared?"Hay propuestas que pueden estudiarse sin ejecutarlas.":"No hay acciones nuevas preparadas para probar.",
   flags.prepared?"Exportar una cola solo después de supervisión.":"Revisar alcance y caso de prueba.","result"),
  gate("PIL-07","Conflictos de identificadores",flags.conflicts?"attention":"pass",flags.conflicts,
   flags.conflicts?"Hay claves duplicadas con contenido diferente.":"No se detectan identificadores contradictorios.",
   flags.conflicts?"Investigar los registros conflictivos sin perder su origen.":"Mantener control de unicidad.","blockers"),
  gate("PIL-08","Protección de ejecución externa","pass",0,
   "Esta evaluación no realiza acciones, permisos, conexiones o aprobaciones empresariales.",
   "Exigir autorización real y validación técnica antes de cualquier despliegue.","report")
 ]);
 const blockers=checks.filter(c=>c.state==="blocked");
 const attentions=checks.filter(c=>c.state==="attention");
 const outcome=blockers.length?"requiere correcciones":
  attentions.length?"requiere revisión":"muestra apta para ensayo supervisado";
 return Object.freeze({
  schema:"revops-pilot-readiness-v1",scenario:type,
  scenarioTitle:SCENARIOS[type].title,metrics:flags,checks,
  outcome,passed:checks.filter(c=>c.state==="pass").length,
  attentions:attentions.length,blockers:blockers.length,
  suitableForSupervisedDemo:!blockers.length&&!attentions.length,
  actionsExecuted:0,realApprovals:0,remoteConnections:0,
  next:Object.freeze([
   "Resolver los bloqueos y dejar documentadas las decisiones humanas.",
   "Repetir las mismas comprobaciones con datos ficticios y controles de privacidad.",
   "Validar permisos, responsables, conexiones y posibilidad de reversión en un piloto autorizado.",
   "No extrapolar la demo a un ahorro económico o resultado operativo verificado."
  ]),
  disclaimer:"La evaluación solo valora una muestra local para su demostración supervisada. No certifica software de producción ni concede permisos de ejecución."
 });
}
export function pilotReadinessText(snapshot){
 if(snapshot?.schema!=="revops-pilot-readiness-v1")throw Error("Prepara antes una evaluación válida.");
 return [
  "REVOPS STUDIO | EVALUACIÓN PREVIA DE PILOTO (PR80)",
  "DEMO LOCAL, NO AUTORIZACIÓN NI CERTIFICACIÓN",
  "Escenario: "+snapshot.scenarioTitle,
  "Resultado: "+snapshot.outcome,
  "Comprobaciones correctas: "+snapshot.passed+" de "+snapshot.checks.length,
  "Advertencias: "+snapshot.attentions+" | Bloqueos: "+snapshot.blockers,
  "Registros: "+snapshot.metrics.total+" | Propuestas: "+snapshot.metrics.prepared+
   " | Revisiones: "+snapshot.metrics.review+" | Bloqueados: "+snapshot.metrics.blocked,
  "Completitud: "+snapshot.metrics.completeness+" % | Celdas vacías: "+snapshot.metrics.missingCells,
  "Indicadores de emails no ficticios: "+snapshot.metrics.nonExampleEmails,
  "Indicadores de fórmulas: "+snapshot.metrics.formulaLike,
  "Reglas efectivas: "+snapshot.metrics.rulesApplied+" | Restricciones simultáneas: "+snapshot.metrics.overlaps,
  "",
  "COMPROBACIONES",
  ...snapshot.checks.map(c=>c.id+" · "+c.title+" · "+c.state+" · "+
   c.count+" · "+c.why+" · "+c.next),
  "",
  "CONDICIONES DEL PRÓXIMO PASO",
  ...snapshot.next.map(c=>"- "+c),
  "",
  "Acciones externas ejecutadas: 0",
  "Aprobaciones reales verificadas: 0",
  "Conexiones externas activadas: 0",
  snapshot.disclaimer,
  "Documento solo con agregados y texto predefinido, sin filas, IDs, emails ni notas."
 ].join("\n")+"\n";
}
export function pilotReadinessJson(snapshot){
 if(snapshot?.schema!=="revops-pilot-readiness-v1")throw Error("Prepara antes una evaluación válida.");
 return JSON.stringify(snapshot,null,2)+"\n";
}
