// PR80 integrated acceptance. Synthetic fixtures ONLY. No deployment or external IO.
import assert from "node:assert/strict";
import {SCENARIOS,runWorkflow,editWorkflowRecord,exportResultCsv,exportActionQueueCsv}
 from "../assets/js/workflow-engine.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {buildQualityCockpit} from "../assets/js/quality-cockpit.js";
import {describePolicy} from "../assets/js/workflow-policy.js";
import {parseDelimited} from "../assets/js/workflow-engine.js";
import {createExecutiveSnapshot,generateReportPdf} from "../assets/js/executive-pdf.js";
import {assessPilotReadiness,pilotReadinessText,pilotReadinessJson}
 from "../assets/js/pilot-readiness.js";
import {simulateCandidate,presetFor} from "../assets/js/scenario-builder.js";
import {inspectDataExposure} from "../assets/js/privacy-security.js";

let cases=0,pages=0;
for(const type of Object.keys(SCENARIOS)){
 for(const mode of Object.keys(RECIPE_LABELS)){
  const source=recipe(type,mode),result=runWorkflow(type,source);
  const gate=assessPilotReadiness(type,source,result);
  const quality=buildQualityCockpit(type,source,result);
  const rules=describePolicy(type,source,result,parseDelimited);
  const candidate=simulateCandidate(type,source,presetFor(type,"base"));
  const report=createExecutiveSnapshot({scenario:type,result,quality,policy:rules,candidate});
  const pdf=generateReportPdf(report);
  const text=Buffer.from(pdf).toString("latin1");
  assert.equal(gate.metrics.total,result.counts.total);
  assert.equal(gate.metrics.blocked,quality.flags.blocked.count);
  assert.equal(gate.metrics.review,quality.flags.reviewing.count);
  assert.equal(rules.traces.length,gate.metrics.total);
  assert.equal(candidate.changedIndexes.length,0);
  assert.equal(gate.actionsExecuted,0);
  assert.equal(gate.realApprovals,0);
  assert.equal(inspectDataExposure(result).externallyTransmitted,0);
  assert.ok(exportResultCsv(result).startsWith("\uFEFF"));
  const queue=exportActionQueueCsv(result);
  assert.ok(queue.startsWith("\uFEFF"));
  if(gate.metrics.prepared>0)assert.ok(queue.includes("NO ejecutado"));
  else assert.equal(queue.trim().split(/\r?\n/).length,1,"empty queue contains header only");
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.ok(text.endsWith("%%EOF\n"));
  assert.ok(!text.includes("PED-101"));
  assert.ok(JSON.parse(pilotReadinessJson(gate)).checks.length===8);
  assert.ok(!pilotReadinessText(gate).includes("PED-101"));
  const count=Number(text.match(/\/Type \/Pages \/Count (\d+)/)?.[1]||0);
  assert.ok(count>=1&&count<=24);
  pages+=count;cases++;
 }
 const clean=recipe(type,"clear");
 assert.equal(assessPilotReadiness(type,clean).suitableForSupervisedDemo,true);
}
assert.equal(cases,18);
const original=SCENARIOS.orders.sample;
const corrected=editWorkflowRecord("orders",original,2,{pedido:"PED-900"});
assert.equal(assessPilotReadiness("orders",corrected).metrics.blocked,
 assessPilotReadiness("orders",original).metrics.blocked-1);
console.log("PR80 ACCEPTANCE PASS: 3 workflows, "+cases+
 " synthetic fixtures, "+pages+" PDF pages, motor/rules/privacy/quality/candidate/evidence parity and correction");
