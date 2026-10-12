// PR90 · Repeatable LOCAL functional acceptance atlas across 18 synthetic fixtures.
// This is not a release certification, a performance/load test, or authorization.
import {SCENARIOS} from "./workflow-engine.js";
import {RECIPE_LABELS,recipe} from "./workflow-product-kit.js";
import {assessPilotReadiness} from "./pilot-readiness.js";
import {createPilotExecutionPlan} from "./pilot-plan.js";
import {buildPilotRiskRegister} from "./pilot-risk-register.js";
import {buildPilotEvidenceLedger} from "./pilot-evidence-ledger.js";
import {runPilotFailureDrills} from "./pilot-failure-drills.js";
import {buildPilotCapacityExplorer} from "./pilot-capacity-explorer.js";
import {buildPilotAuthorizationBoard} from "./pilot-authorization-board.js";

export function runPilotValidationAtlas(){
 const results=[];
 for(const scenario of Object.keys(SCENARIOS))for(const key of Object.keys(RECIPE_LABELS)){
  const readiness=assessPilotReadiness(scenario,recipe(scenario,key));
  const plan=createPilotExecutionPlan(readiness);
  const risks=buildPilotRiskRegister(readiness,plan);
  const ledger=buildPilotEvidenceLedger(plan,risks);
  const drills=runPilotFailureDrills(readiness,plan,risks,ledger);
  const capacity=buildPilotCapacityExplorer(readiness);
  const board=buildPilotAuthorizationBoard({readiness,plan,risks,ledger,drills});
  const assertions=Object.freeze({
   gates:readiness.checks.length===8&&
    readiness.passed+readiness.attentions+readiness.blockers===8,
   riskCatalog:risks.count===10&&risks.risks.every(r=>r.resolvedInDemo===false),
   evidence:ledger.required===plan.taskCount&&ledger.suppliedReal===0,
   defense:drills.total===7&&drills.passed===7&&drills.failed===0,
   concurrency:capacity.comparisons.length===4&&
    capacity.comparisons.every(c=>c.waves>=c.optimisticWaves),
   signoff:plan.tasks.some(t=>t.id==="SIGNOFF"&&t.locked)&&
    board.productionGo===false&&board.realApprovals===0&&board.externalExecutions===0
  });
  const failures=Object.entries(assertions).filter(([,ok])=>!ok).map(([id])=>id);
  results.push(Object.freeze({
   scenario,key,label:RECIPE_LABELS[key].label,
   cases:readiness.metrics.total,blocked:readiness.metrics.blocked,
   gatePasses:readiness.passed,gateWarnings:readiness.attentions,
   gateBlocks:readiness.blockers,risks:risks.count,
   evidenceRequirements:ledger.required,
   drillsPassed:drills.passed,
   localCheckCount:Object.keys(assertions).length,
   failures:Object.freeze(failures),state:failures.length?"fail":"pass",
   productionGo:false,realApprovals:0,externalExecutions:0
  }));
 }
 const failed=results.filter(x=>x.state!=="pass").length;
 return Object.freeze({
  schema:"revops-pilot-validation-atlas-v1",
  scenarioCount:Object.keys(SCENARIOS).length,
  fixtureCount:results.length,
  fixtureFailures:failed,
  passes:results.length-failed,
  gatesEvaluated:results.reduce((sum,r)=>sum+r.gatePasses+r.gateWarnings+r.gateBlocks,0),
  defensesRehearsed:results.reduce((sum,r)=>sum+r.drillsPassed,0),
  localInvariantChecks:results.reduce((sum,r)=>sum+r.localCheckCount,0),
  results:Object.freeze(results),
  productionGo:false,realApprovals:0,externalExecutions:0,
  status:failed?"Se detectaron fallos en la aceptación funcional local.":
   "Pruebas funcionales locales coherentes. Lanzamiento NO autorizado.",
  disclaimer:"18 muestras ficticias y controles del código local. No sustituye CI, revisión visual manual, accesibilidad asistida, pentesting, QA de producción ni autorización empresarial."
 });
}
export function pilotValidationAtlasJson(atlas){
 if(atlas?.schema!=="revops-pilot-validation-atlas-v1"||
   atlas.productionGo!==false||atlas.realApprovals!==0||
   atlas.externalExecutions!==0||
   !Array.isArray(atlas.results)||atlas.results.length!==18)
  throw Error("Atlas de pruebas no válido para exportar.");
 return JSON.stringify({
  schema:atlas.schema,scenarioCount:atlas.scenarioCount,
  fixtureCount:atlas.fixtureCount,fixtureFailures:atlas.fixtureFailures,
  passes:atlas.passes,gatesEvaluated:atlas.gatesEvaluated,
  defensesRehearsed:atlas.defensesRehearsed,
  localInvariantChecks:atlas.localInvariantChecks,
  results:atlas.results.map(({scenario,key,label,cases,blocked,gatePasses,gateWarnings,
   gateBlocks,risks,evidenceRequirements,drillsPassed,localCheckCount,failures,state})=>({
    scenario,key,label,cases,blocked,gatePasses,gateWarnings,gateBlocks,
    risks,evidenceRequirements,drillsPassed,localCheckCount,
    failures:[...failures],state,productionGo:false
   })),
  productionGo:false,realApprovals:0,externalExecutions:0,
  status:atlas.status,disclaimer:atlas.disclaimer
 },null,2)+"\n";
}
export function pilotValidationAtlasText(atlas){
 if(atlas?.schema!=="revops-pilot-validation-atlas-v1"||
   atlas.productionGo!==false||atlas.realApprovals!==0||
   atlas.externalExecutions!==0||!Array.isArray(atlas.results)||atlas.results.length!==18)
  throw Error("Atlas local inválido.");
 return ["REVOPS STUDIO · PR90 · VALIDACIÓN FUNCIONAL SINTÉTICA",
  atlas.status,"Muestras: "+atlas.fixtureCount+" | Fallos de invariantes: "+atlas.fixtureFailures,
  "Controles de muestra evaluados: "+atlas.gatesEvaluated,
  "Defensas locales ensayadas: "+atlas.defensesRehearsed,
  "Verificaciones de invariantes: "+atlas.localInvariantChecks,
  "Aprobaciones reales: 0 | Ejecuciones externas: 0",
  "",...atlas.results.map(r=>r.scenario+" · "+r.label+" · "+r.state+
   " · "+r.gatePasses+"/8 gates pass · defensas "+r.drillsPassed+"/7"),
  "",atlas.disclaimer].join("\n")+"\n";
}
