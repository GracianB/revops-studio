import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {auditCandidate,CANDIDATE_MODULES} from "../scripts/pr99-candidate-audit.mjs";
const root=resolve(new URL("../",import.meta.url).pathname);
test("PR99: complete candidate audit is reproducible and does not authorize launch",()=>{
 const a=auditCandidate(root),b=auditCandidate(root);
 assert.equal(a.technicalPass,true,a.problems.join("; "));
 assert.equal(a.problems.length,0);
 assert.equal(a.modules,19);
 assert.ok(a.expectedFiles>37);
 assert.equal(a.expectedFiles,a.examinedFiles);
 assert.equal(a.fingerprint,b.fingerprint);
 assert.match(a.fingerprint,/^[0-9a-f]{64}$/);
 assert.equal(a.manualAccessibilityVerified,0);
 assert.equal(a.realApprovals,0);
 assert.equal(a.productionGo,false);
 assert.equal(a.externalExecutions,0);
 assert.equal(CANDIDATE_MODULES.length,19);
});
test("PR99: missing modules and unapproved network API trigger fail-closed",()=>{
 const exists=path=>!path.endsWith("/pilot-readiness.js");
 const a=auditCandidate(root,{exists});
 assert.equal(a.technicalPass,false);
 assert.ok(a.problems.some(s=>s.includes("MISSING assets/js/pilot-readiness.js")));
 const injected=auditCandidate(root,{
  read:(file,encoding)=>{
   const original=readFileSync(file,encoding);
   return file.endsWith("/pilot-risk-register.js")?original+"\nfetch('https://server.example');":original;
  }
 });
 assert.equal(injected.technicalPass,false);
 assert.ok(injected.problems.some(x=>x.includes("UNEXPECTED_EXTERNAL_API")));
});
test("PR99: removing CI gate is detected and receipts must not be treated as release approvals",()=>{
 const modified=auditCandidate(root,{read:(file,encoding)=>{
  const original=readFileSync(file,encoding);
  return file.endsWith("/validate.yml")?
   original.replace("npm run pr80:check","echo skipped"):original;
 }});
 assert.equal(modified.technicalPass,false);
 assert.ok(modified.problems.some(s=>s.includes("CI_GATE_MISSING")));
});
