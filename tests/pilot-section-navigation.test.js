import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PILOT_SECTIONS} from "../assets/js/pilot-section-navigation.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("PR91: eight section headings are unique, focusable and in navigation order",()=>{
 const html=read("demo.html");
 assert.equal(PILOT_SECTIONS.length,8);
 for(const {id,label} of PILOT_SECTIONS){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  assert.ok(html.includes('data-pilot-section="'+id+'"'),label);
  assert.match(html,new RegExp('<h[345] id="'+id+'" tabindex="-1"'));
 }
 const positions=PILOT_SECTIONS.map(s=>html.indexOf('id="'+s.id+'"'));
 assert.ok(positions.every((p,i)=>p>0&&(i===0||p>positions[i-1])));
});
test("PR91: navigation announces location and is wired without external state",()=>{
 const js=read("assets/js/pilot-section-navigation.js");
 const console=read("assets/js/pilot-control-center.js");
 const css=read("assets/css/workflow-demo.css");
 assert.match(js,/aria-current/);
 assert.match(js,/ArrowRight/);
 assert.match(js,/ArrowLeft/);
 assert.match(js,/scrollIntoView/);
 assert.match(console,/mountPilotSectionNavigation\(root\)/);
 assert.match(console,/sectionNavigation\.reset\(\)/);
 assert.match(css,/pilot-section-controls button:focus-visible/);
 assert.doesNotMatch(js,/fetch\(|localStorage|sessionStorage|XMLHttpRequest/);
});
