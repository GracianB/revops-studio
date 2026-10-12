// PR82 · Deterministic operational risks, not business probabilities.
const DEFINITIONS=[
 ["INPUT","PIL-01","SCOPE","Contrato de datos",2,"Volver a validar la muestra y su alcance."],
 ["BLOCK","PIL-02","BLOCKS","Registros bloqueados",3,"Corregir bloqueos y repetir las reglas."],
 ["REVIEW","PIL-03","HUMAN","Excepciones pendientes",3,"Solicitar revisión humana fuera de la demo."],
 ["PRIVACY","PIL-04","PRIVACY","Exposición de datos",3,"Sustituir datos reales por muestras ficticias."],
 ["QUALITY","PIL-05","MISSING","Calidad de los registros",2,"Completar los vacíos y documentar excepciones."],
 ["VALUE","PIL-06","VALUE","Hipótesis sin propuesta medible",2,"Definir la prueba de valor sin prometer ROI."],
 ["CONFLICT","PIL-07","CONFLICTS","Identificadores contradictorios",3,"Conciliar claves sin perder trazabilidad."],
 ["BOUNDARY","PIL-08","SECURITY","Separación de entornos",3,"Mantener bloqueadas las operaciones externas."],
 ["ROLLBACK",null,"ROLLBACK","Reversión no verificada",3,"Probar reversión en entorno autorizado."],
 ["APPROVAL",null,"SIGNOFF","Aprobación externa pendiente",3,"Exigir autorización comprobable fuera de la demo."]
];
const level=n=>n>=9?"critical":n>=6?"high":n>=3?"medium":"low";
export function buildPilotRiskRegister(readiness,plan){
 if(readiness?.schema!=="revops-pilot-readiness-v1"||
  plan?.schema!=="revops-pilot-plan-v1"||
  readiness.scenario!==plan.scenario||
  readiness.actionsExecuted!==0||readiness.realApprovals!==0||
  readiness.remoteConnections!==0||
  plan.externalExecutions!==0||plan.realApprovals!==0||
  !Array.isArray(readiness.checks)||readiness.checks.length!==8||
  !Array.isArray(plan.tasks))
  throw Error("Evaluación y plan incompatibles con una demo local.");
 const checks=new Map(readiness.checks.map(c=>[c.id,c]));
 const tasks=new Set(plan.tasks.map(t=>t.id));
 if(checks.size!==8||!tasks.has("SECURITY")||
  !tasks.has("ROLLBACK")||!tasks.has("SIGNOFF"))
  throw Error("Faltan controles obligatorios de preparación.");
 const risks=DEFINITIONS.map(([id,gate,task,title,impact,control])=>{
  const check=gate?checks.get(gate):null;
  if(gate&&(!check||!["pass","attention","blocked"].includes(check.state)))
   throw Error("Señal de riesgo inválida.");
  const signal=check?.state||"attention";
  const likelihood=id==="APPROVAL"?3:id==="ROLLBACK"?2:
    signal==="blocked"?3:signal==="attention"?2:1;
  const score=impact*likelihood;
  return Object.freeze({id:"R-"+id,gate,task:tasks.has(task)?task:"SECURITY",
   title,signal,impact,likelihood,score,level:level(score),control,
   resolvedInDemo:false});
 });
 return Object.freeze({schema:"revops-pilot-risk-v1",scenario:plan.scenario,
  risks:Object.freeze(risks),count:risks.length,
  high:risks.filter(r=>r.score>=6).length,
  critical:risks.filter(r=>r.level==="critical").length,
  realApprovals:0,externalExecutions:0,
  disclaimer:"Escala ordinal de impacto y exposición; no representa probabilidades verificadas."});
}
export function riskRegisterJson(register){
 if(register?.schema!=="revops-pilot-risk-v1"||
  !Array.isArray(register.risks)||register.risks.length!==10||
  register.realApprovals!==0||register.externalExecutions!==0)
  throw Error("Registro de riesgos inválido.");
 return JSON.stringify({schema:register.schema,scenario:register.scenario,
  high:register.high,critical:register.critical,
  risks:register.risks.map(({id,gate,task,title,signal,impact,likelihood,score,level,control})=>
   ({id,gate,task,title,signal,impact,likelihood,score,level,control})),
  realApprovals:0,externalExecutions:0,disclaimer:register.disclaimer},null,2)+"\n";
}
