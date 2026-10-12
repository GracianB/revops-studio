import test from "node:test";
import assert from "node:assert/strict";
import {SCENARIOS} from "../assets/js/workflow-engine.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {assessPilotReadiness} from "../assets/js/pilot-readiness.js";
import {createPilotExecutionPlan} from "../assets/js/pilot-plan.js";
import {buildPilotRiskRegister} from "../assets/js/pilot-risk-register.js";
import {buildPilotEvidenceLedger} from "../assets/js/pilot-evidence-ledger.js";
import {runPilotFailureDrills} from "../assets/js/pilot-failure-drills.js";
import {buildPilotAuthorizationBoard,pilotAuthorizationJson} from "../assets/js/pilot-authorization-board.js";
function modules(s,source,run=false){
 const readiness=assessPilotReadiness(s,source);
 const plan=createPilotExecutionPlan(readiness);
 const risks=buildPilotRiskRegister(readiness,plan);
 const ledger=buildPilotEvidenceLedger(plan,risks);
 const drills=run?runPilotFailureDrills(readiness,plan,risks,ledger):null;
 return {readiness,plan,risks,ledger,drills};
}
test("PR87: every one of 18 samples remains NO-GO for production",()=>{
 for(const s of Object.keys(SCENARIOS))
  for(const name of Object.keys(RECIPE_LABELS))
   for(const run of [false,true]){
    const board=buildPilotAuthorizationBoard(modules(s,recipe(s,name),run));
    assert.equal(board.outcome,"NO AUTORIZADO PARA PRODUCCIÓN");
    assert.equal(board.productionGo,false);
    assert.equal(board.gates.length,8);
    assert.ok(board.outstanding>=4);
    assert.equal(board.realApprovals,0);
    assert.equal(board.realEvidence,0);
    assert.equal(board.externalExecutions,0);
    assert.ok(board.gates.some(g=>g.id==="BOARD-08"&&g.state==="external"));
   }
});
test("PR87: clean input may qualify for supervised demo, never production",()=>{
 const p=modules("orders",recipe("orders","clear"),true);
 const board=buildPilotAuthorizationBoard(p);
 assert.equal(board.supervisedDemoCandidate,true);
 assert.equal(board.productionGo,false);
 assert.equal(board.gates.find(x=>x.id==="BOARD-05").state,"rehearsal");
 assert.equal(board.gates.find(x=>x.id==="BOARD-06").state,"external");
 assert.equal(board.gates.find(x=>x.id==="BOARD-07").state,"external");
});
test("PR87: incomplete samples generate concrete prioritized gate remediation",()=>{
 const p=modules("orders",SCENARIOS.orders.sample);
 const board=buildPilotAuthorizationBoard(p);
 assert.equal(board.supervisedDemoCandidate,false);
 assert.ok(board.remediation.length>0);
 assert.ok(board.remediation.some(r=>r.gate==="PIL-02"));
 assert.equal(board.localDrills.run,false);
});
test("PR87: rejects invented approvals and inconsistent scenarios",()=>{
 const p=modules("orders",SCENARIOS.orders.sample,true);
 assert.throws(()=>buildPilotAuthorizationBoard({...p,readiness:{...p.readiness,realApprovals:1}}));
 assert.throws(()=>buildPilotAuthorizationBoard({...p,risks:{...p.risks,scenario:"support"}}));
 assert.throws(()=>pilotAuthorizationJson({...buildPilotAuthorizationBoard(p),productionGo:true}));
});
test("PR87: exported board has only predefined actions and no identifiers",()=>{
 const src="pedido;cliente;email;total;estado\nP87-PRIVATE;Private Company;person@business.com;20;nuevo";
 const board=buildPilotAuthorizationBoard(modules("orders",src,true));
 const text=pilotAuthorizationJson(board);
 for(const v of ["P87-PRIVATE","Private Company","person@business.com"])
  assert.equal(text.includes(v),false);
 assert.equal(JSON.parse(text).productionGo,false);
});
