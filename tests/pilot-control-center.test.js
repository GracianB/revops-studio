import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SCENARIOS} from "../assets/js/workflow-engine.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {assessPilotReadiness} from "../assets/js/pilot-readiness.js";
import {createPilotExecutionPlan} from "../assets/js/pilot-plan.js";
import {buildPilotRiskRegister,riskRegisterJson} from "../assets/js/pilot-risk-register.js";
import {buildPilotEvidenceLedger,simulateEvidenceCoverage,evidencePacketJson} from "../assets/js/pilot-evidence-ledger.js";
import {runPilotFailureDrills,pilotDrillReportJson} from "../assets/js/pilot-failure-drills.js";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("PR85: control center has all wired controls with unique element IDs",()=>{
 const html=read("demo.html"),js=read("assets/js/workflow-demo.js");
 const ui=read("assets/js/pilot-control-center.js"),css=read("assets/css/workflow-demo.css");
 const ids=["pilotControlOpen","pilotControlStudio","pilotControlTitle","pilotControlHigh",
 "pilotControlEvidence","pilotControlDrills","pilotControlApproval",
 "pilotControlFilter","pilotControlRisks","pilotControlChecklist","pilotControlDrillList",
 "pilotControlRun","pilotControlExport","pilotControlReset","pilotControlClose","pilotControlStatus"];
 for(const id of ids){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  assert.ok(ui.includes(id)||js.includes(id),id+" not wired");
 }
 assert.match(js,/import\("\.\/pilot-control-center\.js"\)/);
 assert.match(js,/pilotControlConsole\?\.clear/);
 assert.match(js,/\["pilotControlStudio","pilotControlClose"\]/);
 assert.match(css,/body\[data-experience="simple"\] \.workbench-p85/);
});
test("PR85: three scenarios and 18 recipes reconcile same bounded engine modules",()=>{
 for(const scenario of Object.keys(SCENARIOS))for(const fixture of Object.keys(RECIPE_LABELS)){
  const r=assessPilotReadiness(scenario,recipe(scenario,fixture));
  const plan=createPilotExecutionPlan(r),risks=buildPilotRiskRegister(r,plan);
  const ledger=buildPilotEvidenceLedger(plan,risks);
  const drills=runPilotFailureDrills(r,plan,risks,ledger);
  const report={risks:JSON.parse(riskRegisterJson(risks)),
   evidence:JSON.parse(evidencePacketJson(ledger,simulateEvidenceCoverage(ledger))),
   drills:JSON.parse(pilotDrillReportJson(drills))};
  assert.equal(report.risks.risks.length,10);
  assert.equal(report.evidence.items.length,plan.tasks.length);
  assert.equal(report.drills.passed,7);
  assert.equal(report.risks.realApprovals,0);
  assert.equal(report.evidence.realApprovals,0);
  assert.equal(report.drills.realApprovals,0);
 }
});
test("PR85: secrets stay outside integrated exports",()=>{
 const s="pedido;cliente;email;total;estado\nPRIVATE-P85;Sensitive Client;secret@enterprise.com;10;nuevo";
 const r=assessPilotReadiness("orders",s),p=createPilotExecutionPlan(r);
 const risks=buildPilotRiskRegister(r,p);
 const ledger=buildPilotEvidenceLedger(p,risks);
 const drills=runPilotFailureDrills(r,p,risks,ledger);
 const combined=riskRegisterJson(risks)+evidencePacketJson(ledger)+pilotDrillReportJson(drills);
 for(const secret of ["PRIVATE-P85","Sensitive Client","secret@enterprise.com"])
  assert.equal(combined.includes(secret),false);
});
