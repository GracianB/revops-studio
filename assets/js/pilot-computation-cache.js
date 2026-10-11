// PR97 · Strictly bounded memoization of expensive, deterministic local analysis.
// A single source snapshot is retained in memory; changing it drops the old state.
export function createPilotComputationCache(){
 let identity=null,capacity=new Map(),stress=null;
 let computed=0,reused=0,invalidations=0;
 const ensure=(scenario,source,result)=>{
  if(typeof scenario!=="string"||typeof source!=="string"||
     !result||typeof result!=="object")throw Error("El caché necesita un resultado local válido.");
  if(!identity||identity.scenario!==scenario||identity.source!==source||
     identity.result!==result){
   identity={scenario,source,result};
   capacity.clear();stress=null;invalidations++;
  }
 };
 const check=()=>{if(!identity)throw Error("La muestra aún no se ha registrado.");};
 return Object.freeze({
  setSource:ensure,
  capacity(roleLimit,calculate){
   check();
   if(![1,2].includes(roleLimit)||typeof calculate!=="function")
    throw Error("Parámetros de capacidad fuera del contrato.");
   if(capacity.has(roleLimit)){reused++;return capacity.get(roleLimit);}
   const answer=calculate();
   if(answer?.schema!=="revops-pilot-capacity-v1"||
    answer.scenario!==identity.scenario)throw Error("Resultado de capacidad incompatible.");
   computed++;capacity.set(roleLimit,answer);return answer;
  },
  stress(calculate){
   check();if(typeof calculate!=="function")throw Error("Falta función de evaluación.");
   if(stress){reused++;return stress;}
   const result=calculate();
   if(result?.schema!=="revops-pilot-stress-v1"||
    result.scenario!==identity.scenario)throw Error("Matriz incompatible.");
   computed++;stress=result;return stress;
  },
  stats:()=>Object.freeze({computations:computed,reuses:reused,
   invalidations,storedCapacityVariants:capacity.size,storedStress:stress!==null}),
  clear(){
   identity=null;capacity.clear();stress=null;
   computed=0;reused=0;invalidations=0;
  }
 });
}
