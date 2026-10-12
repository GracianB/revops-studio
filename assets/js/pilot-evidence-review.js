// PR94 · Evidence review matrix. Status is rehearsal-only, never a verified artifact.
export function buildPilotEvidenceReview(plan,ledger,risks,coverage){
 if(plan?.schema!=="revops-pilot-plan-v1"||
    ledger?.schema!=="revops-pilot-evidence-v1"||
    risks?.schema!=="revops-pilot-risk-v1"||
    coverage?.schema!=="revops-evidence-coverage-v1"||
    [ledger,risks].some(x=>x.scenario!==plan.scenario)||
    plan.realApprovals!==0||plan.externalExecutions!==0||
    ledger.suppliedReal!==0||ledger.approvedReal!==0||
    risks.realApprovals!==0||risks.externalExecutions!==0||
    coverage.realApprovals!==0||coverage.realEvidenceSupplied!==0||
    !Array.isArray(plan.tasks)||!Array.isArray(ledger.entries)||
    !Array.isArray(risks.risks)||!Array.isArray(coverage.rehearsalIds))
  throw Error("Las evidencias necesitan un plan y resultados compatibles.");
 const tasks=new Map(plan.tasks.map(t=>[t.id,t]));
 const riskIndex=new Map(risks.risks.map(r=>[r.id,r]));
 const rehearsed=new Set(coverage.rehearsalIds);
 if(tasks.size!==plan.tasks.length||riskIndex.size!==risks.risks.length||
    rehearsed.size!==coverage.rehearsalIds.length||
    ledger.entries.length!==plan.tasks.length)
  throw Error("Requisitos o riesgos duplicados.");
 const entries=ledger.entries.map(entry=>{
  const task=tasks.get(entry.task);
  if(!task||entry.id!=="E-"+entry.task||
    task.role!==entry.role||task.evidence!==entry.requirement||
    !Array.isArray(entry.risks)||entry.risks.some(id=>!riskIndex.has(id))||
    (rehearsed.has(entry.id)&&entry.externalOnly))
   throw Error("Evidencia incoherente con el plan.");
  const affected=entry.risks.map(id=>riskIndex.get(id));
  const high=affected.some(r=>r.score>=6);
  const level=entry.externalOnly?"external":rehearsed.has(entry.id)?"rehearsed":"pending";
  return Object.freeze({
   id:entry.id,task:entry.task,role:entry.role,phase:task.phase,
   requirement:entry.requirement,kind:entry.kind,
   risks:Object.freeze([...entry.risks]),
   highRisk:high,priority:entry.externalOnly?1:high?2:3,
   level,externalOnly:entry.externalOnly,
   realEvidenceVerified:false,
   reviewerInstruction:entry.externalOnly?
    "La aprobación debe documentarse y verificarse en un sistema externo autorizado.":
    "Solicitar prueba real a la función responsable y revisarla fuera de esta demo."
  });
 }).sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
 for(const id of rehearsed)if(!entries.some(e=>e.id===id))
  throw Error("Marca de ensayo sin requisito vigente.");
 const roles=[...new Set(entries.map(e=>e.role))].sort((a,b)=>a.localeCompare(b,"es"));
 return Object.freeze({
  schema:"revops-pilot-evidence-review-v1",scenario:plan.scenario,
  entries:Object.freeze(entries),roles:Object.freeze(roles),
  required:entries.length,rehearsed:entries.filter(e=>e.level==="rehearsed").length,
  pending:entries.filter(e=>e.level==="pending").length,
  external:entries.filter(e=>e.level==="external").length,
  highRiskLinked:entries.filter(e=>e.highRisk).length,
  verifiedReal:0,realApprovals:0,externalExecutions:0,
  disclaimer:"Las marcas son ensayos de la lista, no documentos aportados, firmas, decisiones verificadas ni permisos."
 });
}
export function pilotEvidenceReviewJson(review){
 if(review?.schema!=="revops-pilot-evidence-review-v1"||
    !Array.isArray(review.entries)||!Array.isArray(review.roles)||
    review.verifiedReal!==0||review.realApprovals!==0||
    review.externalExecutions!==0||!review.entries.some(e=>e.id==="E-SIGNOFF"&&e.level==="external"))
  throw Error("Matriz de evidencia no exportable.");
 return JSON.stringify({
  schema:review.schema,scenario:review.scenario,
  required:review.required,rehearsed:review.rehearsed,
  pending:review.pending,external:review.external,
  highRiskLinked:review.highRiskLinked,verifiedReal:0,
  roles:[...review.roles],
  entries:review.entries.map(({id,task,role,phase,requirement,kind,risks,
   highRisk,priority,level,externalOnly,reviewerInstruction})=>({
   id,task,role,phase,requirement,kind,risks:[...risks],
   highRisk,priority,level,externalOnly,reviewerInstruction
  })),
  realApprovals:0,externalExecutions:0,disclaimer:review.disclaimer
 },null,2)+"\n";
}
