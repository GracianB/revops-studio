// Guided discovery for real commercial scope. Pure, local and deterministic: no AI/network.
export const PROBLEMS = Object.freeze({
  repetitive: {
    label: "Repetimos tareas entre herramientas",
    service: "Automatización",
    headline: "Quitar pasos manuales sin perder el control.",
    deliverable: "Un flujo con validación de datos, gestión de errores y avisos.",
    verification: "Comparar pasos manuales y errores antes/después en un proceso real."
  },
  reporting: {
    label: "Los datos o informes no cuadran",
    service: "Datos y BI",
    headline: "Una fuente fiable antes de construir más gráficos.",
    deliverable: "Definiciones de KPIs, datos reconciliados y un primer panel útil.",
    verification: "Contrastar indicadores con sus fuentes y responsables."
  },
  knowledge: {
    label: "El conocimiento o seguimiento se pierde",
    service: "Software a medida",
    headline: "Que el equipo encuentre respuestas y continúe el trabajo.",
    deliverable: "Un flujo de consultas y una base de conocimiento con responsables.",
    verification: "Probar casos reales con revisión humana y comprobar lo que no sabe."
  },
  rules: {
    label: "Decidimos con Excel y reglas complejas",
    service: "Software a medida",
    headline: "Convertir reglas dispersas en una herramienta verificable.",
    deliverable: "Un prototipo de decisiones con reglas visibles, casos límite y trazabilidad.",
    verification: "Reproducir decisiones conocidas y comprobar excepciones con el equipo."
  }
});
export const TOOLS = Object.freeze({
  sheets: "Excel o Google Sheets",
  crm: "CRM, soporte o gestión",
  mixed: "Varios sistemas distintos",
  unknown: "Aún no lo tengo claro"
});
export const SCOPES = Object.freeze({
  single: "Un proceso o una persona",
  team: "Un equipo",
  cross: "Varios equipos o departamentos"
});
const toolChecks = Object.freeze({
  sheets: "Revisar las hojas, sus fórmulas, quién las actualiza y qué datos son fiables.",
  crm: "Revisar campos, permisos, estados y posibilidades reales de integración.",
  mixed: "Dibujar el recorrido entre sistemas, responsables y puntos donde se duplican datos.",
  unknown: "Identificar herramientas, responsables y un caso real antes de decidir tecnología."
});
export function buildDiagnostic(problem,tools="unknown",scope="team") {
  const issue=PROBLEMS[problem];
  if(!issue)return null;
  const stack=TOOLS[tools]?tools:"unknown";
  const size=SCOPES[scope]?scope:"team";
  const packageType=(size==="cross"||stack==="mixed")?"Sistema a medida":"Quick win";
  const packageNote=packageType==="Quick win"
    ?"Podría empezar con un entregable acotado. Referencia: desde 900 €, sujeto a diagnóstico."
    :"Probablemente necesita un alcance por fases. Referencia: desde 4.000 €, sujeto a diagnóstico.";
  const summary=[
    "Problema: "+issue.label,
    "Herramientas: "+TOOLS[stack],
    "Alcance: "+SCOPES[size],
    "Ruta sugerida: "+issue.service,
    "Modalidad inicial orientativa: "+packageType,
    "Primero: "+toolChecks[stack],
    "Primer entregable: "+issue.deliverable,
    "Cómo validarlo: "+issue.verification
  ].join("\n");
  return {
    problem:issue.label,tools:TOOLS[stack],scope:SCOPES[size],
    service:issue.service,packageType,packageNote,
    headline:issue.headline,firstStep:toolChecks[stack],
    deliverable:issue.deliverable,verification:issue.verification,summary
  };
}
