import test from "node:test";
import assert from "node:assert/strict";
import {MANUAL_A11Y_REVIEWS,runPilotAccessibilityPreflight,pilotAccessibilityJson}
 from "../assets/js/pilot-accessibility-protocol.js";
import {validatePilotExportJson} from "../assets/js/pilot-export-integrity.js";
const IDS=["pilotControlRiskTitle","pilotControlEvidenceTitle","pilotControlDrillTitle",
 "pilotCapacityHeading","pilotAuthorizationHeading","pilotHandoffHeading",
 "pilotStressHeading","pilotAtlasHeading"];
function fakeDOM(options={}){
 const nav=IDS.map(id=>({dataset:{pilotSection:id}}));
 const selects=["pilotControlFilter","pilotCapacityRoleLimit"].map(id=>({id}));
 return {hidden:Boolean(options.hidden),
  querySelectorAll(query){
   if(query==="select")return selects;
   if(query==="#pilotSectionNavigation button[data-pilot-section]")return options.shortNav?nav.slice(0,7):nav;
   if(query===".pilot-capacity-scroll"||query===".pilot-stress-scroll")
    return [{tabIndex:0,getAttribute:k=>k==="role"?"region":"Tabla",hasAttribute:()=>true}];
   return [];
  },
  querySelector(selector){
   if(selector.startsWith("label[for="))return options.missingLabels?null:{};
   if(selector==='[data-evidence-id="E-SIGNOFF"]')return {disabled:true};
   const id=selector.slice(1);
   if(IDS.includes(id))return {tagName:"H4",tabIndex:-1};
   if(["pilotControlSummary","pilotControlStatus","pilotAtlasStatus","pilotFinalReviewStatus","pilotGuidedSummary"].includes(id))
    return {getAttribute:()=> "polite"};
   return null;
  }
 };
}
test("PR98: six local DOM checks are isolated from eight manual obligations",()=>{
 const report=runPilotAccessibilityPreflight(fakeDOM());
 assert.equal(report.automatedTotal,6);
 assert.equal(report.automatedPassed,6);
 assert.equal(report.manualPending,8);
 assert.equal(report.manualVerified,0);
 assert.equal(report.productionGo,false);
 assert.equal(MANUAL_A11Y_REVIEWS.length,8);
 assert.ok(MANUAL_A11Y_REVIEWS.every(x=>x.state==="external_pending"));
 const serialized=pilotAccessibilityJson(report);
 assert.equal(validatePilotExportJson(serialized).valid,true);
});
test("PR98: missing labels or missing nav degrade local checks and never approve manual QA",()=>{
 const broken=runPilotAccessibilityPreflight(fakeDOM({missingLabels:true,shortNav:true}));
 assert.equal(broken.automatedPassed,4);
 assert.equal(broken.manualVerified,0);
 assert.equal(broken.productionGo,false);
 assert.throws(()=>runPilotAccessibilityPreflight(fakeDOM({hidden:true})));
});
test("PR98: export rejects falsely verified manual work or production go-live",()=>{
 const report=runPilotAccessibilityPreflight(fakeDOM());
 assert.throws(()=>pilotAccessibilityJson({...report,manualVerified:1}));
 assert.throws(()=>pilotAccessibilityJson({...report,productionGo:true}));
 assert.throws(()=>pilotAccessibilityJson({...report,manual:report.manual.map(x=>({...x,state:"pass"}))}));
});
