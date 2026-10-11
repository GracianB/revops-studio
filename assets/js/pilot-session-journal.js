// PR93 · Bounded, content-free in-memory interaction journal.
// It is an interface history, NEVER an audit trail of business decisions.
export const PILOT_EVENT_TYPES=Object.freeze({
 evidence_mark:"Requisito ensayado localmente",
 evidence_unmark:"Ensayo de requisito revertido",
 drill_run:"Ensayos defensivos locales ejecutados",
 capacity_change:"Hipótesis de capacidad cambiada",
 severity_filter:"Filtro de riesgos modificado",
 route_navigation:"Destino de acción guiada abierto",
 route_export:"Ruta supervisada exportada",
 report_export:"Revisión agregada JSON exportada",
 handoff_export:"Informe local de revisión exportado",
 atlas_run:"Atlas de pruebas sintéticas ejecutado",
 atlas_export:"Atlas de pruebas sintéticas exportado",
 reset:"Ensayos locales reiniciados"
});
export const PILOT_AUDIT_LIMIT=32;
export function createPilotSessionJournal(){
 let sequence=0,dropped=0,history=[];
 const assertType=type=>{
  if(typeof type!=="string"||!Object.hasOwn(PILOT_EVENT_TYPES,type))
   throw Error("Evento local fuera del catálogo de auditoría.");
 };
 const snapshot=()=>Object.freeze({
  schema:"revops-pilot-session-journal-v1",
  entries:Object.freeze(history.map(item=>Object.freeze({...item}))),
  visible:history.length,discarded:dropped,
  realApprovals:0,externalExecutions:0,
  disclaimer:"Historial efímero de interacción. No es evidencia empresarial, registro de accesos ni autorización real."
 });
 return Object.freeze({
  add(type){
   assertType(type);
   sequence++;
   history.push({sequence,type,label:PILOT_EVENT_TYPES[type]});
   if(history.length>PILOT_AUDIT_LIMIT){history.shift();dropped++;}
   return snapshot();
  },
  snapshot,
  clear(){history=[];sequence=0;dropped=0;return snapshot();}
 });
}
export function pilotSessionJournalJson(record){
 if(record?.schema!=="revops-pilot-session-journal-v1"||
   record.realApprovals!==0||record.externalExecutions!==0||
   !Array.isArray(record.entries)||record.entries.length>PILOT_AUDIT_LIMIT||
   !Number.isInteger(record.discarded)||record.discarded<0)
  throw Error("Historial local no exportable.");
 let previous=0;
 const entries=record.entries.map(e=>{
  if(!Number.isInteger(e.sequence)||e.sequence<=previous||
    !Object.hasOwn(PILOT_EVENT_TYPES,e.type)||
    e.label!==PILOT_EVENT_TYPES[e.type])throw Error("Historial local alterado.");
  previous=e.sequence;
  return {sequence:e.sequence,type:e.type,label:e.label};
 });
 return JSON.stringify({schema:record.schema,entries,
  visible:entries.length,discarded:record.discarded,
  realApprovals:0,externalExecutions:0,disclaimer:record.disclaimer},null,2)+"\n";
}
