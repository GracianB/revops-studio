// PR98 · Accessible DOM preflight, with manual checkpoints NEVER auto-approved.
const HEADING_IDS=Object.freeze([
 "pilotControlRiskTitle","pilotControlEvidenceTitle","pilotControlDrillTitle",
 "pilotCapacityHeading","pilotAuthorizationHeading","pilotHandoffHeading",
 "pilotStressHeading","pilotAtlasHeading"
]);
export const MANUAL_A11Y_REVIEWS=Object.freeze([
 ["MAN-01","Navegar toda la práctica con Tab, Shift+Tab y teclado sin ratón",
  "Navegación por todos los campos, avisos, menús, tablas y descargas; foco siempre visible."],
 ["MAN-02","Lector de pantalla NVDA + Firefox",
  "Verificar navegación por títulos, formularios, estados, filtros y resultados dinámicos."],
 ["MAN-03","Lector de pantalla VoiceOver + Safari",
  "Comprobar anuncios y controles en navegador/OS distintos de la CI."],
 ["MAN-04","Zoom real del navegador 200 % y 400 %",
  "Comprobar reflujo, tablas y controles sin perder contenido o funcionalidad."],
 ["MAN-05","Contraste visual y alto contraste del sistema",
  "Revisar enfoque, avisos y etiquetas en temas oscuros/claros y Windows HC."],
 ["MAN-06","Preferencia de movimiento reducido y comprensión",
  "Verificar ausencia de animaciones perturbadoras y lectura comprensible de los límites."],
 ["MAN-07","Dispositivos táctiles y orientación vertical/horizontal",
  "Comprobar objetivos táctiles, desplazamiento contenido y sin gestos exclusivos."],
 ["MAN-08","Revisión humana de mensajes y lenguaje",
  "Verificar que un resultado correcto local no se confunda con aprobación empresarial."]
].map(([id,title,how])=>Object.freeze({id,title,how,state:"external_pending"})));
export function runPilotAccessibilityPreflight(root){
 if(!root?.querySelectorAll||root.hidden)throw Error("Abre la consola antes del análisis de accesibilidad.");
 const nav=[...root.querySelectorAll("#pilotSectionNavigation button[data-pilot-section]")];
 const controls=[...root.querySelectorAll("select")];
 const labels=controls.every(select=>select.id&&!!root.querySelector('label[for="'+select.id+'"]'));
 const headings=HEADING_IDS.every(id=>{
  const el=root.querySelector("#"+id);
  return el&&el.tagName.match(/^H[2-6]$/)&&el.tabIndex===-1;
 });
 const checks=[
  ["AUTO-01","Ocho encabezados con destino de foco",Boolean(headings)],
  ["AUTO-02","Navegación completa por ocho destinos",
   nav.length===8&&nav.every((b,i)=>b.dataset.pilotSection===HEADING_IDS[i])],
  ["AUTO-03","Todos los filtros select tienen etiqueta",labels],
  ["AUTO-04","Estados principales de actualización accesibles",
   ["pilotControlSummary","pilotControlStatus","pilotAtlasStatus","pilotFinalReviewStatus",
    "pilotGuidedSummary"].every(id=>root.querySelector("#"+id)?.getAttribute("aria-live"))],
  ["AUTO-05","Firma externa deshabilitada",
   root.querySelector('[data-evidence-id="E-SIGNOFF"]')?.disabled===true],
  ["AUTO-06","Tablas anchas con región de desplazamiento nombrada",
   ["pilot-capacity-scroll","pilot-stress-scroll"].every(cls=>
    [...root.querySelectorAll("."+cls)].some(e=>
      e.tabIndex===0&&e.getAttribute("role")==="region"&&e.hasAttribute("aria-label")))]
 ].map(([id,title,pass])=>Object.freeze({id,title,state:pass?"local_pass":"attention"}));
 const passed=checks.filter(c=>c.state==="local_pass").length;
 return Object.freeze({
  schema:"revops-pilot-accessibility-v1",
  automatic:Object.freeze(checks),
  manual:MANUAL_A11Y_REVIEWS,
  automatedPassed:passed,automatedTotal:checks.length,
  manualPending:MANUAL_A11Y_REVIEWS.length,manualVerified:0,
  productionGo:false,realApprovals:0,externalExecutions:0,
  disclaimer:"Análisis automático parcial del DOM. Ninguna prueba con lector de pantalla, dispositivo real o revisión humana se certifica aquí."
 });
}
export function pilotAccessibilityJson(report){
 if(report?.schema!=="revops-pilot-accessibility-v1"||
  report.productionGo!==false||report.realApprovals!==0||
  report.externalExecutions!==0||report.manualVerified!==0||
  !Array.isArray(report.automatic)||report.automatic.length!==6||
  !Array.isArray(report.manual)||report.manual.length!==8||
  report.manual.some(x=>x.state!=="external_pending"))
  throw Error("Protocolo de accesibilidad no exportable.");
 return JSON.stringify({
  schema:report.schema,
  automatedPassed:report.automatedPassed,automatedTotal:6,
  manualPending:8,manualVerified:0,
  automatic:report.automatic.map(({id,title,state})=>({id,title,state})),
  manual:report.manual.map(({id,title,how,state})=>({id,title,how,state})),
  productionGo:false,realApprovals:0,externalExecutions:0,
  disclaimer:report.disclaimer
 },null,2)+"\n";
}
