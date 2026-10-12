// PR102 · Before/after proof from the same local engine, never business ROI.
const METRICS=Object.freeze([
 {key:"blockedCount",id:"blocked",label:"Registros bloqueados",direction:-1},
 {key:"reviewCount",id:"review",label:"Revisión humana pendiente",direction:-1},
 {key:"actionable",id:"prepared",label:"Acciones que podrían prepararse",direction:1}
]);
export function buildGuidedOutcome(before,after){
 if(!before||!after||!Number.isSafeInteger(before.total)||before.total<1||
   before.total!==after.total||before.total>80)
  throw Error("La comparación necesita la misma muestra no vacía.");
 const metrics=METRICS.map(({key,id,label,direction})=>{
  const a=before[key],b=after[key];
  if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<0||
    a>before.total||b>after.total)
   throw Error("Contadores de comparación fuera de los límites.");
  const delta=b-a;
  return Object.freeze({id,label,before:a,after:b,delta,
   trend:delta===0?"unchanged":delta*direction>0?"better":"attention"});
 });
 const dropped=metrics[0].before-metrics[0].after;
 const claim=dropped>0?
  "Has corregido "+dropped+" bloqueo"+(dropped!==1?"s":"")+" en este ejemplo.":
  dropped<0?
  "Ahora hay "+(-dropped)+" bloqueo"+(dropped!==-1?"s":"")+" más. Revisa la modificación.":
  "El número de bloqueos no ha cambiado.";
 return Object.freeze({
  schema:"revops-guided-outcome-v1",
  total:before.total,
  metrics:Object.freeze(metrics),
  claim,
  disclaimer:"Comparación calculada sobre registros ficticios. No demuestra ahorros, autorizaciones ni resultados en sistemas empresariales.",
  realApprovals:0,externalExecutions:0,productionGo:false
 });
}
