// PR78 · accessibility primitives for keyboard/reflow. No storage, network or user data.
// Arrow/Home/End changes focus only, never edits or submits a record.
export const ROW_KEYS=Object.freeze(["ArrowDown","ArrowUp","Home","End"]);
export function nextVisibleRow(rows,activeIndex,key){
 if(!ROW_KEYS.includes(key))return null;
 if(!Array.isArray(rows)||rows.length===0)return null;
 const values=rows.filter(Number.isInteger);
 if(!values.length)return null;
 const start=values.indexOf(activeIndex);
 if(key==="Home")return values[0];
 if(key==="End")return values[values.length-1];
 if(start<0)return values[0];
 return values[(start+(key==="ArrowDown"?1:-1)+values.length)%values.length];
}
export function contrastRatio(hexA,hexB){
 const luminance=hex=>{
  if(typeof hex!=="string"||!/^#[\da-f]{6}$/i.test(hex))
   throw Error("El color debe estar en formato hexadecimal RGB.");
  const v=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(n=>
   n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
  return .2126*v[0]+.7152*v[1]+.0722*v[2];
 };
 const a=luminance(hexA),b=luminance(hexB);
 return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
export function meetsContrast(foreground,background,largeText=false){
 return contrastRatio(foreground,background)>=(largeText?3:4.5);
}
export function getFocusableIn(root){
 return [...root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
  .filter(el=>!el.hidden&&!el.closest("[hidden]")&&
   el.getClientRects().length>0&&getComputedStyle(el).visibility!=="hidden");
}
export function installAccessibleNavigation({document:doc,openRow,closePanels,cancelDiscard}){
 const $=id=>doc.getElementById(id);
 if(!doc||typeof openRow!=="function"||typeof closePanels!=="function"||
    typeof cancelDiscard!=="function")throw Error("Instalación de accesibilidad inválida.");
 const body=$("workflowRows");
 const onRows=event=>{
  const btn=event.target.closest("button.workbench-row-edit");
  if(!btn||!body.contains(btn)||!ROW_KEYS.includes(event.key))return;
  const candidates=[...body.querySelectorAll(".workbench-row:not([hidden]) .workbench-row-edit")].filter(b=>
   !b.disabled&&b.getClientRects().length>0);
  const source=candidates.map(b=>Number(b.dataset.editIndex));
  const index=nextVisibleRow(source,Number(btn.dataset.editIndex),event.key);
  const next=candidates.find(b=>Number(b.dataset.editIndex)===index);
  if(!next)return;
  event.preventDefault();
  next.focus({preventScroll:true});
  next.scrollIntoView({block:"nearest",inline:"nearest",behavior:"instant"});
 };
 const keydown=event=>{
  if(!$("scenarioDiscard").hidden && ["Escape","Tab"].includes(event.key)){
   if(event.key==="Escape"){
    event.preventDefault();event.stopPropagation();
    cancelDiscard();return;
   }
   const controls=getFocusableIn($("scenarioDiscard"));
   if(!controls.length){event.preventDefault();return;}
   const at=controls.indexOf(doc.activeElement);
   if(event.shiftKey && at<=0){event.preventDefault();controls[controls.length-1].focus();}
   else if(!event.shiftKey && at===controls.length-1){event.preventDefault();controls[0].focus();}
   return;
  }
  if(event.key!=="Escape"||event.defaultPrevented)return;
  const target=closePanels();
  if(target){event.preventDefault();event.stopPropagation();}
 };
 body.addEventListener("keydown",onRows);
 // capture avoids escape propagation into old handlers for panels that own it.
 doc.addEventListener("keydown",keydown,true);
 return Object.freeze({dispose(){
  body.removeEventListener("keydown",onRows);
  doc.removeEventListener("keydown",keydown,true);
 }});
}
export function focusHeading(document,sectionId,titleId){
 const section=document.getElementById(sectionId),heading=document.getElementById(titleId);
 if(!section||section.hidden||!heading)return false;
 heading.tabIndex=-1;
 heading.focus({preventScroll:true});
 return document.activeElement===heading;
}
