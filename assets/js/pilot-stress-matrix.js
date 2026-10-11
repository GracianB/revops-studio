// PR89 · Synthetic stress matrix (not a load test or external benchmark).
import {SCENARIOS} from "./workflow-engine.js";
import {recipe,RECIPE_LABELS} from "./workflow-product-kit.js";
import {assessPilotReadiness} from "./pilot-readiness.js";
import {createPilotExecutionPlan} from "./pilot-plan.js";
import {buildPilotRiskRegister} from "./pilot-risk-register.js";
import {buildPilotEvidenceLedger} from "./pilot-evidence-ledger.js";
import {buildPilotAuthorizationBoard} from "./pilot-authorization-board.js";

const summary=(readiness,sourceType)=>{
 const plan=createPilotExecutionPlan(readiness);
 const risks=buildPilotRiskRegister(readiness,plan);
 const ledger=buildPilotEvidenceLedger(plan,risks);
 const board=buildPilotAuthorizationBoard({readiness,plan,risks,ledger});
 return Object.freeze({
  sourceType,scenario:readiness.scenario,
  total:readiness.metrics.total,blocked:readiness.metrics.blocked,
  review:readiness.metrics.review,prepared:readiness.metrics.prepared,
  gatesPassed:readiness.passed,gateWarnings:readiness.attentions,
  gateBlocked:readiness.blockers,highRisks:risks.high,
  tasks:plan.taskCount,evidenceRequirements:ledger.required,
  supervisedDemoCandidate:readiness.suitableForSupervisedDemo,
  productionGo:board.productionGo,realApprovals:0,externalExecutions:0,
  gateStates:Object.freeze(readiness.checks.map(c=>Object.freeze({id:c.id,state:c.state})))
 });
};
export function buildPilotStressMatrix(readiness){
 if(readiness?.schema!=="revops-pilot-readiness-v1"||
   !Object.hasOwn(SCENARIOS,readiness.scenario)||
   readiness.realApprovals!==0||readiness.actionsExecuted!==0||
   readiness.remoteConnections!==0||
   !Array.isArray(readiness.checks)||readiness.checks.length!==8)
  throw Error("La comparación requiere una evaluación local válida.");
 const current=summary(readiness,"current");
 const samples=Object.keys(RECIPE_LABELS).map(key=>{
  const fixture=assessPilotReadiness(readiness.scenario,recipe(readiness.scenario,key));
  const model=summary(fixture,"synthetic");
  const delta=Object.freeze({
   blocked:model.blocked-current.blocked,
   review:model.review-current.review,
   passed:model.gatesPassed-current.gatesPassed
  });
  return Object.freeze({
   key,label:RECIPE_LABELS[key].label,description:RECIPE_LABELS[key].description,
   data:model,differenceFromCurrent:delta
  });
 });
 return Object.freeze({
  schema:"revops-pilot-stress-v1",scenario:readiness.scenario,
  current,samples:Object.freeze(samples),
  sampleCount:samples.length,syntheticOnly:true,
  realApprovals:0,externalExecutions:0,
  disclaimer:"Seis pruebas FUNCIONALES con datos sintéticos, no pruebas de carga, capacidad de producción, robustez de redes, tiempos ni resultados empresariales."
 });
}
export function pilotStressMatrixJson(matrix){
 if(matrix?.schema!=="revops-pilot-stress-v1"||
   !Array.isArray(matrix.samples)||matrix.samples.length!==6||
   matrix.syntheticOnly!==true||matrix.realApprovals!==0||
   matrix.externalExecutions!==0)
  throw Error("Matriz sintética no exportable.");
 const copy=m=>({
  sourceType:m.sourceType,total:m.total,blocked:m.blocked,review:m.review,
  prepared:m.prepared,gatesPassed:m.gatesPassed,gateWarnings:m.gateWarnings,
  gateBlocked:m.gateBlocked,highRisks:m.highRisks,
  tasks:m.tasks,evidenceRequirements:m.evidenceRequirements,
  supervisedDemoCandidate:m.supervisedDemoCandidate,productionGo:false,
  realApprovals:0,externalExecutions:0,
  gateStates:m.gateStates.map(g=>({id:g.id,state:g.state}))
 });
 return JSON.stringify({
  schema:matrix.schema,scenario:matrix.scenario,
  syntheticOnly:true,current:copy(matrix.current),
  samples:matrix.samples.map(s=>({
   key:s.key,label:s.label,description:s.description,data:copy(s.data),
   differenceFromCurrent:s.differenceFromCurrent
  })),
  realApprovals:0,externalExecutions:0,disclaimer:matrix.disclaimer
 },null,2)+"\n";
}
