// PR86 · Resource-constrained local planning, not a project timeline.
// A role is a generic function, never an assigned person or a staffing commitment.
import {createPilotExecutionPlan,PLAN_CAPACITIES} from "./pilot-plan.js";

export const ROLE_CONCURRENCY=Object.freeze([1,2]);
const freezeArray=items=>Object.freeze(items);
function compareTasks(a,b){
 return a.index-b.index;
}
function scheduleRoleLimited(plan,capacity,roleConcurrency){
 const remaining=new Map(plan.tasks.map((task,index)=>[task.id,{...task,index}]));
 const done=new Set(),waves=[];
 while(remaining.size){
  const available=[...remaining.values()].filter(t=>t.depends.every(dep=>done.has(dep))).sort(compareTasks);
  if(!available.length)throw Error("El plan tiene dependencias circulares o incompletas.");
  const activeRoles=new Map(),selected=[];
  for(const task of available){
   if(selected.length>=capacity)break;
   if((activeRoles.get(task.role)||0)>=roleConcurrency)continue;
   selected.push(task);
   activeRoles.set(task.role,(activeRoles.get(task.role)||0)+1);
  }
  if(!selected.length)throw Error("La restricción de funciones bloquea todas las tareas.");
  waves.push(Object.freeze({
   index:waves.length+1,
   tasks:freezeArray(selected.map(t=>t.id)),
   roles:freezeArray([...activeRoles].map(([role,count])=>Object.freeze({role,count}))),
   effort:selected.reduce((sum,t)=>sum+t.points,0),
   slotsUnused:capacity-selected.length
  }));
  for(const t of selected){remaining.delete(t.id);done.add(t.id);}
 }
 return freezeArray(waves);
}
function criticalDependencyChain(plan){
 const byId=new Map(plan.tasks.map(t=>[t.id,t]));
 if(byId.size!==plan.tasks.length)throw Error("Identificadores de tareas repetidos.");
 const cache=new Map(),visiting=new Set();
 function visit(id){
  if(cache.has(id))return cache.get(id);
  if(visiting.has(id))throw Error("Dependencia circular.");
  const task=byId.get(id);
  if(!task)throw Error("Dependencia desconocida.");
  visiting.add(id);
  let prev={points:0,tasks:freezeArray([])};
  for(const dep of task.depends){
   const candidate=visit(dep);
   if(candidate.points>prev.points||
      (candidate.points===prev.points&&candidate.tasks.join("|")<prev.tasks.join("|")))
    prev=candidate;
  }
  visiting.delete(id);
  const path=Object.freeze({points:prev.points+task.points,
   tasks:freezeArray([...prev.tasks,id])});
  cache.set(id,path);return path;
 }
 const paths=plan.tasks.map(t=>visit(t.id));
 const result=paths.reduce((best,next)=>
  next.points>best.points||(next.points===best.points&&next.tasks.join("|")<best.tasks.join("|"))
   ?next:best,{points:0,tasks:freezeArray([])});
 return result;
}
export function buildPilotCapacityExplorer(readiness,roleConcurrency=1){
 if(!ROLE_CONCURRENCY.includes(roleConcurrency))
  throw Error("Permite una o dos tareas simultáneas por función.");
 const plan=createPilotExecutionPlan(readiness,3);
 if(plan.realApprovals!==0||plan.externalExecutions!==0||
    !plan.tasks.some(t=>t.id==="SIGNOFF"&&t.locked))
  throw Error("El modelo requiere autorización humana externa bloqueada.");
 const baseline=new Map(plan.tasks.map(t=>[t.id,t]));
 if(baseline.size!==plan.tasks.length)throw Error("Plan con claves duplicadas.");
 for(const task of plan.tasks){
  if(!Number.isInteger(task.points)||task.points<1||task.points>3||
     typeof task.role!=="string"||task.role.length>90||
     !Array.isArray(task.depends)||task.depends.some(dep=>!baseline.has(dep)))
   throw Error("Tarea fuera del contrato de planificación.");
 }
 const comparisons=PLAN_CAPACITIES.map(capacity=>{
  const optimistic=createPilotExecutionPlan(readiness,capacity);
  const waves=scheduleRoleLimited(plan,capacity,roleConcurrency);
  return Object.freeze({
   capacity,roleConcurrency,optimisticWaves:optimistic.waves.length,waves:waves.length,
   roleConstraintWaves:waves.length-optimistic.waves.length,
   emptySlots:waves.reduce((sum,w)=>sum+w.slotsUnused,0),
   rehearsal:Object.freeze(waves)
  });
 });
 const roleWorkload=[...new Set(plan.tasks.map(t=>t.role))].map(role=>{
  const tasks=plan.tasks.filter(t=>t.role===role);
  return Object.freeze({role,taskCount:tasks.length,
   relativeEffort:tasks.reduce((sum,t)=>sum+t.points,0)});
 }).sort((a,b)=>b.relativeEffort-a.relativeEffort||a.role.localeCompare(b.role,"es"));
 return Object.freeze({
  schema:"revops-pilot-capacity-v1",scenario:plan.scenario,
  roleConcurrency,totalTasks:plan.tasks.length,relativeEffort:plan.points,
  criticalPath:criticalDependencyChain(plan),
  comparisons:freezeArray(comparisons),
  workload:freezeArray(roleWorkload),
  realApprovals:0,externalExecutions:0,
  disclaimer:"Las olas son pasos lógicos, no horas, días, costes o promesas. Una función no representa una persona asignada. SIGNOFF permanece pendiente fuera de la demo."
 });
}
export function pilotCapacityReportJson(report){
 if(report?.schema!=="revops-pilot-capacity-v1"||
   !ROLE_CONCURRENCY.includes(report.roleConcurrency)||
   !Array.isArray(report.comparisons)||report.comparisons.length!==4||
   report.realApprovals!==0||report.externalExecutions!==0)
  throw Error("Comparación de capacidad inválida.");
 return JSON.stringify({
  schema:report.schema,scenario:report.scenario,
  roleConcurrency:report.roleConcurrency,totalTasks:report.totalTasks,
  relativeEffort:report.relativeEffort,
  criticalPath:report.criticalPath,
  comparisons:report.comparisons.map(c=>({
   capacity:c.capacity,optimisticWaves:c.optimisticWaves,waves:c.waves,
   roleConstraintWaves:c.roleConstraintWaves,emptySlots:c.emptySlots,
   rehearsal:c.rehearsal.map(w=>({index:w.index,tasks:[...w.tasks],
    roles:w.roles.map(r=>({role:r.role,count:r.count})),
    effort:w.effort,slotsUnused:w.slotsUnused}))
  })),
  workload:report.workload.map(w=>({role:w.role,taskCount:w.taskCount,relativeEffort:w.relativeEffort})),
  realApprovals:0,externalExecutions:0,disclaimer:report.disclaimer
 },null,2)+"\n";
}
