// PR83 · Evidence obligations, not approval records. Only predefined catalogue text.
const KINDS=Object.freeze({
 SCOPE:"Alcance",OWNERS:"Gobernanza",BLOCKS:"Validación",CONFLICTS:"Trazabilidad",
 MISSING:"Calidad",PRIVACY:"Privacidad",HUMAN:"Revisión humana",VALUE:"Medición",
 SECURITY:"Seguridad",ACCESS:"Accesibilidad",CONNECT:"Integración aislada",
 OBSERVE:"Observabilidad",ROLLBACK:"Recuperación",SIGNOFF:"Autorización externa"
});
export function buildPilotEvidenceLedger(plan,risks){
 if(plan?.schema!=="revops-pilot-plan-v1"||
  risks?.schema!=="revops-pilot-risk-v1"||plan.scenario!==risks.scenario||
  !Array.isArray(plan.tasks)||!Array.isArray(risks.risks)||
  plan.realApprovals!==0||risks.realApprovals!==0||
  plan.externalExecutions!==0||risks.externalExecutions!==0)
  throw Error("El libro de evidencias necesita plan y riesgos compatibles.");
 const ids=new Set(plan.tasks.map(t=>t.id));
 if(ids.size!==plan.tasks.length||!ids.has("SIGNOFF"))
  throw Error("Faltan tareas o autorización externa.");
 const entries=plan.tasks.map(t=>{
  if(!Object.hasOwn(KINDS,t.id)||typeof t.evidence!=="string"||!t.evidence.trim())
   throw Error("Criterio de aceptación ausente o desconocido.");
  const linked=risks.risks.filter(r=>r.task===t.id).map(r=>r.id);
  return Object.freeze({id:"E-"+t.id,task:t.id,role:t.role,
   requirement:t.evidence,kind:KINDS[t.id],risks:Object.freeze(linked),
   state:"evidencia_no_aportada",externalOnly:Boolean(t.locked)||t.id==="SIGNOFF"});
 });
 return Object.freeze({schema:"revops-pilot-evidence-v1",
  scenario:plan.scenario,entries:Object.freeze(entries),required:entries.length,
  suppliedReal:0,approvedReal:0,externalExecutions:0,
  disclaimer:"Esta lista es una solicitud de pruebas, no una prueba recibida ni verificada."});
}
export function simulateEvidenceCoverage(ledger,simulated=[]){
 if(ledger?.schema!=="revops-pilot-evidence-v1"||!Array.isArray(ledger.entries)||
  !Array.isArray(simulated)||simulated.length>ledger.entries.length)
  throw Error("Libro o selección no válida.");
 const index=new Map(ledger.entries.map(e=>[e.id,e]));
 if(index.size!==ledger.entries.length)throw Error("Entradas duplicadas.");
 const chosen=new Set();
 for(const id of simulated){
  if(!index.has(id)||chosen.has(id)||index.get(id).externalOnly)
   throw Error("Una firma o evidencia externa no puede ser simulada.");
  chosen.add(id);
 }
 return Object.freeze({schema:"revops-evidence-coverage-v1",
  rehearsalIds:Object.freeze([...chosen]),rehearsed:chosen.size,
  missing:ledger.required-chosen.size,
  realEvidenceSupplied:0,realApprovals:0,externalExecutions:0,
  status:"Lista ensayada localmente; requisitos empresariales siguen sin verificar."});
}
export function evidencePacketJson(ledger,coverage=simulateEvidenceCoverage(ledger)){
 if(ledger?.schema!=="revops-pilot-evidence-v1"||
  coverage?.schema!=="revops-evidence-coverage-v1"||
  coverage.realEvidenceSupplied!==0||coverage.realApprovals!==0||
  coverage.externalExecutions!==0)
  throw Error("La exportación no admite aprobaciones o evidencias reales.");
 const items=ledger.entries.map(({id,task,role,requirement,kind,risks,externalOnly})=>({
  id,task,role,requirement,kind,risks:[...risks],externalOnly,
  rehearsalOnly:coverage.rehearsalIds.includes(id)
 }));
 return JSON.stringify({schema:ledger.schema,scenario:ledger.scenario,
  items,realEvidenceSupplied:0,realApprovals:0,externalExecutions:0,
  disclaimer:ledger.disclaimer},null,2)+"\n";
}
