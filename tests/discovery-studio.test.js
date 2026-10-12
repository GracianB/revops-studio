import test from "node:test";
import assert from "node:assert/strict";
import {PROBLEMS,TOOLS,SCOPES} from "../assets/js/diagnostic.js";
import {DISCOVERY_OPTIONS,buildDiscoveryBrief,formatDiscoveryBrief,discoveryJson} from "../assets/js/discovery-engine.js";

const basic={problem:"reporting",tools:"mixed",scope:"team",role:"analyst",outcome:"quality",urgency:"quarter",stage:"mapped",owner:"assigned",sample:"ready",integration:"local",sensitivity:"normal"};
test("PR71: every base combination is a distinct, inspectable project brief",()=>{
 let count=0;
 for(const problem of Object.keys(PROBLEMS))
  for(const tools of Object.keys(TOOLS))
   for(const scope of Object.keys(SCOPES)){
    const b=buildDiscoveryBrief({...basic,problem,tools,scope});
    assert.ok(b.service&&b.packageType&&b.deliverable&&b.readiness);
    assert.equal(b.phases.length,3);
    assert.equal(b.acceptance.length,4);
    assert.match(formatDiscoveryBrief(b),/ACEPTACIÓN VERIFICABLE/);
    assert.match(formatDiscoveryBrief(b),/RIESGOS Y EXCLUSIONES/);
    count++;
   }
 assert.equal(count,48);
});
test("PR71: four visitor roles and four measurable outcomes are preserved",()=>{
 for(const role of Object.keys(DISCOVERY_OPTIONS.role))
  for(const outcome of Object.keys(DISCOVERY_OPTIONS.outcome)){
   const b=buildDiscoveryBrief({...basic,role,outcome});
   assert.equal(b.fields.role,DISCOVERY_OPTIONS.role[role]);
   assert.equal(b.fields.outcome,DISCOVERY_OPTIONS.outcome[outcome]);
  }
});
test("PR71: viability is gated by actual declarations, not made-up confidence scores",()=>{
 const ready=buildDiscoveryBrief({...basic,stage:"approved"});
 assert.match(ready.readiness,/Candidato/);
 assert.deepEqual(ready.gaps,["Sin condiciones adicionales detectadas en el formulario; verificar caso real."]);
 const missing=buildDiscoveryBrief({...basic,owner:"unknown",sample:"none",integration:"required",urgency:"priority"});
 assert.match(missing.readiness,/pendientes/);
 assert.ok(missing.gaps.some(x=>/Designar/.test(x)));
 assert.ok(missing.gaps.some(x=>/muestras/.test(x)));
 assert.ok(missing.gaps.some(x=>/APIs/.test(x)));
 assert.ok(missing.gaps.some(x=>/fecha/.test(x)));
 assert.equal(missing.risks.length,3);
 const sensitive=buildDiscoveryBrief({...basic,sensitivity:"restricted"});
 assert.match(sensitive.readiness,/privacidad/);
 assert.match(formatDiscoveryBrief(sensitive),/base legal/);
});
test("PR71: notes are bounded and never interpreted as executable HTML by the engine",()=>{
 const b=buildDiscoveryBrief({...basic,goal:"<img src=x onerror=alert(1)>",constraint:"x".repeat(400),exclusion:"\u0000abc\nxyz"});
 assert.equal(b.goal,"<img src=x onerror=alert(1)>");
 assert.equal(b.constraint.length,240);
 assert.equal(b.exclusion,"abc xyz");
 assert.match(formatDiscoveryBrief(b),/Primer entregable/);
 assert.equal(formatDiscoveryBrief(b),formatDiscoveryBrief(buildDiscoveryBrief({...basic,goal:b.goal,constraint:b.constraint,exclusion:b.exclusion})));
});
test("PR71: unknown catalog values are normalized without inventing answers",()=>{
 assert.equal(buildDiscoveryBrief({problem:"unknown"}),null);
 assert.equal(buildDiscoveryBrief(null),null);
 const b=buildDiscoveryBrief({...basic,role:"<script>",outcome:"unavailable",owner:"unknown",sample:"none",sensitivity:"fake"});
 assert.equal(b.fields.role,DISCOVERY_OPTIONS.role.operations);
 assert.equal(b.fields.outcome,DISCOVERY_OPTIONS.outcome.quality);
 assert.equal(b.fields.sensitivity,DISCOVERY_OPTIONS.sensitivity.normal);
 assert.match(b.readiness,/pendientes/);
});
test("PR71: no contact details or raw rows in pure exports by default; structured JSON stays local",()=>{
 const b=buildDiscoveryBrief(basic);
 const report=formatDiscoveryBrief(b);
 assert.doesNotMatch(report,/gracianbaenagonzalez|https?:\/\/|mailto:|formsubmit|fetch\(/i);
 assert.match(report,/PROYECTO|DESCUBRIMIENTO/);
 assert.match(report,/PRUEBA LOCAL SUGERIDA: demo.html\?scenario=data/);
 const parsed=JSON.parse(discoveryJson(b));
 assert.equal(parsed.schema,"revops-discovery-brief-v1");
 assert.equal(parsed.state,"proposal_not_executed");
 assert.deepEqual(parsed.data.fields,b.fields);
 assert.equal(discoveryJson(b),discoveryJson(buildDiscoveryBrief(basic)));
 assert.throws(()=>formatDiscoveryBrief(null),/Primero/);
 assert.throws(()=>discoveryJson(null),/Primero/);
});
test("PR71: problem-to-demonstration routes do not leak user input into URL",()=>{
 for(const [problem,demo] of [["repetitive","orders"],["reporting","data"],["knowledge","support"],["rules","orders"]]){
  const b=buildDiscoveryBrief({...basic,problem,goal:"secret_user_supplied_text"});
  assert.equal(b.demo,demo);
  assert.match(formatDiscoveryBrief(b),new RegExp("scenario="+demo));
  assert.doesNotMatch("demo.html?scenario="+b.demo,/secret_user_supplied_text/);
 }
});
