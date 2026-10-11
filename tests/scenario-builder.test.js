import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS,runWorkflow} from "../assets/js/workflow-engine.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {
 SCENARIO_PRESETS,SCENARIO_POLICY_LABELS,normalizeScenarioSettings,presetFor,
 simulateCandidate,encodeScenarioTemplate,decodeScenarioTemplate,scenarioComparisonReport
} from "../assets/js/scenario-builder.js";

test("PR76: base preset is an identity transform for all 18 recipes across three scenarios",()=>{
 let count=0;
 for(const type of Object.keys(SCENARIOS))
  for(const name of Object.keys(RECIPE_LABELS)){
   const source=recipe(type,name),before=runWorkflow(type,source);
   const proposed=simulateCandidate(type,source,presetFor(type,"base"));
   assert.deepEqual(proposed.candidate.counts,before.counts);
   assert.deepEqual(proposed.candidate.rows.map(r=>[r.status,r.reason,r.action]),
    before.rows.map(r=>[r.status,r.reason,r.action]));
   assert.equal(proposed.changedIndexes.length,0);
   assert.deepEqual(proposed.delta,{prepared:0,review:0,blocked:0,historical:0});
   assert.equal(proposed.externalExecuted,0);
   assert.equal(proposed.realApprovals,0);
   count++;
  }
 assert.equal(count,18);
});
test("PR76: strict orders add exactly one review without touching blocked/review/historic",()=>{
 const src=SCENARIOS.orders.sample,proposal=simulateCandidate("orders",src,presetFor("orders","strict"));
 assert.deepEqual(proposal.changedIndexes,[1]);
 assert.equal(proposal.delta.prepared,-1);
 assert.equal(proposal.delta.review,1);
 assert.equal(proposal.delta.blocked,0);
 assert.equal(proposal.baseline.counts.bloqueado,2);
 assert.equal(proposal.candidate.counts.bloqueado,2);
 assert.equal(proposal.candidate.rows[4].status,"revisar");
 assert.equal(proposal.candidate.rows[5].action,"Conservar como histórico");
 assert.match(proposal.candidate.rows[1].reason,/Regla de escenario PR76/);
 assert.equal(src,SCENARIOS.orders.sample);
});
test("PR76: support escalation never reopens closed ticket or skips high priority gate",()=>{
 const source=SCENARIOS.support.sample;
 const draft=simulateCandidate("support",source,{escalateMedium:true});
 assert.deepEqual(draft.changedIndexes,[1]);
 assert.equal(draft.candidate.rows[0].status,"revisar");
 assert.equal(draft.candidate.rows[3].status,"bloqueado");
 assert.equal(draft.candidate.rows[5].status,"listo");
 assert.match(draft.candidate.rows[5].action,/histórico/);
 assert.equal(draft.delta.review,1);
 assert.equal(draft.delta.blocked,0);
 assert.equal(draft.countsByOutcome.alreadyReview,1);
});
test("PR76: numeric high-value scenario is bounded, and negatives still demand human review",()=>{
 const draft=simulateCandidate("data",SCENARIOS.data.sample,{reviewAbove:200});
 assert.deepEqual(draft.changedIndexes,[0,5]);
 assert.equal(draft.delta.review,2);
 assert.equal(draft.candidate.rows[2].status,"bloqueado");
 assert.equal(draft.candidate.rows[3].status,"revisar");
 assert.equal(draft.candidate.rows[4].status,"bloqueado");
 assert.equal(draft.countsByOutcome.preservedBlocked,2);
 assert.equal(draft.countsByOutcome.alreadyReview,1);
 assert.equal(draft.countsByOutcome.stillPrepared,1);
});
test("PR76: validated controls have fixed names/types/limits, no arbitrary script expressions",()=>{
 for(const type of ["orders","data"]){
  const name=type==="orders"?"reviewBelow":"reviewAbove";
  for(const input of [{[name]:-1},{[name]:5001},{[name]:10.5},{[name]:"100"},{
   [name]:null},{[name]:NaN},{[name]:Infinity},{[name]:150,evil:"true"}])
   assert.throws(()=>normalizeScenarioSettings(type,input),/Solo se admite|número entero/);
  assert.deepEqual(normalizeScenarioSettings(type,{[name]:0}),{[name]:0});
 }
 for(const setting of [0,1,"true",null,{value:true}])
  assert.throws(()=>normalizeScenarioSettings("support",{escalateMedium:setting}),/verdadera o falsa/);
 assert.throws(()=>presetFor("unknown","strict"),/no reconocida/);
 assert.throws(()=>presetFor("orders","god-mode"),/no reconocida/);
});
test("PR76: templates only serialize scenario/settings and reject malicious, foreign or stale JSON",()=>{
 const type="orders",config=presetFor(type,"strict"),data=encodeScenarioTemplate(type,config);
 const parsed=JSON.parse(data);
 assert.deepEqual(Object.keys(parsed).sort(),["execution","scenario","schema","settings"]);
 assert.deepEqual(decodeScenarioTemplate(data,type),config);
 assert.throws(()=>decodeScenarioTemplate(data,"support"),/no corresponde/);
 assert.throws(()=>decodeScenarioTemplate("broken",type),/JSON válido/);
 assert.throws(()=>decodeScenarioTemplate(data+" ".repeat(1200),type),/supera 1.200/);
 assert.throws(()=>decodeScenarioTemplate(JSON.stringify({...parsed,unknown:"secret"}),type),/no corresponde/);
 assert.throws(()=>decodeScenarioTemplate(JSON.stringify({...parsed,execution:"EXECUTED"}),type),/no corresponde/);
 assert.throws(()=>decodeScenarioTemplate(JSON.stringify({...parsed,settings:{...config,skipValidation:true}}),type),/Solo se admite/);
 assert.doesNotMatch(data,/PED-101|norte@ejemplo\.test|Tienda Norte/);
});
test("PR76: comparing two runs does not mutate baseline or source and cannot authorize execution",()=>{
 const input=SCENARIOS.orders.sample;
 const result=simulateCandidate("orders",input,{reviewBelow:1000});
 const baseline=runWorkflow("orders",input);
 assert.deepEqual(result.baseline,baseline);
 assert.deepEqual(result.baseline.rows.map(r=>r.status),baseline.rows.map(r=>r.status));
 assert.equal(result.externalExecuted,0);
 assert.equal(result.realApprovals,0);
 assert.equal(result.comparable,true);
 assert.equal(result.candidate.counts.total,result.baseline.counts.total);
 assert.deepEqual(result.candidate.columns,result.baseline.columns);
 assert.notStrictEqual(result.candidate.rows[0],result.baseline.rows[0]);
 assert.notStrictEqual(result.candidate.rows[0].values,result.baseline.rows[0].values);
});
test("PR76: aggregate report excludes all row identifiers, email addresses and user data",()=>{
 const original="pedido;cliente;email;total;estado\nSECRET-ORDER;Empresa Confidencial;secret@ejemplo.test;790;nuevo";
 const draft=simulateCandidate("orders",original,{reviewBelow:1000});
 const report=scenarioComparisonReport(draft);
 assert.match(report,/Cambios externos ejecutados: 0/);
 assert.match(report,/Aprobaciones reales verificadas: 0/);
 assert.match(report,/Casos que pasan adicionalmente a revisión: 1/);
 for(const privateText of ["SECRET-ORDER","Empresa Confidencial","secret@ejemplo.test","790;"])
  assert.equal(report.includes(privateText),false);
 assert.throws(()=>scenarioComparisonReport(null),/Ejecuta/);
});
test("PR76: no numeric type admits a hidden unsupported knob or bypass flag",()=>{
 const attempts=[
 ["orders",{reviewBelow:0,allowBlocked:true}],
 ["support",{escalateMedium:false,allowUrgentAutoApproval:true}],
 ["data",{reviewAbove:100,ignoreBadDates:true}]
 ];
 for(const [type,settings] of attempts)
  assert.throws(()=>simulateCandidate(type,SCENARIOS[type].sample,settings),/Solo se admite/);
 for(const type of Object.keys(SCENARIO_PRESETS.base)){
  const a=presetFor(type,"base"),b=presetFor(type,"cautious"),c=presetFor(type,"strict");
  assert.ok(a&&b&&c);
  assert.ok(SCENARIO_POLICY_LABELS[type]);
 }
});
