// PR75 · Ephemeral, simulated human decision ledger.
// Approval is an annotation, never permission to send, change engine status,
// export an actionable queue or assert verified operator identity.
const cleanNote=value=>String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,241);
export function createHumanReviewLedger(result){
 if(!result?.rows||!result.scenario)throw Error("Ejecuta un proceso antes de revisar.");
 const allowed=new Map(result.rows.map((r,i)=>[i,{status:r.status,reason:r.reason}])
  .filter(([,row])=>row.status==="revisar"));
 const ledger=new Map();
 function state(index){
  if(!allowed.has(index))return null;
  const value=ledger.get(index);
  return Object.freeze({index,status:value?.status||"pendiente",notePresent:Boolean(value?.note),
   sourceStatus:"revisar",requiresHuman:true,externalExecuted:0});
 }
 const statuses=["en revisión","aprobación simulada","rechazada"];
 function set(index,status,note=""){
  if(!Number.isInteger(index)||!allowed.has(index))throw Error("Solo las excepciones pendientes admiten decisión humana.");
  if(!statuses.includes(status))throw Error("Estado de revisión no permitido.");
  const cleaned=cleanNote(note);
  if(String(note??"").trim().length>240||cleaned.length>240)throw Error("La nota debe tener un máximo de 240 caracteres.");
  if((status==="aprobación simulada"||status==="rechazada")&&cleaned.length<12)
   throw Error("Una aprobación simulada o rechazo requiere una justificación de al menos 12 caracteres.");
  ledger.set(index,{status,note:cleaned});
  return state(index);
 }
 function summary(){
  const counts={"pendiente":0,"en revisión":0,"aprobación simulada":0,"rechazada":0};
  for(const index of allowed.keys())counts[state(index).status]++;
  return Object.freeze({...counts,total:allowed.size,externalExecuted:0,
   engineReviewCount:allowed.size,realApprovals:0});
 }
 function list(){
  return Object.freeze([...allowed.keys()].map(i=>state(i)));
 }
 function reset(){
  ledger.clear();
  return summary();
 }
 return Object.freeze({state,set,summary,list,reset});
}
export function humanDecisionReport(policy,ledger){
 if(!policy?.catalog||!ledger?.summary)throw Error("Necesitas un análisis de reglas y revisión humana.");
 const summary=ledger.summary();
 if(summary.total!==policy.pendingHuman)throw Error("Las aprobaciones corresponden a otro conjunto. Reinicia la revisión.");
 return [
  "REVOPS STUDIO | RULES & HUMAN DECISION STUDIO PR75",
  "Simulación local, evidencia agregada, sin filas, IDs, valores ni notas de participantes.",
  "Escenario: "+policy.scenario,
  "Registros: "+policy.total,
  "Reglas evaluadas: "+policy.catalog.length,
  "Reglas con aplicación: "+policy.catalog.filter(x=>x.applied).length,
  "Registros con restricciones simultáneas: "+policy.overlapCount,
  "Revisión humana pendiente según motor: "+policy.pendingHuman,
  "Bandeja pendiente sin actuación: "+summary.pendiente,
  "Casos en revisión simulada: "+summary["en revisión"],
  "Anotaciones de aprobación simulada: "+summary["aprobación simulada"],
  "Rechazos simulados: "+summary.rechazada,
  "Aprobaciones reales verificadas: 0",
  "Acciones externas ejecutadas: 0",
  "",
  "COBERTURA DE REGLAS Y PRECEDENCIA",
  ...policy.catalog.map(rule=>rule.id+" · prioridad "+rule.position+
   " · "+rule.status+" · aplicaciones "+rule.applied+" · restricciones en segundo plano "+rule.shadowed),
  "",
  "ACLARACIONES",
  "Una anotación de aprobación simulada no cambia bloqueos ni estados del motor.",
  "Las revisiones humanas no entran en la cola de acciones preparadas.",
  "El documento es agregado: los textos libres, identificadores y valores introducidos no se exportan.",
  "El catálogo representa reglas demostrativas, no autorizaciones, identidades ni aprobaciones reales."
 ].join("\n")+"\n";
}
