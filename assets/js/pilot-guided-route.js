// PR92 · Deterministic remediation navigator, never autonomous execution.
const MAP=Object.freeze({
 "PIL-01":["SCOPE","pilotAuthorizationHeading"],
 "PIL-02":["BLOCKS","pilotAuthorizationHeading"],
 "PIL-03":["HUMAN","pilotAuthorizationHeading"],
 "PIL-04":["PRIVACY","pilotControlRiskTitle"],
 "PIL-05":["MISSING","pilotAuthorizationHeading"],
 "PIL-06":["VALUE","pilotAuthorizationHeading"],
 "PIL-07":["CONFLICTS","pilotControlRiskTitle"],
 "PIL-08":["SECURITY","pilotAuthorizationHeading"]
});
const frozen=items=>Object.freeze(items);
export function buildPilotGuidedRoute(readiness,plan,ledger,coverage,drills=null){
 if(readiness?.schema!=="revops-pilot-readiness-v1"||
  plan?.schema!=="revops-pilot-plan-v1"||
  ledger?.schema!=="revops-pilot-evidence-v1"||
  coverage?.schema!=="revops-evidence-coverage-v1"||
  [plan,ledger].some(x=>x.scenario!==readiness.scenario)||
  readiness.realApprovals!==0||readiness.actionsExecuted!==0||
  readiness.remoteConnections!==0||plan.realApprovals!==0||
  plan.externalExecutions!==0||ledger.suppliedReal!==0||
  ledger.approvedReal!==0||coverage.realApprovals!==0||
  coverage.realEvidenceSupplied!==0||coverage.externalExecutions!==0||
  !Array.isArray(readiness.checks)||readiness.checks.length!==8||
  !Array.isArray(plan.tasks)||!Array.isArray(ledger.entries)||
  !Array.isArray(coverage.rehearsalIds))
  throw Error("La ruta necesita evaluaciones y ensayos locales coherentes.");
 if(drills&&(drills.schema!=="revops-pilot-drills-v1"||
    drills.scenario!==readiness.scenario||drills.realApprovals!==0||
    drills.externalExecutions!==0))
  throw Error("Ensayos incompatibles con esta muestra.");
 const byTask=new Map(plan.tasks.map(t=>[t.id,t]));
 const seen=new Set(),steps=[];
 for(const c of readiness.checks){
  if(!Object.hasOwn(MAP,c.id)||seen.has(c.id)||
    !["pass","attention","blocked"].includes(c.state))
   throw Error("Comprobación incompatible con la ruta.");
  seen.add(c.id);
  if(c.state==="pass")continue;
  const [task,target]=MAP[c.id];
  const spec=byTask.get(task);
  if(!spec)throw Error("La acción requiere una tarea que no está en el plan.");
  steps.push(Object.freeze({
   id:"R-"+c.id,gate:c.id,task,title:c.title,
   summary:spec.evidence,role:spec.role,target,
   state:c.state==="blocked"?"blocked":"review",
   order:c.state==="blocked"?0:1,
   note:"Abrir el control asociado; la corrección exige reevaluar el origen."
  }));
 }
 const rehearsed=new Set(coverage.rehearsalIds);
 if(rehearsed.size!==coverage.rehearsalIds.length||
    coverage.rehearsalIds.some(id=>!ledger.entries.some(e=>e.id===id&&!e.externalOnly)))
  throw Error("Los ensayos de evidencia no corresponden a los requisitos del plan.");
 const nextEvidence=ledger.entries.find(e=>!e.externalOnly&&!rehearsed.has(e.id));
 if(nextEvidence)steps.push(Object.freeze({
  id:"R-EVIDENCE",gate:null,task:nextEvidence.task,
  title:"Ensayar lista de verificación: "+nextEvidence.kind,
  summary:nextEvidence.requirement,role:nextEvidence.role,
  target:"pilotControlEvidenceTitle",state:"rehearsal",order:2,
  note:"Marcar ensayo no aporta un documento real."
 }));
 if(!drills||drills.failed>0||drills.passed!==7)steps.push(Object.freeze({
  id:"R-DRILLS",gate:null,task:"SECURITY",
  title:drills?"Revisar ensayos locales con incidencias":"Ejecutar ensayos locales de seguridad",
  summary:"Comprobar siete rechazos controlados en memoria.",
  role:"Seguridad",target:"pilotControlDrillTitle",state:"rehearsal",order:3,
  note:"Los ensayos no equivalen a pruebas externas."
 }));
 steps.push(Object.freeze({
  id:"R-SIGNOFF",gate:null,task:"SIGNOFF",
  title:"Solicitar autorización humana externa",
  summary:"Verificar responsables, permisos, evidencias y reversión fuera de la demo.",
  role:"Gobernanza",target:"pilotAuthorizationHeading",state:"external",
  order:4,note:"La aprobación no se puede completar aquí."
 }));
 steps.sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
 const queue=frozen(steps);
 return Object.freeze({
  schema:"revops-guided-route-v1",scenario:plan.scenario,steps:queue,
  next:queue[0],pending:queue.length,
  blocked:queue.filter(s=>s.state==="blocked").length,
  review:queue.filter(s=>s.state==="review").length,
  external:1,realApprovals:0,externalExecutions:0,
  disclaimer:"Prioridad explicable a partir de la muestra local; no se ejecutan tareas, se asignan empleados ni se concede autorización."
 });
}
export function guidedRouteJson(route){
 if(route?.schema!=="revops-guided-route-v1"||
  route.realApprovals!==0||route.externalExecutions!==0||
  !Array.isArray(route.steps)||!route.steps.some(s=>s.id==="R-SIGNOFF"&&s.state==="external"))
  throw Error("Ruta no exportable o incompleta.");
 return JSON.stringify({
  schema:route.schema,scenario:route.scenario,
  steps:route.steps.map(({id,gate,task,title,summary,role,target,state,order,note})=>({
   id,gate,task,title,summary,role,target,state,order,note
  })),
  pending:route.pending,blocked:route.blocked,review:route.review,
  external:1,realApprovals:0,externalExecutions:0,disclaimer:route.disclaimer
 },null,2)+"\n";
}
