// PR103 · Protocol for human-observed UAT, not automatic evidence of usability.
// Self-reported results stay in memory. Never save names, free text, CSV or approval.
export const UAT_PROFILES=Object.freeze([
 Object.freeze({id:"operations",name:"Responsable de operaciones",goal:"Comprender una decisión sin formación técnica"}),
 Object.freeze({id:"analyst",name:"Analista de datos",goal:"Investigar, corregir y exportar de forma controlada"}),
 Object.freeze({id:"mobile",name:"Evaluación móvil y accesibilidad",goal:"Comprobar comprensión, navegación y límites en dispositivos reales"})
]);
const item=(id,profile,title,instruction,url,success,seconds)=>Object.freeze({
 id,profile,title,instruction,url,success,maxSeconds:seconds
});
export const UAT_TASKS=Object.freeze([
 item("op-find","operations","Identificar el problema","Abre la demostración y selecciona el problema de los pedidos sin instrucciones adicionales.","./demo.html","Puede explicar en sus propias palabras qué problema se está analizando.",120),
 item("op-results","operations","Distinguir estados","Inicia el ejemplo de pedidos e identifica un bloqueo y una revisión humana.","./demo.html","Distingue bloqueado, revisar y preparado sin asumir que algo se ha enviado.",180),
 item("op-fix","operations","Corregir un error","En el recorrido guiado, corrige un registro bloqueado y observa el resultado.","./demo.html","Completa una corrección y explica una cifra antes/después.",240),
 item("op-boundary","operations","Reconocer los límites","Encuentra dónde se explica que la simulación no ejecuta acciones externas.","./demo.html","Afirma correctamente que no se ha conectado un CRM ni autorizado producción.",120),
 item("op-contact","operations","Encontrar el contacto","Desde la demo busca cómo plantear un proceso real sin adjuntar información privada.","./demo.html","Llega a contacto y entiende qué datos no debe compartir.",180),
 item("an-switch","analyst","Abrir herramientas completas","Entra en modo avanzado desde la visita guiada.","./demo.html","Localiza los controles sin confundirlos con un sistema conectado.",120),
 item("an-sample","analyst","Cambiar el conjunto sintético","Selecciona otro escenario y carga el ejemplo de duplicados.","./demo.html?view=advanced","Se muestra el conjunto esperado y distingue cambiar selector de cargar datos.",180),
 item("an-why","analyst","Explicar una regla","Selecciona una fila y localiza el motivo y la regla de su decisión.","./demo.html?view=advanced","Puede reconstruir por qué quedó lista, en revisión o bloqueada.",240),
 item("an-correction","analyst","Corregir sin perder control","Modifica un campo problemático; compara el resultado y verifica el historial local.","./demo.html?view=advanced","La variación es coherente y entiende el alcance del deshacer.",300),
 item("an-export","analyst","Exportación responsable","Descarga un informe agregado y explica su alcance.","./demo.html?view=advanced","Distingue informe sin filas de CSV y no expone información sensible.",180),
 item("mo-320","mobile","Usar la demo a 320 px","Navega por la primera visita en un móvil estrecho o con zoom elevado.","./demo.html","No necesita desplazamiento horizontal y puede alcanzar los botones.",180),
 item("mo-keyboard","mobile","Navegar con teclado","Recorre la página por tabulación y utiliza el enlace al contenido.","./demo.html","Observa foco visible, orden comprensible y ninguna trampa de teclado.",240),
 item("mo-theme","mobile","Contraste y ajustes","Prueba modo claro, oscuro, movimiento reducido y contraste del sistema en un dispositivo compatible.","./demo.html","Los estados y resultados siguen siendo comprensibles; registrar cualquier obstáculo.",300),
 item("mo-privacy","mobile","Encontrar la privacidad","Localiza las condiciones de privacidad y vuelve a la web sin perderse.","./privacidad.html","Identifica al responsable y cómo se gestiona una consulta sin confundirla con la demo local.",180),
 item("mo-a11y","mobile","Revisión humana de lector","Comprueba encabezados, anuncios y controles con lector de pantalla real cuando esté disponible.","./demo.html","Se registra el resultado observado; una sesión no acredita conformidad WCAG.",360)
]);
const IDS=new Set(UAT_TASKS.map(t=>t.id));
const OUTCOMES=Object.freeze(["completed","failed","blocked"]);
const SUPPORT=Object.freeze(["none","hint","guided"]);
const available=profile=>UAT_PROFILES.some(p=>p.id===profile);
const strictly=(value,keys)=>value&&typeof value==="object"&&!Array.isArray(value)&&
 Object.keys(value).length===keys.length&&Object.keys(value).every(k=>keys.includes(k));
export function createUatSession(){
 const records=new Map();
 function record(id,observation){
  if(!IDS.has(id))throw Error("Tarea de evaluación desconocida.");
  if(!strictly(observation,["outcome","assistance","seconds"])||
    !OUTCOMES.includes(observation.outcome)||!SUPPORT.includes(observation.assistance)||
    !Number.isSafeInteger(observation.seconds)||observation.seconds<1||
    observation.seconds>3600)
   throw Error("Registro de evaluación inválido; solo se aceptan códigos y duraciones.");
  records.set(id,Object.freeze({
   outcome:observation.outcome,assistance:observation.assistance,seconds:observation.seconds
  }));
  return snapshot();
 }
 function snapshot(){
  const tasks=UAT_TASKS.map(task=>{
   const observation=records.get(task.id);
   return Object.freeze({id:task.id,profile:task.profile,
    outcome:observation?.outcome||"pending",
    assistance:observation?.assistance||null,
    seconds:observation?.seconds||null,
    withinTarget:observation?observation.seconds<=task.maxSeconds:null
   });
  });
  const observed=tasks.filter(t=>t.outcome!=="pending");
  const completed=observed.filter(t=>t.outcome==="completed");
  const unsupported=observed.filter(t=>t.outcome==="failed"||t.outcome==="blocked");
  const overTime=observed.filter(t=>!t.withinTarget);
  const assisted=observed.filter(t=>t.assistance!=="none");
  const profiles=UAT_PROFILES.map(profile=>{
   const rows=tasks.filter(t=>t.profile===profile.id);
   return Object.freeze({id:profile.id,total:rows.length,observed:rows.filter(t=>t.outcome!=="pending").length,
    completed:rows.filter(t=>t.outcome==="completed").length,
    issues:rows.filter(t=>["failed","blocked"].includes(t.outcome)).length});
  });
  return Object.freeze({
   schema:"revops-uat-manual-observations-v1",
   protocol:"PR103 / evaluacion-de-uso / muestra sin datos reales",
   total:tasks.length,observed:observed.length,pending:tasks.length-observed.length,
   reportedCompleted:completed.length,reportedIssues:unsupported.length,
   reportedOverTarget:overTime.length,reportedAssisted:assisted.length,
   profiles:Object.freeze(profiles),tasks:Object.freeze(tasks),
   manualObservationsSelfReported:true,independentVerification:false,
   manualAccessibilityVerified:0,realApprovals:0,externalExecutions:0,productionGo:false,
   disclaimer:"Los resultados se introducen manualmente y no están verificados. No son pruebas automatizadas, resultados de usuarios reales confirmados, conformidad WCAG ni autorización para producción."
  });
 }
 function clear(){records.clear();return snapshot();}
 function json(){return JSON.stringify(snapshot(),null,2);}
 function text(){
  const s=snapshot();
  return [
   "REVOPS · PROTOCOLO PR103 · RESULTADOS MANUALES SIN VERIFICAR",
   "Completadas según observador: "+s.reportedCompleted+"/"+s.total,
   "Observaciones registradas: "+s.observed+" · Pendientes: "+s.pending,
   "Problemas: "+s.reportedIssues+" · Fuera de objetivo: "+s.reportedOverTarget+
    " · Con ayuda: "+s.reportedAssisted,
   ...s.tasks.map(t=>t.id+" | "+t.outcome+" | "+
    (t.seconds===null?"sin tiempo":t.seconds+" segundos")+" | "+(t.assistance||"sin datos")),
   "Producción: NO AUTORIZADA. Validación independiente y aprobación empresarial pendientes.",
   s.disclaimer
  ].join("\n")+"\n";
 }
 return Object.freeze({record,snapshot,clear,json,text});
}
export function profileTasks(profile){
 if(!available(profile))throw Error("Perfil de prueba no reconocido.");
 return UAT_TASKS.filter(task=>task.profile===profile);
}
