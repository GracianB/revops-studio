import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {auditV100UX,UX_PUBLIC_PAGES} from "../scripts/ux-audit.mjs";
const root=resolve(new URL("../",import.meta.url).pathname);
const read=(path)=>readFileSync(path,"utf8");
test("UX audit: all five public pages and local destinations are structurally valid",()=>{
 const first=auditV100UX(root),second=auditV100UX(root);
 assert.equal(first.pagesReviewed,5);
 assert.equal(UX_PUBLIC_PAGES.length,5);
 assert.equal(first.technicalPass,true,first.reportedProblems.join("; "));
 assert.equal(first.reportedProblems.length,0);
 assert.ok(first.localLinksReviewed>10);
 assert.deepEqual(first.reportedProblems,second.reportedProblems);
 assert.equal(first.productionGo,false);
 assert.equal(first.humanUsabilityStudiesCompleted,0);
 assert.equal(first.manualAccessibilityVerified,0);
});
test("UX audit: duplicate IDs, lost keyboard skip and unresolvable anchors fail",()=>{
 const problems=auditV100UX(root,{read:path=>{
  const source=read(path);
  if(path.endsWith("/gracias.html"))
   return source.replace("<body>","<body><div id='thanks-title'></div>");
  if(path.endsWith("/privacidad.html"))
   return source.replace('class="skip-link"','class="no-skip"');
  if(path.endsWith("/index.html"))
   return source.replace('href="#problemas"','href="#seccion_que_no_existe"');
  return source;
 }}).reportedProblems;
 assert.ok(problems.some(e=>e.startsWith("IDs_REPETIDOS gracias.html")));
 assert.ok(problems.some(e=>e.startsWith("SALTO_TECLADO privacidad.html")));
 assert.ok(problems.some(e=>e.includes("ANCLA_SIN_DESTINO index.html")));
});
test("UX audit: missing disclosure controls and disabled CI audit are blockers",()=>{
 const result=auditV100UX(root,{read:path=>{
  const source=read(path);
  if(path.endsWith("/demo.html"))
   return source.replace('id="pilotUXDetails"','id="pilotUXBroken"');
  if(path.endsWith("/validate.yml"))
   return source.replace("node scripts/ux-audit.mjs","echo skipped");
  return source;
 }});
 assert.equal(result.technicalPass,false);
 assert.ok(result.reportedProblems.includes("CONTROLES_UX pilotUXDetails"));
 assert.ok(result.reportedProblems.includes("DETALLE_NO_PLEGADO"));
 assert.ok(result.reportedProblems.includes("AUDITORIA_NO_INCLUIDA_EN_CI"));
});
