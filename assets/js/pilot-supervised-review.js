// PR95 · Cross-module acceptance checklist. Explicitly NOT a release certificate.
const LOCAL=Object.freeze([
 ["REV-01","Integridad del origen","Calidad de datos"],
 ["REV-02","Bloqueos y excepciones resueltos","Operaciones"],
 ["REV-03","Privacidad de la muestra","Privacidad"],
 ["REV-04","Registro de riesgos trazable","Seguridad"],
 ["REV-05","Requisitos de evidencia definidos","Gobernanza"],
 ["REV-06","Rechazos defensivos en memoria","Seguridad"],
 ["REV-07","Dependencias y capacidad consistentes","Operaciones"],
 ["REV-08","Aceptación sintética transversal","Calidad de producto"]
]);
const EXTERNAL=Object.freeze([
 ["REV-09","Revisión manual con tecnologías de apoyo","Accesibilidad"],
 ["REV-10","Evaluación independiente de privacidad y seguridad","Seguridad"],
 ["REV-11","Integraciones, permisos y reversión reales","Integraciones"],
 ["REV-12","Autorización empresarial documentada","Gobernanza"]
]);
const mk=(id,title,role,state,reason)=>Object.freeze({id,title,role,state,reason,
 realApproval:false});
export function buildPilotSupervisedReview({
 readiness,plan,risks,ledger,coverage,drills=null,capacity,evidenceReview,atlas=null
}){
 if(readiness?.schema!=="revops-pilot-readiness-v1"||
    plan?.schema!=="revops-pilot-plan-v1"||
    risks?.schema!=="revops-pilot-risk-v1"||
    ledger?.schema!=="revops-pilot-evidence-v1"||
    coverage?.schema!=="revops-evidence-coverage-v1"||
    capacity?.schema!=="revops-pilot-capacity-v1"||
    evidenceReview?.schema!=="revops-pilot-evidence-review-v1"||
    [plan,risks,ledger,capacity,evidenceReview].some(d=>d.scenario!==readiness.scenario)||
    !Array.isArray(readiness.checks)||readiness.checks.length!==8||
    !Array.isArray(plan.tasks)||!Array.isArray(risks.risks)||
    !Array.isArray(ledger.entries)||!Array.isArray(capacity.comparisons)||
    !Array.isArray(evidenceReview.entries)||!Array.isArray(coverage.rehearsalIds)||
    readiness.realApprovals!==0||readiness.actionsExecuted!==0||
    readiness.remoteConnections!==0||plan.realApprovals!==0||
    plan.externalExecutions!==0||risks.realApprovals!==0||
    ledger.suppliedReal!==0||ledger.approvedReal!==0||
    coverage.realApprovals!==0||coverage.realEvidenceSupplied!==0||
    evidenceReview.verifiedReal!==0||evidenceReview.realApprovals!==0||
    capacity.realApprovals!==0||capacity.externalExecutions!==0)
  throw Error("La revisión exige modelos coherentes y sin aprobaciones reales.");
 if(drills&&(drills.schema!=="revops-pilot-drills-v1"||
    drills.scenario!==readiness.scenario||drills.realApprovals!==0||
    drills.externalExecutions!==0))
  throw Error("Los ensayos no pertenecen a esta muestra.");
 if(atlas&&(atlas.schema!=="revops-pilot-validation-atlas-v1"||
    atlas.productionGo!==false||atlas.realApprovals!==0||
    atlas.externalExecutions!==0))
  throw Error("El atlas no es una aceptación sintética válida.");
 const check=id=>readiness.checks.find(c=>c.id===id)?.state==="pass";
 const assessment=[
  [check("PIL-01"),"Motor del CSV y formato coherentes"],
  [readiness.blockers===0&&readiness.attentions===0,
   "No debe quedar bloqueo ni advertencia de la muestra"],
  [check("PIL-04"),"Revisión de indicadores privados de la muestra"],
  [risks.risks.length===10&&risks.risks.every(r=>r.resolvedInDemo===false),
   "El catálogo de diez riesgos no implica que estén mitigados"],
  [ledger.entries.length===plan.tasks.length&&
    evidenceReview.entries.length===ledger.entries.length&&
    evidenceReview.verifiedReal===0,
   "Requisitos definidos; todavía sin evidencia real verificada"],
  [Boolean(drills)&&drills.total===7&&drills.passed===7&&drills.failed===0,
   "Siete rechazos locales; la auditoría externa es independiente"],
  [capacity.comparisons.length===4&&capacity.totalTasks===plan.taskCount&&
    plan.tasks.some(t=>t.id==="SIGNOFF"&&t.locked),
   "Comparativas de capacidad con aprobación final bloqueada"],
  [Boolean(atlas)&&atlas.fixtureCount===18&&atlas.fixtureFailures===0&&
    atlas.passes===18,
   "Dieciocho ensayos ficticios; no pruebas de sistemas reales"]
 ];
 const gates=[
  ...LOCAL.map(([id,title,role],i)=>mk(id,title,role,
   assessment[i][0]?"local_pass":"attention",assessment[i][1])),
  ...EXTERNAL.map(([id,title,role])=>mk(id,title,role,"external_required",
   "Verificar y documentar fuera de la demo con responsables autorizados."))
 ];
 const localPassed=gates.filter(g=>g.state==="local_pass").length;
 const attention=gates.filter(g=>g.state==="attention").length;
 return Object.freeze({
  schema:"revops-pilot-supervised-review-v1",scenario:readiness.scenario,
  gates:Object.freeze(gates),total:gates.length,
  localPassed,attention,externalRequired:EXTERNAL.length,
  eligibleForIndependentReview:localPassed===LOCAL.length,
  productionGo:false,outcome:"NO AUTORIZADO PARA PRODUCCIÓN",
  realEvidenceVerified:0,realApprovals:0,externalExecutions:0,
  disclaimer:"Los controles automáticos son evidencia técnica limitada. Los cuatro controles externos permanecen pendientes y no pueden completarse ni firmarse aquí."
 });
}
export function pilotSupervisedReviewJson(review){
 if(review?.schema!=="revops-pilot-supervised-review-v1"||
  review.productionGo!==false||review.realApprovals!==0||
  review.realEvidenceVerified!==0||review.externalExecutions!==0||
  !Array.isArray(review.gates)||review.gates.length!==12||
  !review.gates.some(g=>g.id==="REV-12"&&g.state==="external_required"))
  throw Error("Revisión de piloto no exportable.");
 return JSON.stringify({
  schema:review.schema,scenario:review.scenario,
  outcome:"NO AUTORIZADO PARA PRODUCCIÓN",productionGo:false,
  total:review.total,localPassed:review.localPassed,
  attention:review.attention,externalRequired:review.externalRequired,
  eligibleForIndependentReview:review.eligibleForIndependentReview,
  gates:review.gates.map(({id,title,role,state,reason})=>({id,title,role,state,reason})),
  realEvidenceVerified:0,realApprovals:0,externalExecutions:0,
  disclaimer:review.disclaimer
 },null,2)+"\n";
}
export function pilotSupervisedReviewText(review){
 const safe=JSON.parse(pilotSupervisedReviewJson(review));
 return ["REVOPS STUDIO · PR95 · REVISIÓN SUPERVISADA",
  safe.outcome,"Proceso: "+safe.scenario,
  "Controles locales correctos: "+safe.localPassed+" de 8",
  "Atenciones técnicas: "+safe.attention+" | Validaciones externas: "+safe.externalRequired,
  ...safe.gates.map(g=>g.id+" · "+g.title+" · "+g.state+" · "+g.reason),
  "","Aprobaciones reales: 0 | Evidencias verificadas: 0 | Ejecuciones externas: 0",
  safe.disclaimer].join("\n")+"\n";
}
