// RevOps PR71: pure catalog-based project discovery. No browser or network.
import {buildDiagnostic,PROBLEMS,TOOLS,SCOPES} from "./diagnostic.js";

export const DISCOVERY_OPTIONS=Object.freeze({
 role:Object.freeze({direction:"Dirección y compras",operations:"Operaciones",analyst:"Datos y analítica",support:"Soporte y atención al cliente"}),
 outcome:Object.freeze({speed:"Reducir pasos manuales medidos",quality:"Disminuir errores verificables",visibility:"Conseguir información fiable a tiempo",trace:"Controlar y explicar decisiones"}),
 urgency:Object.freeze({explore:"Exploración, sin fecha aprobada",quarter:"Objetivo para próximo trimestre",priority:"Necesidad prioritaria, plazo por confirmar"}),
 stage:Object.freeze({explore:"Problema por descubrir",mapped:"Proceso actual documentado",approved:"Alcance interno preliminar acordado"}),
 owner:Object.freeze({assigned:"Existe responsable de decisión",pending:"Responsable por designar",unknown:"No sabemos quién decide"}),
 sample:Object.freeze({ready:"Muestras anonimizadas o ficticias disponibles",partial:"Muestras con definiciones incompletas",none:"Sin muestra utilizable todavía"}),
 integration:Object.freeze({local:"Piloto aislado posible",possible:"Habrá que evaluar conectores",required:"Depende de integración real"}),
 sensitivity:Object.freeze({normal:"Datos de prueba ficticios o anonimizados",confidential:"Información interna: requiere controles",restricted:"Datos personales/sensibles: revisión formal"})
});
const phases=Object.freeze([
 Object.freeze({name:"01 · Delimitar y medir",result:"Mapa del proceso, propietario de decisión, fuentes y métrica de partida."}),
 Object.freeze({name:"02 · Ensayar en pequeño",result:"Piloto reversible con registros de prueba, errores y excepciones humanas."}),
 Object.freeze({name:"03 · Verificar y entregar",result:"Pruebas de aceptación, comparación equivalente y guía de operación y reversión."})
]);
const cleanText=(value,max=240)=>String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);
const choose=(group,key,defaultKey)=>Object.hasOwn(DISCOVERY_OPTIONS[group],key)?key:defaultKey;
export function buildDiscoveryBrief(input){
 const base=buildDiagnostic(input?.problem,input?.tools,input?.scope);
 if(!base)return null;
 const role=choose("role",input.role,"operations"),outcome=choose("outcome",input.outcome,"quality");
 const urgency=choose("urgency",input.urgency,"explore"),stage=choose("stage",input.stage,"explore");
 const owner=choose("owner",input.owner,"unknown"),sample=choose("sample",input.sample,"none");
 const integration=choose("integration",input.integration,"possible"),sensitivity=choose("sensitivity",input.sensitivity,"normal");
 const goal=cleanText(input.goal),constraint=cleanText(input.constraint),exclusion=cleanText(input.exclusion);
 const gaps=[
  ...(owner!=="assigned"?["Designar a quien aprobará los resultados y excepciones."]:[]),
  ...(sample!=="ready"?["Preparar muestras ficticias/anonimizadas con definiciones verificadas."]:[]),
  ...(integration!=="local"?["Revisar permisos, APIs, propietario de sistemas y coste de conectores."]:[]),
  ...(sensitivity==="confidential"?["Acordar política de acceso y conservación antes de introducir datos internos."]:[]),
  ...(sensitivity==="restricted"?["Validar base legal, minimización y revisión formal de seguridad antes del piloto."]:[]),
  ...(stage==="explore"?["Documentar el flujo real y acordar qué significa éxito."]:[]),
  ...(urgency==="priority"?["Confirmar fecha, dependencias y responsable de prioridad."]:[])
 ];
 const readiness=sensitivity==="restricted"?"Revisión de privacidad imprescindible":
  owner!=="assigned"||sample==="none"||integration==="required"?"Condiciones pendientes antes del piloto":
  gaps.length?"Delimitar condiciones para piloto":"Candidato a piloto acotado, sujeto a validación";
 const risks=[
  ...(integration==="required"?["La integración no existe en esta demo: comprobar acceso y aprobación externos."]:[]),
  ...(sensitivity!=="normal"?["No introducir datos de clientes ni información confidencial en esta demo."]:[]),
  ...(owner!=="assigned"?["Sin responsable de decisión puede bloquearse la aceptación."]:[]),
  ...(sample!=="ready"?["Sin muestra representativa no se puede medir una mejora."]:[])
 ];
 const acceptance=[
  "La persona responsable valida campos, fuentes, criterios y excepciones humanas.",
  base.verification,
  "La prueba registra rechazos y permite detener o revertir la ejecución sin efectos externos.",
  "Los resultados se comparan sobre muestras equivalentes; no se promete ahorro sin medir."
 ];
 const fields=Object.freeze({problem:PROBLEMS[input.problem].label,tools:TOOLS[input.tools]||TOOLS.unknown,
  scope:SCOPES[input.scope]||SCOPES.team,role:DISCOVERY_OPTIONS.role[role],outcome:DISCOVERY_OPTIONS.outcome[outcome],
  urgency:DISCOVERY_OPTIONS.urgency[urgency],stage:DISCOVERY_OPTIONS.stage[stage],
  owner:DISCOVERY_OPTIONS.owner[owner],sample:DISCOVERY_OPTIONS.sample[sample],
  integration:DISCOVERY_OPTIONS.integration[integration],sensitivity:DISCOVERY_OPTIONS.sensitivity[sensitivity]});
 const demo=input.problem==="reporting"?"data":input.problem==="knowledge"?"support":"orders";
 return Object.freeze({version:"PR71",service:base.service,packageType:base.packageType,
  readiness,fields,goal,constraint,exclusion,phases,acceptance:Object.freeze(acceptance),
  gaps:Object.freeze(gaps.length?gaps:["Sin condiciones adicionales detectadas en el formulario; verificar caso real."]),
  risks:Object.freeze(risks.length?risks:["Comprobar casos límite y reversión durante el piloto."]),
  deliverable:base.deliverable,firstStep:base.firstStep,verification:base.verification,demo,
  assumption:"Hipótesis de trabajo: no valida precio, integración, seguridad ni resultados reales.",
  limits:"Datos declarados por la persona visitante. Generar este documento no envía información ni ejecuta acciones."});
}
export function formatDiscoveryBrief(b){
 if(!b?.fields||!Array.isArray(b.gaps))throw Error("Primero debes generar el brief.");
 const names={problem:"Problema",tools:"Herramientas",scope:"Alcance",role:"Perfil",outcome:"Resultado buscado",
  urgency:"Prioridad",stage:"Estado del proceso",owner:"Responsable",sample:"Disponibilidad de muestra",
  integration:"Integraciones",sensitivity:"Datos del piloto"};
 return [
  "REVOPS STUDIO | BRIEF DE DESCUBRIMIENTO PR71",
  "Documento local y no vinculante. Sin envío automático.","",
  "01 · CONTEXTO",
  ...Object.entries(b.fields).map(([key,value])=>names[key]+": "+value),
  "Objetivo concreto: "+(b.goal||"Pendiente de concretar"),
  "Condición o dependencia: "+(b.constraint||"Por confirmar"),
  "Fuera de alcance inicial: "+(b.exclusion||"Pendiente de acordar"),"",
  "02 · DIAGNÓSTICO",
  "Especialidad sugerida: "+b.service,
  "Modalidad inicial orientativa: "+b.packageType,
  "Viabilidad orientativa: "+b.readiness,
  "Primero: "+b.firstStep,
  "Primer entregable: "+b.deliverable,"",
  "03 · CONDICIONES PARA AVANZAR",...b.gaps.map((x,i)=>(i+1)+". "+x),"",
  "04 · FASES CON ENTREGABLES",...b.phases.map(x=>x.name+": "+x.result),"",
  "05 · ACEPTACIÓN VERIFICABLE",...b.acceptance.map((x,i)=>(i+1)+". "+x),"",
  "06 · RIESGOS Y EXCLUSIONES",...b.risks.map((x,i)=>(i+1)+". "+x),"",
  "PRUEBA LOCAL SUGERIDA: demo.html?scenario="+b.demo,
  b.assumption,b.limits
 ].join("\n");
}
export function discoveryJson(b){
 if(!b?.fields)throw Error("Primero debes generar el brief.");
 return JSON.stringify({schema:"revops-discovery-brief-v1",state:"proposal_not_executed",
  data:{...b,phases:b.phases.map(x=>({...x})),fields:{...b.fields}}},null,2);
}
