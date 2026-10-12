import test from "node:test";
import assert from "node:assert/strict";
import {mountPilotUX,pilotUXCopy,PILOT_UX_PREVIEW_STEPS} from "../assets/js/pilot-ux-progressive.js";
import {readFileSync} from "node:fs";
const read=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
function node(){
 const listeners=new Map();
 return {
  hidden:false,textContent:"",attrs:{},focusCount:0,
  addEventListener:(event,handler)=>listeners.set(event,handler),
  click(){listeners.get("click")?.();},
  focus(){this.focusCount++;},
  setAttribute(k,v){this.attrs[k]=v;},
  getAttribute(k){return this.attrs[k];}
 };
}
function rig(){
 const map=new Map([
  ["pilotUXDetails",node()],["pilotUXToggle",node()],
  ["pilotUXClose",node()],["pilotUXMore",node()],
  ["pilotUXStatus",node()],["pilotV100Title",node()],
  ["pilotGuidedList",node()],
  ["pilotSectionNavigation button[data-pilot-section]",node()]
 ]);
 const root={dataset:{},querySelector(selector){return map.get(selector.slice(1))??null;}};
 return {root,map,get:id=>map.get(id)};
}
test("UX V100: summary by default, shortlist, accessible keyboard detail and close",()=>{
 const {root,get}=rig();let closed=0;
 const ui=mountPilotUX(root,{onClose:()=>closed++});
 assert.equal(ui.mode,"summary");
 assert.equal(get("pilotUXDetails").hidden,true);
 assert.equal(get("pilotUXToggle").getAttribute("aria-expanded"),"false");
 ui.setPending(9);
 assert.equal(get("pilotUXMore").hidden,false);
 assert.match(get("pilotUXStatus").textContent,/Mostrando 3 de 9/);
 get("pilotUXToggle").click();
 assert.equal(ui.mode,"details");
 assert.equal(get("pilotUXDetails").hidden,false);
 assert.equal(get("pilotUXToggle").getAttribute("aria-expanded"),"true");
 assert.equal(get("pilotSectionNavigation button[data-pilot-section]").focusCount,1);
 get("pilotUXToggle").click();
 assert.equal(ui.mode,"summary");
 assert.equal(get("pilotUXToggle").focusCount,1);
 get("pilotUXMore").click();
 assert.equal(ui.mode,"details");
 ui.reset();
 assert.equal(ui.mode,"summary");
 assert.equal(get("pilotUXMore").hidden,true);
 get("pilotUXClose").click();
 assert.equal(closed,1);
});
test("UX V100: guard against invalid counts and missing accessible controls",()=>{
 assert.throws(()=>pilotUXCopy("fabricated",2));
 assert.throws(()=>pilotUXCopy("summary",-1));
 assert.equal(PILOT_UX_PREVIEW_STEPS,3);
 const {root}=rig();const ui=mountPilotUX(root,{onClose:()=>{}});
 assert.throws(()=>ui.setPending(-2));
 assert.throws(()=>ui.setPending(1.3));
 assert.throws(()=>mountPilotUX(root));
 assert.throws(()=>mountPilotUX({querySelector:()=>null},{onClose:()=>{}}));
});
test("UX V100: progressive HTML wraps advanced navigator and the real controls",()=>{
 const html=read("demo.html"),css=read("assets/css/workflow-demo.css");
 const js=read("assets/js/pilot-control-center.js");
 const audit=read("scripts/ux-audit.mjs");
 for(const id of ["pilotUXToggle","pilotUXClose","pilotUXMore","pilotUXStatus","pilotUXDetails"])
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 assert.ok(html.indexOf('id="pilotUXDetails"')<html.indexOf('id="pilotSectionNavigation"'));
 assert.ok(html.indexOf('id="pilotUXDetails"')<html.indexOf('id="pilotControlRisks"'));
 assert.ok(html.indexOf('id="pilotV100Title"')<html.indexOf('id="pilotUXDetails"'));
 assert.match(js,/ux\.showDetails\(\);sectionNavigation\.selectById/);
 assert.match(js,/ux\.showDetails\(\);const target=/);
 assert.match(js,/ux\.reset\(\)/);
 assert.match(css,/\.pilot-ux-details\[hidden\],\.pilot-ux-more\[hidden\]\{display:none!important\}/);
 assert.match(css,/#pilotGuidedList>li:nth-child\(n\+4\)/);
 assert.doesNotMatch(read("assets/js/pilot-ux-progressive.js"),
  /fetch\(|localStorage|sessionStorage|XMLHttpRequest/);
 assert.match(audit,/productionGo:false/);
});
