// PR91 · An accessible map of the eight existing workbench sections.
// Roving tabindex is confined to the navigation, not the individual panels.
export const PILOT_SECTIONS=Object.freeze([
 ["pilotControlRiskTitle","Riesgos"],["pilotControlEvidenceTitle","Evidencias"],
 ["pilotControlDrillTitle","Defensas"],["pilotCapacityHeading","Capacidad"],
 ["pilotAuthorizationHeading","Autorización"],["pilotHandoffHeading","Entrega"],
 ["pilotStressHeading","Muestras"],["pilotAtlasHeading","Validación"]
].map(([id,label])=>Object.freeze({id,label})));

export function mountPilotSectionNavigation(root){
 if(!root?.querySelector)throw Error("Falta el centro de control.");
 const nav=root.querySelector("#pilotSectionNavigation");
 const buttons=[...nav?.querySelectorAll("button[data-pilot-section]")||[]];
 if(buttons.length!==PILOT_SECTIONS.length||
    buttons.some((button,i)=>button.dataset.pilotSection!==PILOT_SECTIONS[i].id||
     !root.querySelector("#"+PILOT_SECTIONS[i].id)))
  throw Error("Índice de secciones del piloto incompleto.");
 const announcement=root.querySelector("#pilotSectionAnnouncement");
 let active=0;
 const mark=index=>{
  active=index;
  buttons.forEach((b,i)=>{
   b.tabIndex=i===index?0:-1;
   b.setAttribute("aria-current",i===index?"location":"false");
  });
  announcement.textContent="Sección "+(index+1)+" de "+buttons.length+
   ": "+PILOT_SECTIONS[index].label+".";
 };
 const activate=index=>{
  if(!Number.isInteger(index)||index<0||index>=buttons.length)
   throw Error("Sección no reconocida.");
  mark(index);
  const target=root.querySelector("#"+PILOT_SECTIONS[index].id);
  target.focus({preventScroll:true});
  target.scrollIntoView({behavior:"instant",block:"start"});
 };
 buttons.forEach((button,index)=>{
  button.addEventListener("click",()=>activate(index));
  button.addEventListener("keydown",event=>{
   const moves={ArrowRight:index+1,ArrowDown:index+1,
    ArrowLeft:index-1,ArrowUp:index-1,Home:0,End:buttons.length-1};
   if(!Object.hasOwn(moves,event.key))return;
   event.preventDefault();
   const next=(moves[event.key]+buttons.length)%buttons.length;
   mark(next);
   buttons[next].focus();
  });
 });
 mark(0);
 return Object.freeze({
  reset(){mark(0);},
  selectById(id){const index=PILOT_SECTIONS.findIndex(s=>s.id===id);activate(index);}
 });
}
