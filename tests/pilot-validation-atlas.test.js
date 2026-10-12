import test from "node:test";
import assert from "node:assert/strict";
import {runPilotValidationAtlas,pilotValidationAtlasJson,pilotValidationAtlasText}
 from "../assets/js/pilot-validation-atlas.js";
test("PR90: full local atlas covers three workflows, 18 fixtures and 126 defense trials",()=>{
 const atlas=runPilotValidationAtlas();
 assert.equal(atlas.schema,"revops-pilot-validation-atlas-v1");
 assert.equal(atlas.scenarioCount,3);
 assert.equal(atlas.fixtureCount,18);
 assert.equal(atlas.passes,18);
 assert.equal(atlas.fixtureFailures,0);
 assert.equal(atlas.gatesEvaluated,144);
 assert.equal(atlas.defensesRehearsed,126);
 assert.equal(atlas.localInvariantChecks,108);
 assert.equal(new Set(atlas.results.map(r=>r.scenario+"|"+r.key)).size,18);
 assert.ok(atlas.results.every(r=>r.state==="pass"&&r.localCheckCount===6));
 assert.ok(atlas.results.every(r=>r.productionGo===false&&r.realApprovals===0));
 assert.equal(atlas.productionGo,false);
 assert.deepEqual(atlas,runPilotValidationAtlas());
});
test("PR90: successful technical atlas never enables production",()=>{
 const atlas=runPilotValidationAtlas();
 assert.match(atlas.status,/NO autorizado/);
 assert.match(atlas.disclaimer,/No sustituye CI/);
 const json=JSON.parse(pilotValidationAtlasJson(atlas));
 assert.equal(json.productionGo,false);
 assert.equal(json.realApprovals,0);
 assert.equal(json.externalExecutions,0);
 assert.equal(json.results.length,18);
 const txt=pilotValidationAtlasText(atlas);
 assert.match(txt,/Aprobaciones reales: 0/);
 assert.match(txt,/Defensas locales ensayadas: 126/);
});
test("PR90: reports are strictly aggregate and reject fabricated release",()=>{
 const atlas=runPilotValidationAtlas();
 const output=pilotValidationAtlasJson(atlas)+pilotValidationAtlasText(atlas);
 for(const secret of ["person@company.com","PRIVATE-123","Customer Invoice Reference"])
  assert.ok(!output.includes(secret));
 assert.throws(()=>pilotValidationAtlasJson({...atlas,productionGo:true}));
 assert.throws(()=>pilotValidationAtlasText({...atlas,realApprovals:1}));
});
