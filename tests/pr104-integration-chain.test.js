import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {auditIntegrationChain,loadSnapshot,fetchLiveChain,
 CHAIN_SCOPE,CHAIN_STAGES,KNOWN_GAP,reportMarkdown}
 from "../scripts/pr104-integration-chain.mjs";
const snapshot=loadSnapshot(resolve(new URL("../docs/pr104-integration-snapshot.json",import.meta.url).pathname));
const copy=()=>JSON.parse(JSON.stringify(snapshot));
const live=()=>{
 const s=copy();
 return {mainSha:s.root.sha,
  prs:s.prs.map(p=>({number:p.number,head:p.head,headSha:p.headSha,
   base:p.base,baseSha:p.baseSha,draft:true,status:"open"})),
  comparisons:Object.fromEntries(s.prs.map(p=>[p.number,{
   status:p.compareStatus,ahead:p.compareAhead,behind:p.compareBehind}]))};
};
test("PR104: 35 consecutive PRs are linked from exactly V40 main, with known PR79 inheritance gap",()=>{
 const result=auditIntegrationChain(snapshot);
 assert.equal(CHAIN_SCOPE.first,69);
 assert.equal(CHAIN_SCOPE.last,103);
 assert.equal(result.total,35);
 assert.equal(result.technicalInventoryPass,true,
  JSON.stringify(result.discrepancies));
 assert.equal(result.verifiedAgainstLive,false);
 assert.deepEqual(result.stages.map(x=>x.count),[11,11,10,3]);
 assert.equal(CHAIN_STAGES.length,4);
 assert.equal(result.knownIntegrationIssues.length,1);
 assert.equal(result.knownIntegrationIssues[0].pr,79);
 assert.equal(result.nextUnsafePR,79);
 assert.equal(result.missingPr78Ancestor,KNOWN_GAP.ancestor);
 assert.equal(result.promotionReady,false);
 assert.equal(result.productionGo,false);
 assert.equal(result.realApprovals,0);
 assert.equal(result.externalExecutions,0);
 assert.equal(result.externalGates.length,5);
 assert.match(reportMarkdown(result),/PR #79/);
 assert.match(reportMarkdown(result),/NO-GO/);
});
test("PR104: no green technical check can substitute independent signoff",()=>{
 const pristine=auditIntegrationChain(snapshot,{live:live()});
 assert.equal(pristine.technicalInventoryPass,true);
 assert.equal(pristine.verifiedAgainstLive,true);
 assert.equal(pristine.promotionReady,false);
 for(const key of ["humanSignoff","productionGo","independentSecurityReview",
  "rollbackExerciseVerified"]){
  const mutation=copy();mutation[key]=true;
  const result=auditIntegrationChain(mutation);
  assert.equal(result.technicalInventoryPass,false,key);
  assert.ok(result.discrepancies.some(x=>x.code==="FALSE_RELEASE_AUTHORIZATION"));
 }
 const bad=copy();bad.manualAccessibilityVerified=8;
 assert.equal(auditIntegrationChain(bad).technicalInventoryPass,false);
});
test("PR104: missing edge, duplicate ref, unexpected ancestry, incorrect root all fail closed",()=>{
 for(const mutate of [
  s=>{s.prs[5].base="main";},
  s=>{s.prs[7].head=s.prs[6].head;},
  s=>{s.prs[19].number=999;},
  s=>{s.prs.pop();},
  s=>{s.prs[0].baseSha="0".repeat(40);},
  s=>{s.prs[20].compareBehind=2;},
  s=>{s.prs[10].draft=false;},
  s=>{s.prs[0].status="closed";},
  s=>{s.root.sha="2".repeat(40);},
  s=>{s.comparisons[79].missingAncestor="3".repeat(40);},
  s=>{s.prs[12].compareStatus="unknown";}
 ]){
  const mutated=copy();mutate(mutated);
  const result=auditIntegrationChain(mutated);
  assert.equal(result.technicalInventoryPass,false,JSON.stringify(result));
  assert.equal(result.promotionReady,false);
 }
});
test("PR104: live head drift, moved main and changed compare distances are detected",()=>{
 const modified=live();
 modified.prs[5].headSha="a".repeat(40);
 modified.prs[14].draft=false;
 modified.comparisons[79].behind=0;
 const result=auditIntegrationChain(snapshot,{live:modified});
 assert.equal(result.technicalInventoryPass,false);
 assert.ok(result.discrepancies.some(x=>x.code==="LIVE_DRIFT"));
 assert.ok(result.discrepancies.some(x=>x.code==="LIVE_STATE"));
 assert.ok(result.discrepancies.some(x=>x.code==="LIVE_ANCESTRY_DRIFT"));
 const moved=live();moved.mainSha="3".repeat(40);
 assert.ok(auditIntegrationChain(snapshot,{live:moved}).discrepancies
  .some(x=>x.code==="MAIN_MOVED"));
});
test("PR104: read-only GitHub client checks every edge at bounded concurrency and no writes",async()=>{
 const state=live(),seen=[],map=new Map(state.prs.map(p=>[p.number,p]));
 const fake=async(url,opts)=>{
  seen.push({url,headers:opts.headers});
  assert.equal(opts.headers.Authorization,"Bearer TEST-ONLY");
  assert.equal(opts.headers.Accept,"application/vnd.github+json");
  assert.equal(opts.method,undefined,"must not attempt a write");
  let data;
  if(url.includes("/pulls?"))data=state.prs.map(p=>({
   number:p.number,state:p.status,draft:p.draft,
   head:{ref:p.head,sha:p.headSha},base:{ref:p.base,sha:p.baseSha}
  }));
  else if(url.endsWith("/branches/main"))data={commit:{sha:state.mainSha}};
  else {
   const hashes=url.split("/compare/")[1].split("...");
   const item=state.prs.find(p=>p.baseSha===hashes[0]&&p.headSha===hashes[1]);
   assert.ok(item,"unexpected compare target");
   const comparison=state.comparisons[item.number];
   data={status:comparison.status,ahead_by:comparison.ahead,behind_by:comparison.behind};
  }
  return {ok:true,json:async()=>data};
 };
 const fetched=await fetchLiveChain({token:"TEST-ONLY",request:fake});
 assert.equal(fetched.prs.length,35);
 assert.equal(seen.length,37);
 assert.equal(auditIntegrationChain(snapshot,{live:fetched}).technicalInventoryPass,true);
 await assert.rejects(fetchLiveChain({token:"",request:fake}),/token/);
 await assert.rejects(fetchLiveChain({token:"TEST-ONLY",repository:"other/project",request:fake}),/repository/);
});
