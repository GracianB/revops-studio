// RevOps R1 · Printable, offline diagnostic deliverable.
// Pure report builder: whitelisted answers only; no external calls, no personal records.
import { buildDiagnostic, PROBLEMS, TOOLS, SCOPES } from "./diagnostic.js";

const PLAYBOOK = Object.freeze({
  repetitive: {
    baseline: "Documentar un caso completo, desde el origen del dato hasta el resultado, e identificar pasos repetidos y fallos.",
    pilot: "Automatizar una única variante del proceso, con validaciones, registro de excepciones y opción de intervención humana.",
    handover: "Ensayar errores y duplicados, acordar quién interviene y entregar instrucciones de uso y reversión.",
    signal: "Pasos manuales y errores por cada 10 casos, medidos sobre muestras comparables.",
    question: "¿Qué tarea se repite, quién la realiza y qué ocurre cuando falla?"
  },
  reporting: {
    baseline: "Acordar definiciones, fecha de corte, responsable y fuente de cada indicador antes de diseñar gráficos.",
    pilot: "Conciliar una muestra de datos y construir una vista pequeña con discrepancias explicadas.",
    handover: "Contrastar dos cierres consecutivos y documentar actualización, controles y responsables.",
    signal: "Indicadores conciliados frente a sus fuentes, discrepancias abiertas y tiempo de preparación.",
    question: "¿Qué dos informes discrepan y cuál es hoy la fuente aceptada?"
  },
  knowledge: {
    baseline: "Elegir preguntas frecuentes reales y localizar dónde se pierde el seguimiento entre personas.",
    pilot: "Probar una ruta corta de consulta, respuesta y escalado, con dueño del contenido y estado visible.",
    handover: "Verificar búsquedas sin resultado, traspasos y correcciones de artículos con responsables definidos.",
    signal: "Casos resueltos con información vigente, búsquedas sin resultado y traspasos pendientes.",
    question: "¿Quién puede corregir una respuesta cuando cambia el procedimiento?"
  },
  rules: {
    baseline: "Inventariar reglas, excepciones, prioridades y ejemplos de decisiones ya conocidas.",
    pilot: "Reproducir un conjunto pequeño de decisiones con una tabla de reglas explícita y registro de motivos.",
    handover: "Probar conflictos entre reglas y casos límite, documentando aprobaciones y cambios.",
    signal: "Decisiones reproducidas correctamente, excepciones explicadas y revisiones humanas pendientes.",
    question: "¿Qué regla prevalece cuando dos condiciones entran en conflicto?"
  }
});
const TOOL_INPUT = Object.freeze({
  sheets: "Una copia anonimizada de la hoja, fórmulas relevantes y definición de cada columna.",
  crm: "Un esquema sin credenciales de campos, permisos, estados y capacidades de integración.",
  mixed: "Un diagrama básico de origen y destino por sistema, con responsables y duplicidades.",
  unknown: "Una entrevista breve para identificar herramientas y un caso representativo, sin entregar datos confidenciales."
});
const SCOPE_OWNERS = Object.freeze({
  single: "Una persona responsable del proceso y de validar el piloto.",
  team: "Una persona del equipo usuaria del sistema y otra responsable de su resultado.",
  cross: "Responsables de cada área implicada y una persona que pueda resolver conflictos entre departamentos."
});

function safeText(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function list(items) {
  return "<ul>" + items.map(item => "<li>" + safeText(item) + "</li>").join("") + "</ul>";
}
function field(label, value) {
  return '<div class="field"><small>' + safeText(label) + '</small><strong>' + safeText(value) + "</strong></div>";
}
function phase(index, name, action, result) {
  return '<article class="phase"><span class="step">' + index + '</span><div><h3>' +
    safeText(name) + "</h3><p>" + safeText(action) + "</p><small>Salida comprobable</small><p>" +
    safeText(result) + "</p></div></article>";
}

/**
 * Returns a portable HTML action plan with no source rows, emails, identifiers or tracking.
 * Answers are accepted only from the fixed diagnostic catalogs. The same inputs produce
 * identical bytes for reproducible review.
 */
export function buildDiagnosticReport(problem, tools = "unknown", scope = "team") {
  const diagnostic = buildDiagnostic(problem, tools, scope);
  if (!diagnostic) return null;
  const toolKey = Object.hasOwn(TOOLS, tools) ? tools : "unknown";
  const scopeKey = Object.hasOwn(SCOPES, scope) ? scope : "team";
  const item = PLAYBOOK[problem];
  const phases = [
    { name: "Delimitar y medir", action: item.baseline, result: "Mapa del proceso, dueño, punto de partida y criterios de éxito." },
    { name: "Construir un piloto", action: item.pilot, result: diagnostic.deliverable },
    { name: "Validar y entregar", action: item.handover, result: "Pruebas de aceptación, gestión de excepciones y guía de mantenimiento." }
  ];
  const inputs = [
    "Dos o tres ejemplos ficticios o anonimizados, nunca contraseñas ni datos reales de clientes.",
    TOOL_INPUT[toolKey],
    SCOPE_OWNERS[scopeKey]
  ];
  const acceptance = [
    "El responsable reproduce un caso normal y uno excepcional con resultados explicables.",
    diagnostic.verification,
    "Los fallos dejan una indicación clara y no se ejecutan acciones sensibles sin aprobación."
  ];
  const constraints = [
    toolKey === "unknown"
      ? "La tecnología sigue sin confirmar; primero hay que identificar las herramientas existentes."
      : toolKey === "mixed"
        ? "Las conexiones entre sistemas, permisos y calidad de datos pueden cambiar el alcance."
        : "Accesos, calidad de datos y límites de la herramienta deben verificarse antes de integrar.",
    scopeKey === "cross"
      ? "El alcance transversal requiere acordar responsables y criterios comunes entre áreas."
      : "El alcance se limita al proceso inicial hasta verificar los resultados.",
    "No se ha realizado una auditoría, integración real ni medición de ahorro con estos datos."
  ];
  const criteria = [item.signal, ...acceptance];
  const intro = diagnostic.headline;
  const html = [
    '<!doctype html><html lang="es"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="color-scheme" content="light"><meta name="robots" content="noindex,nofollow">',
    "<title>RevOps Studio · Plan inicial de proceso</title>",
    "<style>",
    ":root{font-family:Arial,Helvetica,sans-serif;color:#172331;background:#f2f5f6}",
    "*{box-sizing:border-box}body{margin:0;padding:32px 18px}main{max-width:900px;margin:auto;background:white;padding:46px;box-shadow:0 12px 60px #1124381a;border-radius:14px}",
    ".top{border-bottom:3px solid #237b75;padding-bottom:24px}.brand{letter-spacing:.15em;font-size:12px;font-weight:800;color:#237b75}",
    ".eyebrow{font-size:11px;letter-spacing:.11em;color:#4a6b73;text-transform:uppercase;font-weight:700}",
    "h1{font-size:34px;letter-spacing:-.045em;line-height:1.12;margin:13px 0 12px}h2{font-size:19px;margin:30px 0 13px}",
    "h3{font-size:15px;margin:0 0 9px}p,li{font-size:13px;line-height:1.65;color:#31434d}ul{padding-left:21px}",
    ".lede{font-size:15px;max-width:700px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:24px}",
    ".field{background:#eaf3f1;padding:15px;border-radius:9px;min-width:0}.field small{display:block;font-size:10px;color:#3d6f70;letter-spacing:.04em;margin-bottom:8px}.field strong{font-size:12px;line-height:1.5;overflow-wrap:anywhere}",
    ".phase{display:flex;gap:15px;padding:16px 0;border-top:1px solid #d9e6e5;break-inside:avoid}.step{flex:0 0 31px;height:31px;background:#237b75;color:white;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800}",
    ".phase p{margin:5px 0 10px}.phase small{font-weight:700;color:#237b75;font-size:11px}",
    ".split{display:grid;grid-template-columns:1fr 1fr;gap:26px}.note{background:#f2f6f5;border-left:4px solid #237b75;padding:15px 19px;border-radius:5px}",
    ".note p{margin:6px 0}.fineprint{margin-top:28px;padding-top:18px;border-top:1px solid #d9e6e5;font-size:11px;color:#556973}",
    "@media(max-width:640px){body{padding:0}main{padding:24px 18px;border-radius:0}h1{font-size:27px}.grid,.split{grid-template-columns:1fr}}",
    "@media print{@page{size:A4;margin:14mm}body{padding:0;background:white}main{padding:0;box-shadow:none;max-width:none}.field,.note,.phase{break-inside:avoid}h2{break-after:avoid}}",
    "</style></head><body><main>",
    '<header class="top"><div class="brand">REVOPS STUDIO</div>',
    '<p class="eyebrow">Diagnóstico orientativo · Plan R1 · Archivo local</p>',
    "<h1>De un problema a un plan verificable.</h1>",
    '<p class="lede">' + safeText(intro) + "</p></header>",
    '<section><h2>01 · Punto de partida</h2><div class="grid">',
    field("Problema", diagnostic.problem),
    field("Herramientas declaradas", diagnostic.tools),
    field("Alcance declarado", diagnostic.scope),
    "</div></section>",
    '<section><h2>02 · Ruta inicial</h2>',
    '<div class="note"><p><strong>Especialidad sugerida: </strong>' + safeText(diagnostic.service) +
      ' · ' + safeText(diagnostic.packageType) + "</p><p>" + safeText(diagnostic.firstStep) + "</p></div>",
    phases.map((p, i) => phase(String(i + 1).padStart(2, "0"), p.name, p.action, p.result)).join(""),
    "</section>",
    '<section class="split"><div><h2>03 · Qué necesitamos</h2>' + list(inputs) + '</div>',
    '<div><h2>04 · Cómo aceptar el piloto</h2>' + list(criteria) + "</div></section>",
    '<section class="split"><div><h2>05 · Riesgos y supuestos</h2>' + list(constraints) + '</div>',
    '<div><h2>06 · Preguntas antes de presupuestar</h2>' + list([
      item.question,
      "¿Qué resultado aceptaría el responsable como una mejora comprobada?",
      "¿Quién aprobará cambios, accesos y excepciones?"
    ]) + "</div></section>",
    '<section><h2>07 · Alcance y presupuesto orientativos</h2><div class="note"><p>' +
      safeText(diagnostic.packageNote) + '</p><p>La duración, el precio final, las integraciones, la disponibilidad de soporte y el mantenimiento se acuerdan únicamente tras revisar el proceso real.</p></div></section>',
    '<footer class="fineprint">Generado localmente a partir de tres selecciones genéricas. No incorpora información personal, datos importados ni métricas de clientes. No se transmite automáticamente, no ejecuta operaciones en CRM y no constituye contrato ni presupuesto vinculante. Puedes guardarlo o imprimirlo como PDF desde tu navegador.</footer>',
    "</main></body></html>"
  ].join("");
  return Object.freeze({
    filename: "revops-plan-" + problem + "-" + scopeKey + ".html",
    html, phases, inputs, acceptance, constraints,
    title: PROBLEMS[problem].label,
    service: diagnostic.service
  });
}

export function downloadPlan(problem, tools, scope) {
  const report = buildDiagnosticReport(problem, tools, scope);
  if (!report) return false;
  const url = URL.createObjectURL(new Blob([report.html], { type: "text/html;charset=utf-8" }));
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = report.filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    // Safari and mobile browsers may still be consuming the blob when click() returns.
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  return true;
}
