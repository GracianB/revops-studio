// V100 UX consolidation · progressive disclosure of the pilot console.
// One in-memory presentation state. Never stores CSV values or changes decisions.
export const PILOT_UX_MODES=Object.freeze(["summary","details"]);
export const PILOT_UX_PREVIEW_STEPS=3;
export function pilotUXCopy(mode,pending){
 if(!PILOT_UX_MODES.includes(mode)||!Number.isInteger(pending)||pending<0)
  throw Error("Vista de piloto incompatible.");
 return Object.freeze({
  mode,
  button:mode==="summary"?"Explorar herramientas y evidencias":"Volver al resumen",
  heading:mode==="summary"?
   "Vista esencial: decisiones prioritarias, riesgos y siguiente paso.":
   "Vista completa: riesgos, evidencia, ensayos y controles técnicos.",
  route:mode==="summary"&&pending>PILOT_UX_PREVIEW_STEPS?
   "Mostrando "+PILOT_UX_PREVIEW_STEPS+" de "+pending+
     " pasos pendientes. Abre la vista completa para revisar todos.":
   pending+" pasos pendientes visibles."
 });
}
export function mountPilotUX(root,{onClose}={}){
 if(!root?.querySelector||typeof onClose!=="function")
  throw Error("La vista progresiva necesita consola y cierre accesible.");
 const get=id=>root.querySelector("#"+id);
 const region=get("pilotUXDetails"),toggle=get("pilotUXToggle"),
  close=get("pilotUXClose"),more=get("pilotUXMore"),status=get("pilotUXStatus");
 if(!region||!toggle||!close||!more||!status||
  !root.querySelector("#pilotV100Title")||!root.querySelector("#pilotGuidedList"))
  throw Error("Faltan controles de progresión en el piloto.");
 let mode="summary",pending=0;
 function paint(){
  const copy=pilotUXCopy(mode,pending);
  root.dataset.pilotUx=mode;
  region.hidden=mode!=="details";
  toggle.textContent=copy.button;
  toggle.setAttribute("aria-expanded",String(mode==="details"));
  status.textContent=copy.heading+" "+copy.route;
  more.hidden=mode==="details"||pending<=PILOT_UX_PREVIEW_STEPS;
 }
 function showDetails({focus=false}={}){
  mode="details";paint();
  if(focus)root.querySelector("#pilotSectionNavigation button[data-pilot-section]")?.focus();
 }
 function showSummary({focus=false}={}){
  mode="summary";paint();
  if(focus)toggle.focus();
 }
 function setPending(count){
  if(!Number.isInteger(count)||count<0)throw Error("Contador de pasos inválido.");
  pending=count;paint();
 }
 toggle.addEventListener("click",()=>mode==="summary"?
  showDetails({focus:true}):showSummary({focus:true}));
 more.addEventListener("click",()=>showDetails({focus:true}));
 close.addEventListener("click",onClose);
 paint();
 return Object.freeze({
  showDetails,showSummary,setPending,
  get mode(){return mode;},
  reset(){pending=0;showSummary();}
 });
}
