// PR100 · Executive narrative assembled from actual pilot engines, never fabricated KPIs.
export function buildPilotV100Snapshot({readiness,review,risks,capacity,evidenceReview,atlas=null}){
 if(readiness?.schema!=="revops-pilot-readiness-v1"||
    review?.schema!=="revops-pilot-supervised-review-v1"||
    risks?.schema!=="revops-pilot-risk-v1"||
    capacity?.schema!=="revops-pilot-capacity-v1"||
    evidenceReview?.schema!=="revops-pilot-evidence-review-v1"||
    [review,risks,capacity,evidenceReview].some(o=>o.scenario!==readiness.scenario)||
    [review,risks,capacity,evidenceReview].some(o=>o.realApprovals!==0)||
    readiness.realApprovals!==0||readiness.actionsExecuted!==0||
    review.productionGo!==false||review.externalExecutions!==0||
    evidenceReview.verifiedReal!==0||
    !Array.isArray(review.gates)||review.gates.length!==12||
    !Array.isArray(risks.risks)||risks.risks.length!==10||
    !Array.isArray(capacity.comparisons)||capacity.comparisons.length!==4||
    atlas&&(atlas.schema!=="revops-pilot-validation-atlas-v1"||
     atlas.fixtureFailures!==0||atlas.productionGo!==false))
   throw Error("PR100 necesita resultados íntegros del piloto, sin permisos reales.");
 const stage=review.eligibleForIndependentReview?
  "Candidato a revisión empresarial independiente":"Trabajos locales pendientes";
 const passed=review.localPassed;
 const toFix=review.gates.filter(g=>g.state==="attention").map(g=>Object.freeze({
  id:g.id,title:g.title,role:g.role,action:g.reason,
  destination:"pilotFinalReviewHeading",kind:"local"
 }));
 const external=review.gates.filter(g=>g.state==="external_required").map(g=>Object.freeze({
  id:g.id,title:g.title,role:g.role,action:g.reason,
  destination:"pilotFinalReviewHeading",kind:"external"
 }));
 if(external.length!==4)throw Error("Faltan verificaciones humanas independientes.");
 const next=[...toFix,...external].slice(0,4);
 const riskHighlights=[...risks.risks].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id))
  .slice(0,3).map(r=>Object.freeze({
   id:r.id,title:r.title,level:r.level,score:r.score,control:r.control
  }));
 const metrics=Object.freeze({
  localControlsPassed:passed,totalLocalControls:8,
  externalChecksOpen:4,risksOpen:risks.risks.length,
  highRisks:risks.high,evidenceRequirements:evidenceReview.required,
  realEvidenceVerified:0,atlasFixturesPassed:atlas?atlas.passes:0,
  atlasExecuted:Boolean(atlas),capacityModels:capacity.comparisons.length,
  realApprovals:0
 });
 return Object.freeze({
  schema:"revops-v100-executive-v1",scenario:readiness.scenario,
  version:"V100 · Revisión técnica del piloto",
  stage,outcome:"NO AUTORIZADO PARA PRODUCCIÓN",productionGo:false,
  metrics,actions:Object.freeze(next),riskHighlights:Object.freeze(riskHighlights),
  eligibleForIndependentReview:review.eligibleForIndependentReview,
  realApprovals:0,externalExecutions:0,
  disclaimer:"La V100 es un candidato técnico de demostración, no una autorización operativa, una certificación de seguridad o una promesa de ROI."
 });
}
export function pilotV100SnapshotJson(summary){
 if(summary?.schema!=="revops-v100-executive-v1"||
    summary.productionGo!==false||summary.realApprovals!==0||
    summary.externalExecutions!==0||summary.metrics?.realApprovals!==0||
    !Array.isArray(summary.actions)||summary.actions.length>4||
    !Array.isArray(summary.riskHighlights)||summary.riskHighlights.length!==3)
  throw Error("El resumen V100 no puede aprobar un lanzamiento.");
 return JSON.stringify({
  schema:summary.schema,scenario:summary.scenario,
  version:summary.version,stage:summary.stage,outcome:"NO AUTORIZADO PARA PRODUCCIÓN",
  metrics:summary.metrics,
  actions:summary.actions.map(({id,title,role,action,destination,kind})=>({
   id,title,role,action,destination,kind
  })),
  riskHighlights:summary.riskHighlights.map(({id,title,level,score,control})=>({
   id,title,level,score,control
  })),
  eligibleForIndependentReview:summary.eligibleForIndependentReview,
  productionGo:false,realApprovals:0,externalExecutions:0,
  disclaimer:summary.disclaimer
 },null,2)+"\n";
}
export function pilotV100SnapshotText(summary){
 const safe=JSON.parse(pilotV100SnapshotJson(summary));
 return [safe.version.toUpperCase(),safe.outcome,
  "Proceso: "+safe.scenario,"Etapa: "+safe.stage,
  "Controles locales: "+safe.metrics.localControlsPassed+"/8",
  "Verificaciones externas abiertas: 4",
  "Riesgos abiertos: "+safe.metrics.risksOpen+" (altos/críticos: "+safe.metrics.highRisks+")",
  "Requisitos de evidencia: "+safe.metrics.evidenceRequirements+" (reales verificadas: 0)",
  "Atlas sintético: "+(safe.metrics.atlasExecuted?safe.metrics.atlasFixturesPassed+"/18":"pendiente"),
  "Aprobaciones reales: 0 · Ejecuciones externas: 0",
  "","PRÓXIMOS PASOS",
  ...safe.actions.map((a,i)=>(i+1)+". "+a.title+" · "+a.role+" · "+a.action),
  "","RIESGOS PRINCIPALES",
  ...safe.riskHighlights.map(r=>r.id+" · "+r.title+" · "+r.level),
  "",safe.disclaimer].join("\n")+"\n";
}
