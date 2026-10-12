// PR81 · Prioritized, dependency-aware PILOT PLANNING only.
// No dates, employee identities, operational approvals, CRM connection or execution.
// All strings in exported plans come from the static catalog, never from CSV rows.
import {SCENARIOS} from "./workflow-engine.js";

const spec=(id,phase,priority,points,role,title,evidence,depends=[],trigger=null,locked=false)=>
 Object.freeze({id,phase,priority,points,role,title,evidence,
  depends:Object.freeze(depends),trigger,locked});
const DEFINITIONS=Object.freeze([
 spec("SCOPE","Definición",1,1,"Producto","Delimitar objetivo y muestra ficticia",
  "Alcance y criterios de aceptación acordados fuera de esta demo."),
 spec("OWNERS","Definición",1,1,"Operaciones","Designar responsables reales del piloto",
  "Personas y suplentes identificados en un sistema autorizado.",["SCOPE"]),
 spec("BLOCKS","Preparación de datos",1,3,"Calidad de datos","Resolver bloqueos de validación",
  "Nueva ejecución sin registros bloqueados.",["SCOPE"],"PIL-02"),
 spec("CONFLICTS","Preparación de datos",1,2,"Calidad de datos","Conciliar identificadores contradictorios",
  "No quedan claves duplicadas con atributos conflictivos.",["SCOPE"],"PIL-07"),
 spec("MISSING","Preparación de datos",2,2,"Calidad de datos","Completar o justificar los vacíos",
  "Datos obligatorios completos o excepción documentada.",["SCOPE"],"PIL-05"),
 spec("PRIVACY","Gobernanza",1,2,"Privacidad","Sustituir datos reales y revisar exportaciones",
  "Muestra ficticia y evaluación de privacidad aceptada fuera de la demo.",["SCOPE"],"PIL-04"),
 spec("HUMAN","Gobernanza",1,2,"Operaciones","Resolver excepciones con revisión humana",
  "Casos revisados por responsable habilitado, no por aprobación simulada.",["OWNERS"],"PIL-03"),
 spec("VALUE","Definición",2,1,"Producto","Elegir un caso con propuestas medibles",
  "Hipótesis de aceptación verificable con acciones preparadas.",["SCOPE"],"PIL-06"),
 spec("SECURITY","Gobernanza",1,3,"Seguridad","Validar permisos, acceso y controles",
  "Evaluación de accesos y amenazas firmada externamente.",["OWNERS"]),
 spec("ACCESS","Gobernanza",2,2,"Experiencia","Revisar accesibilidad con usuarios y tecnologías de apoyo",
  "Pruebas manuales y correcciones documentadas.",["SCOPE"]),
 spec("CONNECT","Ensayo técnico",1,3,"Integraciones","Probar conexiones en un entorno aislado",
  "Credenciales de pruebas y contrato de datos autorizados, sin tráfico real.",["SECURITY"]),
 spec("OBSERVE","Ensayo técnico",1,2,"Operaciones","Establecer trazas y límites operativos",
  "Alarmas, responsables, umbrales y criterios de interrupción validados.",["CONNECT"]),
 spec("ROLLBACK","Ensayo técnico",1,2,"Integraciones","Ensayar recuperación y reversión",
  "Prueba controlada de rollback con resultado verificable.",["CONNECT"]),
 spec("SIGNOFF","Autorización externa",1,1,"Gobernanza","Obtener autorización real antes de operar",
  "Aprobación humana verificable en un sistema externo a la demo.",
  ["OBSERVE","ROLLBACK","ACCESS","SECURITY","OWNERS"],null,true)
]);
export const PLAN_PHASES=Object.freeze([
 "Definición","Preparación de datos","Gobernanza","Ensayo técnico","Autorización externa"
]);
export const PLAN_CAPACITIES=Object.freeze([2,3,4,5]);
const deepCopy=a=>JSON.parse(JSON.stringify(a));
function validReadiness(readiness){
 if(!readiness||readiness.schema!=="revops-pilot-readiness-v1"||
  !Object.hasOwn(SCENARIOS,readiness.scenario)||
  !Array.isArray(readiness.checks)||readiness.checks.length!==8)
  throw Error("La evaluación de PR80 no es válida.");
 const ids=new Set();
 for(let i=0;i<8;i++){
  const c=readiness.checks[i];
  const expected="PIL-"+String(i+1).padStart(2,"0");
  if(c?.id!==expected||ids.has(c.id)||!["pass","attention","blocked"].includes(c.state)||
     !Number.isInteger(c.count)||c.count<0||c.count>400)
   throw Error("Comprobaciones de PR80 no compatibles con este plan.");
  ids.add(c.id);
 }
 if(!readiness.metrics||!Number.isInteger(readiness.metrics.total)||
  readiness.metrics.total<1||readiness.metrics.total>80)
  throw Error("La muestra de PR80 no cumple los límites.");
 if(readiness.actionsExecuted!==0||readiness.realApprovals!==0||
   readiness.remoteConnections!==0)
  throw Error("Este plan solo admite una simulación sin ejecución real.");
 return new Map(readiness.checks.map(c=>[c.id,c]));
}
function taskOrder(a,b){
 return PLAN_PHASES.indexOf(a.phase)-PLAN_PHASES.indexOf(b.phase)||
   a.priority-b.priority||a.id.localeCompare(b.id);
}
function schedule(tasks,capacity){
 const remaining=new Map(tasks.map(t=>[t.id,t])),completed=new Set(),waves=[];
 while(remaining.size){
  const ready=[...remaining.values()].filter(t=>t.depends.every(id=>completed.has(id)))
   .sort(taskOrder).slice(0,capacity);
  if(!ready.length)throw Error("El plan tiene una dependencia circular o incompleta.");
  waves.push(Object.freeze({index:waves.length+1,ids:Object.freeze(ready.map(t=>t.id)),
   points:ready.reduce((sum,t)=>sum+t.points,0)}));
  for(const t of ready){remaining.delete(t.id);completed.add(t.id);}
 }
 return Object.freeze(waves);
}
export function createPilotExecutionPlan(readiness,capacity=3){
 const checks=validReadiness(readiness);
 if(!PLAN_CAPACITIES.includes(capacity))throw Error("La capacidad debe estar entre 2 y 5 tareas por ola.");
 const selected=DEFINITIONS.filter(t=>!t.trigger||checks.get(t.trigger)?.state!=="pass");
 const included=new Set(selected.map(t=>t.id));
 const amended=selected.map(t=>{
  const deps=[...t.depends];
  if(t.id==="CONNECT"){
   for(const required of ["BLOCKS","CONFLICTS","MISSING","PRIVACY","HUMAN","VALUE"])
    if(included.has(required))deps.push(required);
  }
  if(t.id==="SIGNOFF"){
   for(const required of ["BLOCKS","CONFLICTS","MISSING","PRIVACY","HUMAN","VALUE"])
    if(included.has(required))deps.push(required);
  }
  return Object.freeze({...t,
   depends:Object.freeze([...new Set(deps)].filter(d=>included.has(d))),
   trigger:null});
 });
 const tasks=Object.freeze([...amended].sort(taskOrder));
 const waves=schedule(tasks,capacity);
 const blockedGates=readiness.checks.filter(c=>c.state==="blocked").length;
 const attentionGates=readiness.checks.filter(c=>c.state==="attention").length;
 return Object.freeze({
  schema:"revops-pilot-plan-v1",scenario:readiness.scenario,
  scenarioTitle:SCENARIOS[readiness.scenario].title,
  status:"BORRADOR LOCAL · PLANIFICACIÓN SIMULADA",capacity,
  tasks,waves,taskCount:tasks.length,
  points:tasks.reduce((sum,t)=>sum+t.points,0),
  roles:Object.freeze([...new Set(tasks.map(t=>t.role))].sort((a,b)=>a.localeCompare(b,"es"))),
  blockedGates,attentionGates,
  humanAuthorizationRequired:true,externalExecutions:0,realApprovals:0,
  disclaimer:"La capacidad representa tareas simultáneas por ola, NO semanas ni horas. Los roles son categorías, no personas asignadas. Marcar una tarea ensayada no constituye revisión, certificación ni autorización real."
 });
}
export function simulatePlanProgress(plan,simulatedIds=[]){
 if(plan?.schema!=="revops-pilot-plan-v1"||!Array.isArray(plan.tasks))
  throw Error("Prepara primero un plan válido.");
 if(!Array.isArray(simulatedIds)||simulatedIds.length>plan.tasks.length)
  throw Error("Lista de actividades simuladas inválida.");
 const byId=new Map(plan.tasks.map(t=>[t.id,t]));
 if(byId.size!==plan.tasks.length)throw Error("Plan de tareas no válido.");
 const set=new Set();
 for(const id of simulatedIds){
  if(typeof id!=="string"||!byId.has(id)||set.has(id))
   throw Error("Actividad desconocida o duplicada.");
  if(byId.get(id).locked)throw Error("La autorización externa no puede marcarse como realizada dentro de la demo.");
  set.add(id);
 }
 for(const id of set)if(byId.get(id).depends.some(dep=>!set.has(dep)))
  throw Error("Completa las dependencias previas en la simulación.");
 const ready=plan.tasks.filter(t=>!set.has(t.id)&&!t.locked&&t.depends.every(dep=>set.has(dep)))
  .map(t=>t.id);
 const blocked=plan.tasks.filter(t=>!set.has(t.id)&&!t.locked&&!ready.includes(t.id))
  .map(t=>t.id);
 return Object.freeze({
  simulated:Object.freeze([...set]),simulatedCount:set.size,remaining:plan.tasks.length-set.size,
  ready:Object.freeze(ready),blocked:Object.freeze(blocked),
  waitingExternal:plan.tasks.filter(t=>t.locked).map(t=>t.id),
  realApprovals:0,externalExecutions:0,
  status:set.size===plan.tasks.length-1?
   "Simulación técnica ensayada; aún falta autorización real.":
   "Plan local sin autorizaciones reales."
 });
}
export function pilotPlanText(plan,progress=simulatePlanProgress(plan)){
 if(plan?.schema!=="revops-pilot-plan-v1"||progress?.realApprovals!==0)
  throw Error("No hay un plan simulado válido para exportar.");
 const output=[
  "REVOPS STUDIO | PLAN DE PILOTO SUPERVISADO (PR81)",
  "Simulación local, no autorización real ni cronograma comprometido.",
  "Proceso: "+plan.scenarioTitle,
  "Capacidad por ola: "+plan.capacity+" tareas, sin equivalencia en semanas u horas.",
  "Comprobaciones que bloquean: "+plan.blockedGates+
   " | Advertencias: "+plan.attentionGates,
  "Tareas propuestas: "+plan.taskCount+" | Unidades relativas: "+plan.points,
  "Tareas ensayadas en simulación: "+progress.simulatedCount,
  "",
  "PLAN POR OLAS"
 ];
 for(const wave of plan.waves){
  output.push("Ola "+wave.index+" · "+wave.ids.length+" tareas · "+wave.points+" puntos relativos");
  for(const id of wave.ids){
   const t=plan.tasks.find(t=>t.id===id);
   output.push(id+" · "+t.title+" · "+t.role+" · "+t.phase+
    " · depende: "+(t.depends.join(", ")||"ninguna")+
    " · criterio: "+t.evidence+
    " · estado: "+(t.locked?"VALIDACIÓN EXTERNA REQUERIDA":
     progress.simulated.includes(id)?"ENSAYADA EN SIMULACIÓN":"PENDIENTE"));
  }
 }
 output.push("","LÍMITES","Acciones externas: 0","Aprobaciones reales: 0",plan.disclaimer);
 return output.join("\n")+"\n";
}
export function pilotPlanJson(plan,progress=simulatePlanProgress(plan)){
 if(plan?.schema!=="revops-pilot-plan-v1"||progress?.realApprovals!==0)
  throw Error("No hay un plan simulado válido para exportar.");
 return JSON.stringify({plan,progress},null,2)+"\n";
}
