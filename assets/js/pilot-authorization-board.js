// PR87 · Conservatively separate a supervised demonstration from production authority.
// Derived from the product's current safeguards; no signatures, tokens or external connections.
const POLICY=Object.freeze([
 ["BOARD-01","Calidad y reglas del CSV","Calidad de datos",
  "Corregir bloqueos y excepciones, volver a evaluar con datos ficticios."],
 ["BOARD-02","Privacidad y minimización","Privacidad",
  "Revisar identidades, fórmulas y cualquier exportación detallada."],
 ["BOARD-03","Riesgos operativos abiertos","Seguridad",
  "Documentar tratamiento de riesgos y evidencias fuera de esta demo."],
 ["BOARD-04","Evidencia y criterios de aceptación","Gobernanza",
  "Adjuntar y verificar pruebas en un repositorio empresarial autorizado."],
 ["BOARD-05","Ensayos defensivos de los controles","Integraciones",
  "Repetir pruebas independientes en infraestructura de ensayo autorizada."],
 ["BOARD-06","Conexiones y permisos externos","Integraciones",
  "Verificar conexiones, roles y permisos antes de activar cualquier integración."],
 ["BOARD-07","Reversión y continuidad","Integraciones",
  "Ensayar reversión real con resultados y responsables verificables."],
 ["BOARD-08","Autorización empresarial","Gobernanza",
  "Obtener aprobación expresa y trazable fuera de la aplicación."]
]);
const STATES=Object.freeze({
 demo:"Solo candidato a demostración supervisada",
 attention:"Revisión o corrección pendiente",
 external:"Verificación externa obligatoria",
 rehearsal:"Ensayo local completo; no prueba externa",
 not_run:"Ensayo local pendiente"
});
export function buildPilotAuthorizationBoard({readiness,plan,risks,ledger,drills=null}){
 if(readiness?.schema!=="revops-pilot-readiness-v1"||
   plan?.schema!=="revops-pilot-plan-v1"||
   risks?.schema!=="revops-pilot-risk-v1"||
   ledger?.schema!=="revops-pilot-evidence-v1"||
   [plan,risks,ledger,drills].filter(Boolean).some(x=>x.scenario!==readiness.scenario)||
   [readiness,plan,risks,ledger,drills].filter(Boolean).some(x=>
    x.realApprovals!==0&&x.approvedReal!==0)||
   readiness.actionsExecuted!==0||readiness.remoteConnections!==0||
   plan.externalExecutions!==0||risks.externalExecutions!==0||
   ledger.externalExecutions!==0||ledger.suppliedReal!==0||
   !Array.isArray(readiness.checks)||readiness.checks.length!==8||
   !Array.isArray(plan.tasks)||!Array.isArray(risks.risks)||
   !Array.isArray(ledger.entries)||
   !plan.tasks.some(t=>t.id==="SIGNOFF"&&t.locked)||
   !plan.tasks.some(t=>t.id==="ROLLBACK"))
  throw Error("El centro de autorización requiere módulos locales íntegros y sin aprobaciones.");
 if(drills&&(drills.schema!=="revops-pilot-drills-v1"||
   drills.externalExecutions!==0||
   !Array.isArray(drills.drills)||drills.drills.length!==7))
  throw Error("Informe de ensayos incompatible.");
 const anyPrivacy=readiness.checks.find(c=>c.id==="PIL-04")?.state!=="pass";
 const anyData=readiness.checks.some(c=>["PIL-01","PIL-02","PIL-03","PIL-05","PIL-06","PIL-07"].includes(c.id)&&c.state!=="pass");
 const drillsPassed=drills?.passed===7&&drills?.failed===0&&drills.drills.every(d=>d.passed);
 const entries=POLICY.map(([id,title,role,next],i)=>{
  const state=i===0?(anyData?"attention":"demo"):
   i===1?(anyPrivacy?"attention":"demo"):
   i===4?(!drills?"not_run":drillsPassed?"rehearsal":"attention"):"external";
  return Object.freeze({id,title,role,next,state,label:STATES[state],
   isRealApproval:false});
 });
 const toFix=readiness.checks.filter(c=>c.state!=="pass").map(c=>Object.freeze({
  gate:c.id,title:c.title,action:c.next,state:c.state,role:"Supervisión"}));
 return Object.freeze({
  schema:"revops-pilot-authorization-v1",scenario:readiness.scenario,
  outcome:"NO AUTORIZADO PARA PRODUCCIÓN",productionGo:false,
  supervisedDemoCandidate:Boolean(readiness.suitableForSupervisedDemo),
  gates:Object.freeze(entries),outstanding:entries.filter(x=>x.state==="attention"||x.state==="external"||x.state==="not_run").length,
  remediation:Object.freeze(toFix),unresolvedRiskCount:risks.risks.length,
  unverifiedEvidenceCount:ledger.entries.length,
  localDrills:drills?Object.freeze({run:true,passed:drills.passed,failed:drills.failed}):
   Object.freeze({run:false,passed:0,failed:0}),
  realApprovals:0,realEvidence:0,externalExecutions:0,
  disclaimer:"El estado NO-GO es deliberado: las muestras, informes y ensayos no autorizan un despliegue. Sólo un proceso externo independiente puede levantar estos bloqueos."
 });
}
export function pilotAuthorizationJson(board){
 if(board?.schema!=="revops-pilot-authorization-v1"||board.productionGo!==false||
   board.realApprovals!==0||board.realEvidence!==0||board.externalExecutions!==0||
   !Array.isArray(board.gates)||board.gates.length!==8||
   !Array.isArray(board.remediation))
  throw Error("No se puede exportar una autorización real desde la demo.");
 return JSON.stringify({
  schema:board.schema,scenario:board.scenario,
  outcome:"NO AUTORIZADO PARA PRODUCCIÓN",productionGo:false,
  supervisedDemoCandidate:board.supervisedDemoCandidate,
  gates:board.gates.map(({id,title,role,next,state,label})=>({id,title,role,next,state,label})),
  outstanding:board.outstanding,
  remediation:board.remediation.map(({gate,title,action,state,role})=>({gate,title,action,state,role})),
  unresolvedRiskCount:board.unresolvedRiskCount,
  unverifiedEvidenceCount:board.unverifiedEvidenceCount,localDrills:board.localDrills,
  realApprovals:0,realEvidence:0,externalExecutions:0,disclaimer:board.disclaimer
 },null,2)+"\n";
}
