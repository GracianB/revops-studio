import test from "node:test";
import assert from "node:assert/strict";
import {nextVisibleRow,contrastRatio,meetsContrast,ROW_KEYS,focusHeading} from "../assets/js/a11y-workbench.js";

test("PR78: arrow navigation preserves source indexes in a sorted/filtered table",()=>{
 const rows=[9,3,6,1];
 assert.equal(nextVisibleRow(rows,9,"ArrowDown"),3);
 assert.equal(nextVisibleRow(rows,3,"ArrowUp"),9);
 assert.equal(nextVisibleRow(rows,9,"ArrowUp"),1);
 assert.equal(nextVisibleRow(rows,1,"ArrowDown"),9);
 assert.equal(nextVisibleRow(rows,6,"Home"),9);
 assert.equal(nextVisibleRow(rows,6,"End"),1);
 assert.equal(nextVisibleRow(rows,99,"ArrowDown"),9);
 assert.equal(nextVisibleRow(rows,3,"Enter"),null);
});
test("PR78: single result, empty and duplicate-index paths cannot cause invalid focus",()=>{
 assert.equal(nextVisibleRow([],0,"End"),null);
 assert.equal(nextVisibleRow(null,0,"Home"),null);
 assert.equal(nextVisibleRow(["bad",2],2,"ArrowDown"),2);
 assert.equal(nextVisibleRow([7],7,"ArrowUp"),7);
 assert.deepEqual(ROW_KEYS,["ArrowDown","ArrowUp","Home","End"]);
});
test("PR78: WCAG contrast computation handles dark and light palettes and thresholds",()=>{
 assert.ok(Math.abs(contrastRatio("#000000","#ffffff")-21)<.001);
 assert.equal(contrastRatio("#ff0000","#ff0000"),1);
 assert.equal(meetsContrast("#f3f6f9","#05070b"),true);
 assert.equal(meetsContrast("#97a3b2","#0b1017"),true);
 assert.equal(meetsContrast("#212a36","#ffffff"),true);
 assert.equal(meetsContrast("#aaaaaa","#ffffff"),false);
 assert.equal(meetsContrast("#808080","#ffffff",true),true);
 assert.throws(()=>contrastRatio("red","#000000"),/hexadecimal/);
 assert.throws(()=>contrastRatio("#ffffff","#fff"),/hexadecimal/);
});
test("PR78: focus on headings only if the controlled panel is open",()=>{
 let calls=0;
 const heading={tabIndex:undefined,focus(){calls++;doc.activeElement=this;}};
 const section={hidden:false};
 const doc={activeElement:null,getElementById(id){
  return id==="panel"?section:id==="panelTitle"?heading:null;
 }};
 assert.equal(focusHeading(doc,"panel","panelTitle"),true);
 assert.equal(heading.tabIndex,-1);
 assert.equal(calls,1);
 section.hidden=true;
 assert.equal(focusHeading(doc,"panel","panelTitle"),false);
 assert.equal(calls,1);
 assert.equal(focusHeading(doc,"missing","panelTitle"),false);
});
