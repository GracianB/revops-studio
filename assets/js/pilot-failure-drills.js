// PR84 · Fault drills executed ONLY against in-memory objects.
// A passing drill means a particular local guard rejected one tampering attempt,
// never that an integration, a security audit or rollback is certified.
import {buildPilotRiskRegister,riskRegisterJson} from "./pilot-risk-register.js";
import {buildPilotEvidenceLedger,simulateEvidenceCoverage} from "./pilot-evidence-ledger.js";
import {simulatePlanProgress} from "./pilot-plan.js";
const isRejected=(fn)=>{try{fn();return false;}catch{return true;}};
export function runPilotFailureDrills(readiness,plan,risks,ledger){
 if(readiness?.schema!=="revops-pilot-readiness-v1"||
    plan?.schema!=="revops-pilot-plan-v1"||
    risks?.schema!=="revops-pilot-risk-v1"||
    ledger?.schema!=="revops-pilot-evidence-v1"||
    [plan,risks,ledger].some(x=>x.scenario!==readiness.scenario))
  throw Error("Los módulos de ensayo no pertenecen a la misma muestra.");
 // Drill expected outcomes are checked through real exported module guards.
 const checks=[
  ["D-01","Bloqueo de autorización simulada",
   ()=>simulatePlanProgress(plan,["SIGNOFF"])],
  ["D-02","No mezclar resultados entre escenarios",
   ()=>buildPilotRiskRegister(readiness,{...plan,scenario:"SCENARIO_DESCONOCIDO"})],
  ["D-03","No reconocer firmas ficticias",
   ()=>simulateEvidenceCoverage(ledger,["E-SIGNOFF"])],
  ["D-04","No saltarse la dependencia de reversión",
   ()=>simulatePlanProgress(plan,["ROLLBACK"])],
  ["D-05","No aceptar ejecución externa falsificada",
   ()=>buildPilotRiskRegister({...readiness,actionsExecuted:1},plan)],
  ["D-06","No exportar un registro con aprobaciones inventadas",
   ()=>riskRegisterJson({...risks,realApprovals:1})],
  ["D-07","No aceptar evidencia de otro escenario",
   ()=>buildPilotEvidenceLedger({...plan,scenario:"SCENARIO_DESCONOCIDO"},risks)]
 ];
 const drills=checks.map(([id,title,fn])=>Object.freeze({
  id,title,passed:isRejected(fn),
  detail:"Rechazo local esperado; sin conexiones ni acciones reales."
 }));
 const failed=drills.filter(d=>!d.passed).length;
 return Object.freeze({schema:"revops-pilot-drills-v1",scenario:plan.scenario,
  drills:Object.freeze(drills),total:drills.length,passed:drills.length-failed,
  failed,realApprovals:0,externalExecutions:0,
  status:failed?"Ensayos locales con fallos, detener revisión.":"Controles locales ensayados; pendiente de pruebas independientes.",
  disclaimer:"No se han realizado pruebas de un CRM, red, permisos reales ni recuperación de sistemas."});
}
export function pilotDrillReportJson(result){
 if(result?.schema!=="revops-pilot-drills-v1"||
   !Array.isArray(result.drills)||result.drills.length!==7||
   result.realApprovals!==0||result.externalExecutions!==0)
  throw Error("Informe de ensayos inválido.");
 return JSON.stringify({schema:result.schema,scenario:result.scenario,total:result.total,
  passed:result.passed,failed:result.failed,
  drills:result.drills.map(({id,title,passed})=>({id,title,passed})),
  realApprovals:0,externalExecutions:0,disclaimer:result.disclaimer},null,2)+"\n";
}
