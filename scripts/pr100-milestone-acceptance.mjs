// PR100 · Explicit release-candidate acceptance, not release authorization.
import {writeFileSync,mkdirSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {SCENARIOS} from "../assets/js/workflow-engine.js";
import {recipe,RECIPE_LABELS} from "../assets/js/workflow-product-kit.js";
import {assessPilotReadiness} from "../assets/js/pilot-readiness.js";
import {createPilotExecutionPlan} from "../assets/js/pilot-plan.js";
import {buildPilotRiskRegister} from "../assets/js/pilot-risk-register.js";
import {buildPilotEvidenceLedger,simulateEvidenceCoverage} from "../assets/js/pilot-evidence-ledger.js";
import {runPilotFailureDrills} from "../assets/js/pilot-failure-drills.js";
import {buildPilotCapacityExplorer} from "../assets/js/pilot-capacity-explorer.js";
import {buildPilotEvidenceReview} from "../assets/js/pilot-evidence-review.js";
import {runPilotValidationAtlas} from "../assets/js/pilot-validation-atlas.js";
import {buildPilotSupervisedReview} from "../assets/js/pilot-supervised-review.js";
import {buildPilotV100Snapshot,pilotV100SnapshotJson} from "../assets/js/pilot-v100-snapshot.js";
import {validatePilotExportJson} from "../assets/js/pilot-export-integrity.js";
export function runV100MilestoneAcceptance(){
 const atlas=runPilotValidationAtlas();
 if(atlas.fixtureFailures!==0||atlas.passes!==18)
  throw Error("La integración sintética transversal no está en verde.");
 const checked=[];
 for(const scenario of Object.keys(SCENARIOS))for(const fixture of Object.keys(RECIPE_LABELS)){
  const readiness=assessPilotReadiness(scenario,recipe(scenario,fixture));
  const plan=createPilotExecutionPlan(readiness);
  const risks=buildPilotRiskRegister(readiness,plan);
  const ledger=buildPilotEvidenceLedger(plan,risks);
  const coverage=simulateEvidenceCoverage(ledger);
  const drills=runPilotFailureDrills(readiness,plan,risks,ledger);
  const capacity=buildPilotCapacityExplorer(readiness);
  const evidenceReview=buildPilotEvidenceReview(plan,ledger,risks,coverage);
  const review=buildPilotSupervisedReview({
   readiness,plan,risks,ledger,coverage,drills,capacity,evidenceReview,atlas
  });
  const snapshot=buildPilotV100Snapshot({
   readiness,review,risks,capacity,evidenceReview,atlas
  });
  const serialized=pilotV100SnapshotJson(snapshot);
  validatePilotExportJson(serialized);
  if(snapshot.productionGo!==false||snapshot.realApprovals!==0||
     snapshot.metrics.externalChecksOpen!==4||
     snapshot.metrics.realEvidenceVerified!==0||
     snapshot.metrics.atlasFixturesPassed!==18||
     snapshot.riskHighlights.length!==3||snapshot.metrics.realApprovals!==0)
   throw Error("Las métricas PR100 se han desviado de sus límites de seguridad.");
  checked.push({scenario,fixture,localChecks:review.localPassed,
   externalPending:4,productionGo:false});
 }
 return Object.freeze({
  schema:"revops-pr100-acceptance-v1",cases:checked.length,
  atlasFixtures:atlas.fixtureCount,atlasDefenses:atlas.defensesRehearsed,
  localInvariantChecks:atlas.localInvariantChecks,
  checks:Object.freeze(checked),technicalPass:true,
  manualAccessibilityVerified:0,externalAuthorizations:0,
  realApprovals:0,productionGo:false,
  disclaimer:"Solo comprobaciones técnicas sintéticas. No implica revisión manual WCAG, auditoría de seguridad, rollback real, consentimiento empresarial o despliegue."
 });
}
const cli=process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(cli){
 const report=runV100MilestoneAcceptance();
 mkdirSync(".ci-artifacts",{recursive:true});
 writeFileSync(".ci-artifacts/pr100-acceptance.json",JSON.stringify(report,null,2)+"\n");
 console.log("PR100 MILESTONE TECHNICAL ACCEPTANCE PASS: "+
  report.cases+" scenarios/fixtures, "+
  report.atlasDefenses+" local defensive checks, "+
  report.localInvariantChecks+" invariants. NO PRODUCTION AUTHORIZATION.");
}
