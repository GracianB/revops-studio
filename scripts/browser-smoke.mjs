import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { chromium, firefox } from "playwright-core";

const root = process.cwd();
const mime = {".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".svg":"image/svg+xml", ".json":"application/json"};
const server = createServer(async (req,res)=>{
  try {
    const url = new URL(req.url, "http://localhost");
    const relative = decodeURIComponent(url.pathname.replace(/^\/+/, "")) || "index.html";
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const bytes = await readFile(filename);
    res.writeHead(200, {"Content-Type":(mime[path.extname(filename)] || "text/plain") + "; charset=utf-8"});
    res.end(bytes);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const base = "http://127.0.0.1:" + server.address().port;

const engineName=process.env.REVOPS_BROWSER==="firefox"?"firefox":"chrome";
const browserEngine=engineName==="firefox"?firefox:chromium;
let browser;
const errors=[];
const describe=error=>errors.push(error.message);
async function auditAccessibility(page, label) {
  if (engineName !== "chrome") return;
  await page.addScriptTag({ path: path.join(root, "node_modules/axe-core/axe.min.js") });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }
    });
    return result.violations.map(v => ({
      id:v.id, impact:v.impact, count:v.nodes.length,
      targets:v.nodes.slice(0,6).map(n => ({
        selector:n.target.join(" "),data:n.any?.[0]?.data,
        text:n.html?.slice(0,190),summary:n.failureSummary?.slice(0,130)
      }))
    }));
  });
  console.log("AXE_AUDIT "+label+" "+JSON.stringify(violations));
  const blockers = violations.filter(v => v.impact==="serious" || v.impact==="critical");
  assert.deepEqual(blockers,[],label+" has serious or critical accessibility failures");
}
async function captureVisual(page,name,locator=null) {
  if (process.env.REVOPS_VISUAL_AUDIT !== "1" || engineName !== "chrome") return;
  const bytes = await (locator || page).screenshot({type:"jpeg",quality:48,animations:"disabled"});
  const encoded = bytes.toString("base64");
  console.log("V41IMG_BEGIN|"+name);
  for(let i=0;i<encoded.length;i+=6500) console.log("V41IMG_CHUNK|"+encoded.slice(i,i+6500));
  console.log("V41IMG_END|"+name);
}

// Compare the commercial payload against the complete V40 stylesheet, not only a screenshot.
// Same layout / computed styles across theme, page and mobile; no timing guesses in CI.
async function auditCommercialCssParity(browser) {
  const fullCss=await readFile(path.join(root,"assets/css/main.css"),"utf8");
  const scenarios=[
    {url:"/",width:1366,theme:"dark",selectors:["body",".nav-wrap",".hero-v41 h1",".studio-diagram",".service-card",".study-card","#contacto .contact-main"]},
    {url:"/",width:390,theme:"light",selectors:["body",".nav-wrap",".hero-v41 h1",".studio-diagram",".service-card",".study-card","#contacto .contact-main"]},
    {url:"/privacidad.html",width:390,theme:"dark",selectors:["body",".nav-wrap",".privacy-main",".privacy-main h1"]},
    {url:"/gracias.html",width:390,theme:"light",selectors:["body",".nav-wrap",".thanks-heading",".contact-main"]}
  ];
  const snapshot=async (page,selectors)=>page.evaluate((list)=>Object.fromEntries(list.map(selector=>{
    const element=document.querySelector(selector);
    if(!element)return [selector,null];
    const style=getComputedStyle(element),rect=element.getBoundingClientRect();
    return [selector,{
      display:style.display,color:style.color,background:style.backgroundColor,
      fontSize:style.fontSize,lineHeight:style.lineHeight,grid:style.gridTemplateColumns,
      padding:style.padding,margin:style.margin,border:style.borderTopColor,
      width:Math.round(rect.width),height:Math.round(rect.height)
    }];
  })),selectors);
  for(const scenario of scenarios){
    const args={viewport:{width:scenario.width,height:844},reducedMotion:"reduce"};
    const actual=await browser.newPage(args),original=await browser.newPage(args);
    try{
      await actual.addInitScript(theme=>localStorage.setItem("revops-theme",theme),scenario.theme);
      await original.addInitScript(theme=>localStorage.setItem("revops-theme",theme),scenario.theme);
      await original.route("**/assets/css/commercial.css",route=>route.fulfill({
        status:200,contentType:"text/css",body:fullCss
      }));
      await Promise.all([
        actual.goto(base+scenario.url,{waitUntil:"load"}),
        original.goto(base+scenario.url,{waitUntil:"load"})
      ]);
      const a=await snapshot(actual,scenario.selectors);
      const b=await snapshot(original,scenario.selectors);
      assert.deepEqual(a,b,"V45 visual parity failed "+engineName+" "+scenario.url+" "+scenario.width+" "+scenario.theme);
    }finally{
      await actual.close();
      await original.close();
    }
  }
  console.log("V45 CSS VISUAL PARITY PASS ("+engineName+"): desktop, mobile, ES dark/light, contact and privacy");
}

async function auditCustomerDiagnostic(browser) {
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:"reduce",acceptDownloads:true});
  try {
    await page.goto(base+"/",{waitUntil:"load"});
    assert.equal(await page.locator("#diagnosticPlan").isHidden(),true);
    await page.locator("#diagProblem").selectOption("reporting");
    assert.equal(await page.locator("#diagnosticPlan").isVisible(),true);
    assert.match(await page.locator("#diagRoute").innerText(),/Datos y BI/);
    assert.match(await page.locator("#diagDeliverable").innerText(),/KPIs/);
    await page.locator("#diagTools").selectOption("mixed");
    assert.match(await page.locator("#diagPackage").innerText(),/4.000 €/);
    await page.locator("#dolor").fill("Este texto lo he escrito yo y no se debe cambiar.");
    await page.locator("#servicio").selectOption("Quick win");
    // The report is created on explicit click, stays local and is printable offline.
    const r1DownloadPromise=page.waitForEvent("download");
    await page.locator("#diagDownload").click();
    const r1Download=await r1DownloadPromise;
    assert.equal(r1Download.suggestedFilename(),"revops-plan-reporting-team.html");
    const r1Html=await readFile(await r1Download.path(),"utf8");
    assert.match(r1Html,/04 · Cómo aceptar el piloto/);
    assert.match(r1Html,/@media print/);
    assert.match(r1Html,/4\.000 €/);
    assert.doesNotMatch(r1Html,/https?:\/\/|<script|FormSubmit|Plausible/i);
    await page.locator("#diagToContact").click();
    assert.match(await page.locator("#diagnosticoBrief").inputValue(),/Ruta sugerida: Datos y BI/);
    assert.equal(await page.locator("#dolor").inputValue(),"Este texto lo he escrito yo y no se debe cambiar.");
    assert.equal(await page.locator("#servicio").inputValue(),"Quick win");
    assert.equal(await page.locator("#diagnosticContext").isVisible(),true);
    assert.match(decodeURIComponent(await page.locator("#briefEmailFallback").getAttribute("href")),/Mapa inicial orientativo/);
    await page.locator("#diagProblem").selectOption("rules");
    assert.equal(await page.locator("#diagnosticoBrief").inputValue(),"","changed diagnosis must not leave a stale brief attached");
    assert.equal(await page.locator("#diagnosticContext").isHidden(),true);
    await page.locator("#diagToContact").click();
    assert.match(await page.locator("#diagnosticoBrief").inputValue(),/Ruta sugerida: Software a medida/);
    await page.locator("#diagnosticContextClear").click();
    assert.equal(await page.locator("#diagnosticoBrief").inputValue(),"");
    await page.locator("#diagReset").click();
    assert.equal(await page.locator("#diagnosticPlan").isHidden(),true);
    assert.equal(await page.locator("#diagProblem").inputValue(),"");
    const dims=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(dims.scroll<=dims.viewport+3,"guided product mobile overflow "+JSON.stringify(dims));
    console.log("PRODUCT DIAGNOSTIC PASS ("+engineName+"): recommendations, copy-to-brief, user text preservation, stale clearing and reset");
  } finally { await page.close(); }
}

async function auditDiscoveryStudio(browser) {
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:"reduce",acceptDownloads:true});
 const errors=[],requests=[];
 page.on("pageerror",error=>errors.push(error.message));
 page.on("request",request=>requests.push(request.url()));
 try{
  await page.goto(base+"/",{waitUntil:"load"});
  assert.equal(requests.some(url=>/discovery-(ui|engine|studio)\./.test(url)),false,"PR71 must load only on demand");
  await page.locator("#diagProblem").selectOption("reporting");
  await page.locator("#diagStudioOpen").click();
  await page.locator("#discoveryStudio").waitFor({state:"visible"});
  assert.equal(await page.locator("#diagStudioOpen").getAttribute("aria-expanded"),"true");
  assert.match(await page.locator("#discoveryReadiness").innerText(),/pendientes/);
  assert.match(await page.locator("#discoveryGaps").innerText(),/Designar a quien aprobará/);
  assert.equal(await page.locator("#discoveryPreview").inputValue().then(t=>t.includes("ACEPTACIÓN VERIFICABLE")),true);
  assert.match(await page.locator("#discoveryDemoLink").getAttribute("href"),/scenario=data/);
  await page.locator("#discoveryRole").selectOption("analyst");
  await page.locator("#discoveryGoal").fill("Validar el origen de los KPIs");
  await page.locator("#discoveryOwner").selectOption("assigned");
  await page.locator("#discoverySample").selectOption("ready");
  await page.locator("#discoveryIntegration").selectOption("local");
  await page.locator("#discoveryStage").selectOption("approved");
  assert.match(await page.locator("#discoveryReadiness").innerText(),/Candidato/);
  assert.match(await page.locator("#discoveryPreview").inputValue(),/Validar el origen de los KPIs/);
  // User-edited text is preserved when a field changes; stale exports are blocked.
  await page.locator("#discoveryPreview").fill("MI BRIEF EDITADO, NO SOBRESCRIBIR");
  await page.locator("#discoveryUrgency").selectOption("priority");
  assert.equal(await page.locator("#discoveryPreview").inputValue(),"MI BRIEF EDITADO, NO SOBRESCRIBIR");
  assert.equal(await page.locator("#discoveryDownloadTxt").isDisabled(),true);
  assert.match(await page.locator("#discoveryStatus").innerText(),/regenerarlo/);
  await page.locator("#discoveryRegenerate").click();
  assert.equal(await page.locator("#discoveryDownloadTxt").isEnabled(),true);
  assert.match(await page.locator("#discoveryPreview").inputValue(),/Confirmar fecha/);
  const txtPromise=page.waitForEvent("download");
  await page.locator("#discoveryDownloadTxt").click();
  const txt=await txtPromise;
  assert.match(txt.suggestedFilename(),/revops-discovery-pr71-data\.txt/);
  const txtText=await readFile(await txt.path(),"utf8");
  assert.match(txtText,/ACEPTACIÓN VERIFICABLE/);
  assert.doesNotMatch(txtText,/norte@ejemplo\.test|formsubmit\.co/);
  const jsonPromise=page.waitForEvent("download");
  await page.locator("#discoveryDownloadJson").click();
  const file=await jsonPromise;
  assert.match(file.suggestedFilename(),/revops-discovery-pr71-data\.json/);
  const body=JSON.parse(await readFile(await file.path(),"utf8"));
  assert.equal(body.schema,"revops-discovery-brief-v1");
  assert.equal(body.state,"proposal_not_executed");
  assert.match(body.edited_text,/KPIs/);
  await page.locator("#dolor").fill("Este mensaje lo escribió el visitante");
  await page.locator("#servicio").selectOption("Quick win");
  assert.equal(await page.locator("#diagnosticoBrief").inputValue(),"");
  await page.locator("#discoveryAttach").click();
  assert.match(await page.locator("#diagnosticoBrief").inputValue(),/Brief PR71/);
  assert.equal(await page.locator("#dolor").inputValue(),"Este mensaje lo escribió el visitante");
  assert.equal(await page.locator("#servicio").inputValue(),"Quick win");
  await page.locator("#discoveryOwner").selectOption("pending");
  assert.equal(await page.locator("#diagnosticoBrief").inputValue(),"","editing must invalidate attached PR71 snapshot");
  assert.equal(await page.locator("#diagnosticContext").isHidden(),true);
  await page.locator("#discoveryClose").click();
  assert.equal(await page.locator("#discoveryStudio").isHidden(),true);
  assert.equal(await page.locator("#diagStudioOpen").getAttribute("aria-expanded"),"false");
  await page.locator("#diagStudioOpen").click();
  await page.locator("#discoveryStudio").waitFor({state:"visible"});
  const size=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(size.scroll<=size.w+3,"PR71 mobile overflow "+JSON.stringify(size));
  assert.deepEqual(errors,[],"PR71 page errors");
  assert.ok(requests.some(url=>/discovery-ui\.js/.test(url)));
  assert.ok(requests.some(url=>/discovery-studio\.css/.test(url)));
  console.log("DISCOVERY STUDIO PR71 PASS ("+engineName+"): local, gates, edit safety, exports, consent handoff and mobile");
 }finally{await page.close();}
}

async function auditCorrectionWorkbench(browser){
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:"reduce"});
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 try{
  await page.goto(base+"/demo.html?scenario=orders&view=advanced",{waitUntil:"load"});
  await page.locator("#qualityCockpit").waitFor({state:"visible"});
  assert.equal(await page.locator("#correctionHistorySteps button").count(),1);
  assert.equal(await page.locator("#undoCorrection").isDisabled(),true);
  const first=page.locator(".workbench-row-edit").nth(2);
  await first.click();
  assert.equal(await page.locator("#saveWorkflowEdit").isDisabled(),true);
  assert.match(await page.locator("#editPreviewStatus").innerText(),/Sin cambios/);
  await page.locator('#workflowEditFields input[name="pedido"]').fill("PED-900");
  assert.equal(await page.locator("#saveWorkflowEdit").isEnabled(),true);
  assert.match(await page.locator("#editPreviewStatus").innerText(),/bloqueado → listo/);
  assert.match(await page.locator("#editPreviewImpact").innerText(),/-1 bloqueos/);
  assert.match(await page.locator("#editPreviewDiff").innerText(),/PED-101/);
  await page.locator("#editNextIssue").click();
  assert.match(await page.locator("#editDirtyStatus").innerText(),/Primero guarda o cancela/);
  assert.match(await page.locator("#workbench-edit-title").innerText(),/PED-101/);
  await page.locator("#saveWorkflowEdit").click();
  assert.equal(await page.locator("#countBlocked").innerText(),"1");
  assert.equal(await page.locator("#correctionHistorySteps button").count(),2);
  assert.equal(await page.locator("#undoCorrection").isEnabled(),true);
  await page.locator(".workbench-row-edit").nth(3).click();
  await page.locator('#workflowEditFields input[name="email"]').fill("nuevo@ejemplo.test");
  assert.match(await page.locator("#editPreviewStatus").innerText(),/bloqueado → listo/);
  await page.locator("#saveWorkflowEdit").click();
  assert.equal(await page.locator("#countBlocked").innerText(),"0");
  assert.equal(await page.locator("#correctionHistorySteps button").count(),3);
  await page.locator("#undoCorrection").click();
  assert.equal(await page.locator("#countBlocked").innerText(),"1");
  await page.locator("#undoCorrection").click();
  assert.equal(await page.locator("#countBlocked").innerText(),"2");
  assert.equal(await page.locator("#undoCorrection").isDisabled(),true);
  await page.locator("#redoCorrection").click();
  await page.locator("#redoCorrection").click();
  assert.equal(await page.locator("#countBlocked").innerText(),"0");
  assert.equal(await page.locator("#redoCorrection").isDisabled(),true);
  await page.locator("#correctionHistorySteps button").nth(1).click();
  assert.equal(await page.locator("#countBlocked").innerText(),"1");
  assert.equal(await page.locator("#redoCorrection").isEnabled(),true);
  await page.locator(".workbench-row-edit").nth(3).click();
  await page.locator('#workflowEditFields input[name="email"]').fill("alternativa@ejemplo.test");
  await page.locator("#saveWorkflowEdit").click();
  assert.equal(await page.locator("#redoCorrection").isDisabled(),true);
  assert.equal(await page.locator("#correctionHistorySteps button").count(),3);
  // Presets must not serialize user search or imported data.
  await page.locator("#workflowSearch").fill("PED-900-personal");
  await page.locator("#workbenchViewPreset").selectOption("errors");
  assert.equal(await page.locator("#workflowSearch").inputValue(),"");
  assert.equal(await page.locator("#workflowSort").inputValue(),"risk");
  assert.equal(await page.locator("#workbenchShowAction").isChecked(),false);
  await page.locator("#workbenchDensity").selectOption("compact");
  await page.locator("#workbenchSaveView").click();
  const saved=await page.evaluate(()=>sessionStorage.getItem("revops-studio:p74:view-v1"));
  assert.deepEqual(Object.keys(JSON.parse(saved)).sort(),["action","density","filter","reason","sort"]);
  assert.doesNotMatch(saved,/PED-900|@ejemplo|personal|norte|Tienda/);
  await page.locator("#workbenchViewPreset").selectOption("all");
  await page.locator("#workbenchRestoreView").click();
  assert.equal(await page.locator("#workbenchDensity").inputValue(),"compact");
  assert.equal(await page.locator("#workbenchShowAction").isChecked(),false);
  await page.locator("#workbenchClearView").click();
  assert.equal(await page.evaluate(()=>sessionStorage.getItem("revops-studio:p74:view-v1")),null);
  await page.locator("#workbenchViewPreset").selectOption("all");
  await page.locator(".workbench-row-edit").first().click();
  await page.locator("#cancelWorkflowEdit").click();
  assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains("workbench-row-edit")),true);
  await page.setViewportSize({width:320,height:760});
  const dims=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(dims.scroll<=dims.viewport+3,"PR74 mobile overflow "+JSON.stringify(dims));
  assert.equal(await page.locator(".workbench-table thead").count(),1);
  assert.equal(await page.locator(".workbench-row").first().evaluate(el=>getComputedStyle(el).display),"grid");
  assert.deepEqual(errors,[],"PR74 JS runtime errors");
  console.log("PR74 CORRECTION WORKBENCH PASS ("+engineName+"): live preview, multi undo/redo, branches, privacy views, mobile cards");
 }finally{await page.close();}
}

async function auditDecisionStudio(browser){
 const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true,reducedMotion:"reduce"});
 const errors=[],requests=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",r=>requests.push(r.url()));
 try{
  await page.goto(base+"/demo.html?scenario=orders&view=advanced",{waitUntil:"load"});
  assert.equal(await page.locator("#rulesStudio").isHidden(),true);
  assert.equal(requests.some(url=>url.includes("/decision-console.js")),false,"PR75 audit should load on demand");
  await page.locator("#rulesOpen").click();
  await page.locator("#rulesStudio").waitFor({state:"visible"});
  assert.equal(await page.locator("#rulesOpen").getAttribute("aria-expanded"),"true");
  assert.equal(await page.locator("#rulesCount").innerText(),"9");
  assert.equal(await page.locator("#rulesCovered").innerText(),"5");
  assert.equal(await page.locator("#rulesHumanGates").innerText(),"1");
  assert.match(await page.locator("#ruleCatalogList").innerText(),/ID-001/);
  assert.match(await page.locator("#ruleCatalogList").innerText(),/ORD-201/);
  await page.locator("#ruleTraceRow").selectOption("2");
  assert.match(await page.locator("#ruleTraceDetail").innerText(),/ID-002/);
  assert.match(await page.locator("#ruleTraceDetail").innerText(),/Ninguna restricción adicional/);
  await page.locator("#humanReviewApprove").click();
  assert.match(await page.locator("#humanReviewFeedback").innerText(),/12 caracteres/);
  await page.locator("#humanReviewNote").fill("Revisión local con justificante de ejemplo, sin datos reales.");
  await page.locator("#humanReviewApprove").click();
  assert.match(await page.locator("#humanReviewCounters").innerText(),/Aprobación simulada: 1/);
  assert.match(await page.locator("#humanReviewFeedback").innerText(),/no una aprobación verificable/);
  assert.equal(await page.locator("#countReview").innerText(),"1","simulated approval must not change engine status");
  const queuePromise=page.waitForEvent("download");
  await page.locator("#exportActionQueue").click();
  const queueFile=await queuePromise;
  const queueText=await readFile(await queueFile.path(),"utf8");
  assert.doesNotMatch(queueText,/PED-104/,"pending human row never enters action queue");
  const reportPromise=page.waitForEvent("download");
  await page.locator("#rulesExport").click();
  const report=await reportPromise;
  assert.match(report.suggestedFilename(),/revops-reglas-pr75-orders\.txt/);
  const content=await readFile(await report.path(),"utf8");
  assert.match(content,/Aprobaciones reales verificadas: 0/);
  assert.match(content,/Anotaciones de aprobación simulada: 1/);
  assert.doesNotMatch(content,/Revisión local con justificante|PED-104|norte@ejemplo\.test|Tienda Norte/);
  await page.locator("#rulesClose").click();
  assert.equal(await page.locator("#rulesStudio").isHidden(),true);
  assert.equal(await page.locator("#rulesOpen").getAttribute("aria-expanded"),"false");
  assert.equal(await page.evaluate(()=>document.activeElement?.id),"rulesOpen");
  // Changing input invalidates all previous annotations and rule snapshots.
  await page.locator("#workflowSource").fill(
   "pedido;cliente;email;total;estado\n0001;Acme;a@ejemplo.test;10;nuevo\n0001;;invalid;-2;???");
  await page.locator("#runWorkflow").click();
  assert.equal(await page.locator("#countTotal").innerText(),"2");
  await page.locator("#rulesOpen").click();
  await page.locator("#rulesStudio").waitFor({state:"visible"});
  assert.equal(await page.locator("#rulesOverlaps").innerText(),"1");
  assert.match(await page.locator("#ruleConflicts").innerText(),/ID-002/);
  assert.match(await page.locator("#ruleConflicts").innerText(),/ORD-102/);
  assert.match(await page.locator("#humanReviewCounters").innerText(),/Aprobación simulada: 0/);
  assert.equal(await page.locator("#humanReviewApprove").isDisabled(),true);
  await page.locator("#ruleConflicts button").first().click();
  assert.equal(await page.locator("#ruleTraceRow").inputValue(),"1");
  assert.match(await page.locator("#ruleTraceDetail").innerText(),/Restricciones adicionales/);
  await page.locator("#ruleTraceDetail button").click();
  assert.equal(await page.locator("#workflowEditForm").isVisible(),true);
  await page.locator("#cancelWorkflowEdit").click();
  const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(dimensions.scroll<=dimensions.width+3,"PR75 mobile overflow "+JSON.stringify(dimensions));
  assert.deepEqual(errors,[],"PR75 runtime errors");
  assert.ok(requests.some(url=>url.includes("/decision-console.js")));
  console.log("PR75 DECISION STUDIO PASS ("+engineName+"): real rule engine parity, precedence, human gate, safe report, invalidation, mobile");
 }finally{await page.close();}
}

async function auditScenarioBuilder(browser){
 const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true,reducedMotion:"reduce"});
 const errors=[],requests=[];
 page.on("pageerror",error=>errors.push(error.message));
 page.on("request",request=>requests.push(request.url()));
 try{
  await page.goto(base+"/demo.html?scenario=orders&view=advanced",{waitUntil:"load"});
  assert.equal(await page.locator("#candidateStudio").isHidden(),true);
  assert.equal(requests.some(url=>url.includes("/scenario-console.js")),false);
  await page.locator("#candidateOpen").click();
  await page.locator("#candidateStudio").waitFor({state:"visible"});
  assert.equal(await page.locator("#candidateOpen").getAttribute("aria-expanded"),"true");
  assert.equal(await page.locator("#candidateOriginalReady").innerText(),"3");
  assert.equal(await page.locator("#candidateNewReady").innerText(),"3");
  assert.equal(await page.locator("#candidateNewReview").innerText(),"1");
  await page.locator("#candidatePreset").selectOption("strict");
  assert.equal(await page.locator("#candidateThreshold").inputValue(),"1000");
  assert.equal(await page.locator("#candidateNewReady").innerText(),"2");
  assert.equal(await page.locator("#candidateNewReview").innerText(),"2");
  assert.match(await page.locator("#candidateDelta").innerText(),/-1 acciones preparadas/);
  assert.match(await page.locator("#candidateSafety").innerText(),/2 bloqueados/);
  assert.match(await page.locator("#candidateAffected").innerText(),/Fila 2/);
  assert.equal(await page.locator("#countReady").innerText(),"3","proposal must not mutate source engine");
  const reportPromise=page.waitForEvent("download");
  await page.locator("#candidateDownloadReport").click();
  const reportFile=await reportPromise;
  assert.match(reportFile.suggestedFilename(),/revops-comparacion-pr76-orders\.txt/);
  const report=await readFile(await reportFile.path(),"utf8");
  assert.match(report,/Casos que pasan adicionalmente a revisión: 1/);
  assert.match(report,/Cambios externos ejecutados: 0/);
  assert.doesNotMatch(report,/PED-101|norte@ejemplo\.test|Tienda Norte/);
  const profilePromise=page.waitForEvent("download");
  await page.locator("#candidateExportTemplate").click();
  const profileFile=await profilePromise;
  const profile=await readFile(await profileFile.path(),"utf8");
  const parsed=JSON.parse(profile);
  assert.equal(parsed.schema,"revops-scenario-settings-v1");
  assert.equal(parsed.execution,"NOT_EXECUTED");
  assert.deepEqual(Object.keys(parsed).sort(),["execution","scenario","schema","settings"]);
  await page.locator("#candidateRollback").click();
  assert.equal(await page.locator("#candidateNewReview").innerText(),"1");
  assert.equal(await page.locator("#candidateThreshold").inputValue(),"0");
  await page.locator("#candidateImportTemplate").setInputFiles({
    name:"settings.json",mimeType:"application/json",buffer:Buffer.from(profile)
  });
  await page.waitForFunction(()=>document.querySelector("#candidateThreshold")?.value==="1000",null,{timeout:5000});
  assert.equal(await page.locator("#candidateNewReview").innerText(),"2");
  await page.locator("#candidateThreshold").fill("5001");
  assert.equal(await page.locator("#candidateDownloadReport").isDisabled(),true);
  await page.locator("#candidateApply").click();
  assert.match(await page.locator("#candidateStatus").innerText(),/Candidato no válido/);
  await page.locator("#candidateRollback").click();
  assert.equal(await page.locator("#candidateNewReview").innerText(),"1");
  await page.locator("#candidateClose").click();
  assert.equal(await page.locator("#candidateStudio").isHidden(),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),"candidateOpen");
  await page.setViewportSize({width:320,height:760});
  await page.locator("#candidateOpen").click();
  const d=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(d.scroll<=d.w+3,"PR76 mobile overflow "+JSON.stringify(d));
  // Other scenarios use different, bounded policies. The default engine stays unchanged.
  await page.goto(base+"/demo.html?scenario=support&view=advanced",{waitUntil:"load"});
  await page.locator("#candidateOpen").click();
  await page.locator("#candidateStudio").waitFor({state:"visible"});
  assert.equal(await page.locator("#candidateEscalateLabel").isVisible(),true);
  assert.equal(await page.locator("#candidateAmountLabel").isHidden(),true);
  await page.locator("#candidatePreset").selectOption("cautious");
  assert.equal(await page.locator("#candidateEscalate").isChecked(),true);
  assert.equal(await page.locator("#candidateNewReview").innerText(),"2");
  assert.equal(await page.locator("#countReview").innerText(),"1");
  await page.goto(base+"/demo.html?scenario=data&view=advanced",{waitUntil:"load"});
  await page.locator("#candidateOpen").click();
  await page.locator("#candidateStudio").waitFor({state:"visible"});
  await page.locator("#candidatePreset").selectOption("strict");
  assert.equal(await page.locator("#candidateNewReview").innerText(),"3");
  assert.equal(await page.locator("#candidateOriginalReview").innerText(),"1");
  assert.match(await page.locator("#candidateAffected").innerText(),/Fila 1/);
  assert.match(await page.locator("#candidateAffected").innerText(),/Fila 6/);
  assert.equal(await page.locator("#countBlocked").innerText(),"2");
  assert.deepEqual(errors,[],"PR76 page errors");
  assert.ok(requests.some(url=>url.includes("/scenario-console.js")));
  console.log("PR76 SCENARIO BUILDER PASS ("+engineName+"): 3 workflows, guardrails, local profiles, rollback, mobile");
 }finally{await page.close();}
}

async function auditExecutivePdf(browser){
 const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true,reducedMotion:"reduce"});
 const errors=[],requests=[];
 page.on("pageerror",error=>errors.push(error.message));
 page.on("request",request=>requests.push(request.url()));
 try{
  await page.goto(base+"/demo.html?scenario=orders&view=advanced",{waitUntil:"load"});
  assert.equal(await page.locator("#reportStudio").isHidden(),true);
  assert.equal(requests.some(url=>url.includes("/executive-pdf.js")),false,"PDF engine must load on demand");
  await page.locator("#reportOpen").click();
  await page.locator("#reportStudio").waitFor({state:"visible"});
  assert.equal(await page.locator("#reportOpen").getAttribute("aria-expanded"),"true");
  assert.equal(await page.locator("#reportRows").innerText(),"6");
  assert.equal(await page.locator("#reportReady").innerText(),"3");
  assert.equal(await page.locator("#reportReview").innerText(),"1");
  assert.equal(await page.locator("#reportBlocked").innerText(),"2");
  const downloaded=page.waitForEvent("download");
  await page.locator("#reportPdf").click();
  const pdf=await downloaded,bytes=await readFile(await pdf.path());
  const pdfBody=bytes.toString("latin1");
  assert.equal(pdf.suggestedFilename(),"revops-informe-ejecutivo-orders.pdf");
  assert.ok(bytes.length>1500,"PDF must contain catalog, page resources and content streams");
  assert.ok(pdfBody.startsWith("%PDF-1.4\n"));
  assert.match(pdfBody,/\/MediaBox \[0 0 595\.28 841\.89\]/);
  assert.match(pdfBody,/\/Type \/Pages \/Count [2-9]/);
  assert.match(pdfBody,/xref\n0 \d+/);
  assert.match(pdfBody,/INFORME EJECUTIVO/);
  assert.match(pdfBody,/07 \/ FUENTES Y ALCANCE/);
  assert.ok(pdfBody.endsWith("%%EOF\n"));
  assert.doesNotMatch(pdfBody,/PED-101|norte@ejemplo\.test|Tienda Norte/);
  const txtPromise=page.waitForEvent("download");
  await page.locator("#reportTxt").click();
  const txt=await txtPromise;
  const textBody=await readFile(await txt.path(),"utf8");
  assert.match(textBody,/RESUMEN EJECUTIVO/);
  assert.match(textBody,/FASES PROPUESTAS/);
  assert.match(textBody,/Aprobaciones verificadas: 0/);
  assert.doesNotMatch(textBody,/PED-101|norte@ejemplo\.test|Tienda Norte/);
  const jsonPromise=page.waitForEvent("download");
  await page.locator("#reportJson").click();
  const json=await jsonPromise;
  const report=JSON.parse(await readFile(await json.path(),"utf8"));
  assert.equal(report.schema,"revops-executive-report-v1");
  assert.equal(report.counts.total,6);
  assert.equal(report.counts.blocked,2);
  assert.equal(report.externalExecuted,0);
  assert.equal(report.realApprovals,0);
  assert.equal(report.phases.length,3);
  assert.doesNotMatch(JSON.stringify(report),/PED-101|norte@ejemplo\.test|Tienda Norte/);
  await page.evaluate(()=>{
   window.__printProbe=null;
   window.open=(where,target)=>{
    const win={location:{href:""},closed:false,close(){}};
    window.__printProbe={where,target,win};
    return win;
   };
  });
  await page.locator("#reportPrint").click();
  const printProbe=await page.evaluate(()=>({
   target:window.__printProbe?.target,href:window.__printProbe?.win.location.href||""
  }));
  assert.equal(printProbe.target,"_blank");
  assert.ok(printProbe.href.startsWith("blob:"));
  assert.match(await page.locator("#reportStatus").innerText(),/imprimir/i);
  await page.locator("#reportClose").click();
  assert.equal(await page.locator("#reportStudio").isHidden(),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),"reportOpen");
  await page.locator("#workflowSource").fill(
   "pedido;cliente;email;total;estado\nSENSITIVE-222;Persona protegida;hidden-example@ejemplo.test;1;nuevo");
  assert.equal(await page.locator("#reportOpen").isDisabled(),true);
  await page.locator("#runWorkflow").click();
  await page.locator("#reportOpen").click();
  await page.locator("#reportStudio").waitFor({state:"visible"});
  assert.equal(await page.locator("#reportRows").innerText(),"1");
  assert.equal(await page.locator("#reportBlocked").innerText(),"0");
  const nextPromise=page.waitForEvent("download");
  await page.locator("#reportPdf").click();
  const nextPdf=await nextPromise;
  const nextBody=(await readFile(await nextPdf.path())).toString("latin1");
  assert.doesNotMatch(nextBody,/SENSITIVE-222|Persona protegida|hidden-example@ejemplo\.test/);
  await page.setViewportSize({width:320,height:760});
  const dims=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(dims.scroll<=dims.viewport+3,"PR77 report mobile overflow "+JSON.stringify(dims));
  assert.deepEqual(errors,[],"PR77 browser errors");
  assert.ok(requests.some(url=>url.includes("/executive-pdf.js")),"PDF generator loaded only after opt-in");
  console.log("PR77 REAL PDF PASS ("+engineName+"): PDF crossrefs, TXT/JSON privacy, print target, source reset and mobile");
 }finally{await page.close();}
}

async function auditInclusiveWorkbench(browser){
 const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:"reduce",acceptDownloads:true});
 const errors=[];page.on("pageerror",error=>errors.push(error.message));
 try{
  await page.goto(base+"/demo.html?scenario=orders&view=advanced",{waitUntil:"load"});
  const links=page.locator("a.skip-link");
  assert.equal(await links.count(),3,"skip links to main, editor and results");
  await page.locator('a.skip-link[href="#main"]').focus();
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute("href")),"#main");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute("href")),"#simulador");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute("href")),"#workbench-table-title");
  await page.locator("#workbenchKeyboardGuide summary").focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#workbenchKeyboardGuide").getAttribute("open"),"");
  assert.match(await page.locator("#workbenchKeyboardGuide").innerText(),/Inicio\/Fin/);
  await page.locator('[data-workflow-filter="bloqueado"]').click();
  const blocked=page.locator(".workbench-row:visible .workbench-row-edit");
  assert.equal(await blocked.count(),2);
  assert.match(await blocked.first().getAttribute("aria-label"),/Editar fila 3\. bloqueado/);
  assert.equal(await blocked.first().getAttribute("aria-keyshortcuts"),"ArrowDown ArrowUp Home End");
  await blocked.first().focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.editIndex),"3");
  await page.keyboard.press("End");
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.editIndex),"3");
  await page.keyboard.press("Home");
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.editIndex),"2");
  await page.keyboard.press("ArrowUp");
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.editIndex),"3","wrap to last visible row");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#workflowEditForm").isVisible(),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute("name")),"email");
  const email=page.locator('#workflowEditFields input[name="email"]');
  assert.equal(await email.getAttribute("aria-invalid"),"true");
  assert.match(await email.getAttribute("aria-describedby"),/editIssue-email/);
  await email.fill("respuesta@ejemplo.test");
  assert.equal(await email.getAttribute("aria-invalid"),"false");
  assert.equal(await page.locator("#saveWorkflowEdit").isEnabled(),true);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#workflowEditForm").isHidden(),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.editIndex),"3","editor restores source focus");
  await page.locator("#rulesOpen").click();
  await page.locator("#rulesStudio").waitFor({state:"visible"});
  assert.equal(await page.evaluate(()=>document.activeElement?.id),"rulesStudioTitle");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#rulesStudio").isHidden(),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),"rulesOpen");
  await page.locator("#candidateOpen").click();
  await page.locator("#candidateStudio").waitFor({state:"visible"});
  assert.equal(await page.evaluate(()=>document.activeElement?.id),"candidateStudioTitle");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#candidateStudio").isHidden(),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),"candidateOpen");
  await page.locator("#reportOpen").click();
  await page.locator("#reportStudio").waitFor({state:"visible"});
  assert.equal(await page.evaluate(()=>document.activeElement?.id),"reportStudioTitle");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#reportStudio").isHidden(),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),"reportOpen");

  await page.locator("#workflowSource").fill(
   "pedido;cliente;email;total;estado\nA-01;Equipo;test@ejemplo.test;12;nuevo");
  assert.equal(await page.locator("#exportWorkflow").isDisabled(),true);
  await page.locator('[data-scenario="support"]').click();
  assert.equal(await page.locator("#scenarioDiscard").isVisible(),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),"confirmScenarioDiscard");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(()=>document.activeElement?.id),"cancelScenarioDiscard","Tab wraps within confirmation");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.evaluate(()=>document.activeElement?.id),"confirmScenarioDiscard");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#scenarioDiscard").isHidden(),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute("data-scenario")),"orders");
  await page.locator("#workflowSource").fill("pedido;cliente;email;total;estado\nA-01;Mal;no-es-correo;10;nuevo");
  await page.locator("#runWorkflow").click();
  assert.equal(await page.locator("#workflowSource").getAttribute("aria-invalid"),"false","CSV structural validity is separate from row status");
  await page.locator("#workflowSource").fill("pedido;cliente\nX;A");
  await page.locator("#runWorkflow").click();
  assert.equal(await page.locator("#workflowSource").getAttribute("aria-invalid"),"true");
  assert.equal(await page.evaluate(()=>document.activeElement?.id),"workflowError");
  assert.match(await page.locator("#workflowError").getAttribute("aria-atomic"),/true/);
  await page.locator("#resetWorkflow").click();
  await page.locator("#runWorkflow").click();
  assert.equal(await page.locator("#workflowSource").getAttribute("aria-invalid"),"false");

  await auditAccessibility(page,"PR78 closed panels");
  for(const theme of ["dark","light"]){
   if(await page.locator("html").getAttribute("data-theme")!==theme)
    await page.locator("[data-theme-toggle]").click();
   assert.equal(await page.locator("html").getAttribute("data-theme"),theme);
   const c=await page.evaluate(()=>{
    const color=selector=>{
     const style=getComputedStyle(document.querySelector(selector));
     return {color:style.color,background:style.backgroundColor};
    };
    return [color(".workbench-p78-help summary"),color(".workbench-p77-preview h3")];
   });
   assert.equal(c.length,2);
   await auditAccessibility(page,"PR78 "+theme+" contrast and labels");
  }
  // 1280 physical px at 400% browser zoom corresponds to a 320 CSS-px reflow.
  for(const width of [390,320]){
   await page.setViewportSize({width,height:760});
   const dims=await page.evaluate(()=>({cssWidth:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(dims.scroll<=dims.cssWidth+3,"PR78 400% CSS reflow "+JSON.stringify(dims));
   const targets=await page.evaluate(()=>["#runWorkflow","#reportOpen","#rulesOpen","#candidateOpen",
    ".workbench-row:not([hidden]) .workbench-row-edit"].map(selector=>{
     const el=document.querySelector(selector);
     return {selector,height:el?.getBoundingClientRect().height||0};
   }));
   for(const target of targets)assert.ok(target.height>=44,
    "PR78 44px touch/keyboard target "+JSON.stringify(target));
  }
  // Forced colors and reduced motion are supported CSS states; do not infer user OS settings.
  await page.emulateMedia({forcedColors:"active",reducedMotion:"reduce"});
  assert.equal(await page.evaluate(()=>matchMedia("(forced-colors: active)").matches),true);
  assert.equal(await page.evaluate(()=>matchMedia("(prefers-reduced-motion: reduce)").matches),true);
  assert.deepEqual(errors,[]);
  console.log("PR78 ACCESSIBLE WORKBENCH PASS ("+engineName+"): tab, arrow keys, panels, focus return, form errors, 400% equivalent reflow, axe");
 }finally{await page.close();}
}

async function auditPrivacySecurity(browser){
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:"reduce",acceptDownloads:true});
 const errors=[],remote=[];
 page.on("pageerror",error=>errors.push(error.message));
 page.on("request",request=>{
  if(!request.url().startsWith(base))remote.push(request.url());
 });
 try{
  await page.goto(base+"/demo.html?scenario=orders&view=advanced",{waitUntil:"load"});
  assert.equal(await page.locator("#privacyInspect").isEnabled(),true);
  assert.match(await page.locator("#privacyRiskStatus").innerText(),/6 registros en memoria/);
  await page.locator("#privacyInspect").click();
  assert.match(await page.locator("#privacyRiskStatus").innerText(),/Sin envío, sin telemetría/);
  await page.locator("#workflowSource").fill(
   'pedido;cliente;email;total;estado\nR-SECRET;"=HYPERLINK(""https://evil.test"",""click"")";persona.real@empresa.es;15;nuevo\nR2;Cliente;test@ejemplo.test;33;revisar');
  await page.locator("#runWorkflow").click();
  assert.equal(await page.locator("#countTotal").innerText(),"2");
  assert.match(await page.locator("#privacyRiskStatus").innerText(),/1 fuera de dominios de ejemplo/);
  assert.match(await page.locator("#privacyRiskStatus").innerText(),/1 celda\(s\) con fórmulas/);
  const csvPromise=page.waitForEvent("download");
  await page.locator("#exportWorkflow").click();
  const csvFile=await csvPromise;
  const csv=await readFile(await csvFile.path(),"utf8");
  assert.match(csv,/"'=HYPERLINK\(""https:\/\/evil\.test"",""click""\)"/);
  assert.match(csv,/persona.real@empresa.es/,"explicit detailed CSV includes user data; warning must be visible");
  assert.match(await page.locator(".workbench-export-warning").innerText(),/incluyen valores/);
  await page.locator("#rulesOpen").click();
  await page.locator("#rulesStudio").waitFor({state:"visible"});
  await page.locator("#humanReviewNote").fill("Nota confidencial de prueba: secreto temporal único.");
  await page.locator("#humanReviewApprove").click();
  assert.match(await page.locator("#humanReviewCounters").innerText(),/Aprobación simulada: 1/);
  await page.locator("#rulesClose").click();
  await page.evaluate(()=>{
   sessionStorage.setItem("revops-studio:demo:handoff","sensitive handoff");
   sessionStorage.setItem("revops-studio:p74:view-v1","private view");
   sessionStorage.setItem("other-app:keep","other");
   localStorage.setItem("revops-theme","light");
  });
  await page.locator("#privacyClearOpen").click();
  assert.equal(await page.locator("#privacyClearConfirm").isVisible(),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),"privacyClearTitle");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#privacyClearConfirm").isHidden(),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),"privacyClearOpen");
  assert.match(await page.locator("#workflowSource").inputValue(),/R-SECRET/);
  await page.locator("#privacyClearOpen").click();
  await page.locator("#privacyClearConfirmButton").click();
  assert.equal(await page.locator("#privacyClearConfirm").isHidden(),true);
  assert.match(await page.locator("#workflowSource").inputValue(),/PED-101/);
  assert.doesNotMatch(await page.locator("#workflowSource").inputValue(),/R-SECRET|persona.real@empresa/);
  assert.equal(await page.locator("#countTotal").innerText(),"6");
  assert.equal(await page.locator("#countReady").innerText(),"3");
  assert.equal(await page.locator("#humanReviewNote").inputValue(),"");
  assert.equal(await page.locator("#rulesExport").isDisabled(),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),"privacyClearOpen");
  const storage=await page.evaluate(()=>({
   handoff:sessionStorage.getItem("revops-studio:demo:handoff"),
   view:sessionStorage.getItem("revops-studio:p74:view-v1"),
   other:sessionStorage.getItem("other-app:keep"),theme:localStorage.getItem("revops-theme")
  }));
  assert.equal(storage.handoff,null);
  assert.equal(storage.view,null);
  assert.equal(storage.other,"other");
  assert.equal(storage.theme,"light");
  assert.match(await page.locator("#privacyClearStatus").innerText(),/descargas anteriores y el portapapeles/);
  await page.locator("#rulesOpen").click();
  await page.locator("#rulesStudio").waitFor({state:"visible"});
  assert.match(await page.locator("#humanReviewCounters").innerText(),/Aprobación simulada: 0/);
  await page.setViewportSize({width:320,height:760});
  const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(dimensions.scroll<=dimensions.width+3,"PR79 privacy mobile overflow "+JSON.stringify(dimensions));
  assert.equal(remote.length,0,"PR79 demo must not use remote scripts or send any data");
  assert.deepEqual(errors,[],"PR79 browser errors");
  console.log("PR79 SECURITY PASS ("+engineName+"): spreadsheet injection, scope, safe reset, memory scrub, first-party network, 320px");
 }finally{await page.close();}
}

async function auditPilotReadiness(browser){
 const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true,reducedMotion:"reduce"});
 const errors=[],requests=[];
 page.on("pageerror",error=>errors.push(error.message));
 page.on("request",request=>requests.push(request.url()));
 try{
  await page.goto(base+"/demo.html?scenario=orders&view=advanced",{waitUntil:"load"});
  assert.equal(await page.locator("#pilotStudio").isHidden(),true);
  assert.equal(requests.some(url=>url.includes("/pilot-console.js")),false);
  await page.locator("#pilotOpen").click();
  await page.locator("#pilotStudio").waitFor({state:"visible"});
  assert.equal(await page.locator("#pilotOpen").getAttribute("aria-expanded"),"true");
  assert.equal(await page.evaluate(()=>document.activeElement?.id),"pilotStudioTitle");
  assert.match(await page.locator("#pilotOutcome").innerText(),/requiere correcciones/);
  assert.equal(await page.locator("#pilotBlockers").innerText(),"1");
  assert.equal(await page.locator("#pilotChecks li").count(),8);
  assert.match(await page.locator("#pilotChecks [data-state='blocked']").innerText(),/PIL-02/);
  assert.match(await page.locator("#pilotChecks").innerText(),/PIL-08/);
  await page.locator("#pilotChecks button[data-pilot-action='blockers']").click();
  assert.equal(await page.locator("#workflowEditForm").isVisible(),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute("name")),"pedido");
  await page.locator("#cancelWorkflowEdit").click();
  const txtPromise=page.waitForEvent("download");
  await page.locator("#pilotExportTxt").click();
  const txtFile=await txtPromise;
  assert.match(txtFile.suggestedFilename(),/revops-evaluacion-piloto-orders\.txt/);
  const body=await readFile(await txtFile.path(),"utf8");
  assert.match(body,/DEMO LOCAL, NO AUTORIZACIÓN NI CERTIFICACIÓN/);
  assert.match(body,/Acciones externas ejecutadas: 0/);
  assert.doesNotMatch(body,/PED-101|norte@ejemplo\.test|Tienda Norte/);
  const jsonPromise=page.waitForEvent("download");
  await page.locator("#pilotExportJson").click();
  const jsonFile=await jsonPromise;
  const json=JSON.parse(await readFile(await jsonFile.path(),"utf8"));
  assert.equal(json.schema,"revops-pilot-readiness-v1");
  assert.equal(json.checks.length,8);
  assert.equal(json.suitableForSupervisedDemo,false);
  assert.doesNotMatch(JSON.stringify(json),/PED-101|norte@ejemplo\.test|Tienda Norte/);
  await page.locator("#pilotClose").click();
  assert.equal(await page.locator("#pilotStudio").isHidden(),true);
  assert.equal(await page.evaluate(()=>document.activeElement?.id),"pilotOpen");
  // Reusing the app's existing guided presets changes genuine engine results.
  await page.locator("#workflowRecipe").selectOption("clear");
  await page.locator("#loadWorkflowRecipe").click();
  assert.equal(await page.locator("#countBlocked").innerText(),"0");
  assert.equal(await page.locator("#countReview").innerText(),"0");
  await page.locator("#pilotOpen").click();
  await page.locator("#pilotStudio").waitFor({state:"visible"});
  assert.match(await page.locator("#pilotOutcome").innerText(),/muestra apta para ensayo supervisado/);
  assert.equal(await page.locator("#pilotPassed").innerText(),"8");
  assert.equal(await page.locator("#pilotWarnings").innerText(),"0");
  assert.equal(await page.locator("#pilotBlockers").innerText(),"0");
  // Explicit invalidation forbids exporting a stale readiness certificate.
  await page.locator("#workflowSource").fill("pedido;cliente;email;total;estado\nO1;;bad;1;nuevo");
  assert.equal(await page.locator("#pilotStudio").isHidden(),true);
  assert.equal(await page.locator("#pilotOpen").isDisabled(),true);
  await page.locator("#runWorkflow").click();
  await page.locator("#pilotOpen").click();
  await page.locator("#pilotStudio").waitFor({state:"visible"});
  assert.match(await page.locator("#pilotOutcome").innerText(),/requiere correcciones/);
  await page.setViewportSize({width:320,height:760});
  const d=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(d.scroll<=d.w+3,"PR80 320px overflow "+JSON.stringify(d));
  await auditAccessibility(page,"PR80 pilot preflight open");
  await page.goto(base+"/demo.html?scenario=support&view=advanced",{waitUntil:"load"});
  await page.locator("#pilotOpen").click();
  await page.locator("#pilotStudio").waitFor({state:"visible"});
  await page.locator("#pilotOutcome").getByText("requiere correcciones",{exact:false}).waitFor({state:"visible"});
  await page.goto(base+"/demo.html?scenario=data&view=advanced",{waitUntil:"load"});
  await page.locator("#pilotOpen").click();
  await page.locator("#pilotStudio").waitFor({state:"visible"});
  await page.locator("#pilotOutcome").getByText("requiere correcciones",{exact:false}).waitFor({state:"visible"});
  assert.ok(requests.some(url=>url.includes("/pilot-console.js")),"lazy-loaded advanced module");
  assert.deepEqual(errors,[],"PR80 browser errors");
  console.log("PR80 PILOT READINESS PASS ("+engineName+"): 8 real gates, 3 workflows, remediation, clean baseline, evidence privacy, reset, axe, 320px");
 }finally{await page.close();}
}

async function auditClientFirstVisit(browser){
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:"reduce",acceptDownloads:true});
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  try{
    await page.goto(base+"/demo.html",{waitUntil:"load"});
    await page.waitForFunction(()=>document.body.dataset.experience==="simple");
    assert.equal(await page.locator("#clientJourney").isVisible(),true,"first visit should start with plain-language guide");
    assert.equal(await page.locator(".workbench-recipes").isVisible(),false,"a novice should not see 18 raw datasets");
    assert.equal(await page.locator(".workbench-editor-grid").isVisible(),false,"CSV editing is optional, not compulsory");
    assert.equal(await page.locator("#clientStepTitle").innerText(),"Empecemos con un problema de tu día a día.");
    assert.equal(await page.locator('[data-client-problem="orders"]').getAttribute("aria-pressed"),"true");
    // Business problem, not a file type, is the first action.
    await page.locator('[data-client-problem="support"]').click();
    assert.equal(await page.locator('[data-client-problem="support"]').getAttribute("aria-pressed"),"true");
    assert.match(await page.locator("#clientStepDescription").innerText(),/tickets ficticios/);
    await page.locator('[data-client-problem="orders"]').click();
    await page.locator("#clientPrimaryAction").click();
    assert.equal(await page.locator("#clientJourney").getAttribute("hidden"),null);
    assert.equal(await page.locator("#clientEvidence").isVisible(),true);
    assert.equal(await page.locator("#clientDetected").innerText(),"2");
    assert.equal(await page.locator("#clientAttention").innerText(),"1");
    assert.equal(await page.locator("#clientPrepared").innerText(),"2");
    assert.equal(await page.locator(".workbench-insights").isVisible(),true);
    assert.equal(await page.locator(".workbench-table-scroll").isVisible(),false);
    await page.locator("#clientPrimaryAction").click();
    assert.equal(await page.locator("#workflowEditForm").isVisible(),true);
    assert.equal(await page.locator("#workflowEditFields .is-problem").count(),1);
    assert.equal(await page.locator("#workflowEditFields input[name='pedido']").getAttribute("aria-invalid"),"true");
    assert.match(await page.locator("#clientStepDescription").innerText(),/marcado/);
    await page.locator("#workflowEditFields input[name='pedido']").fill("PED-999");
    await page.locator("#saveWorkflowEdit").click();
    assert.equal(await page.locator('body').getAttribute("data-guide-stage"),"finished");
    assert.equal(await page.locator("#clientPrepared").innerText(),"3");
    assert.equal(await page.locator("#clientDetected").innerText(),"1");
    assert.match(await page.locator("#clientStepDescription").innerText(),/Antes había 2 bloqueos/);
    assert.equal(await page.locator("#clientContactAction").isVisible(),true);
    assert.equal(await page.locator("#workflowEditForm").isVisible(),false);
    const d=page.waitForEvent("download");
    await page.locator("#clientPrimaryAction").click();
    const report=await d;
    assert.match(report.suggestedFilename(),/revops-informe-orientativo-orders\.txt/);
    const textReport=await readFile(await report.path(),"utf8");
    assert.match(textReport,/Acciones preparadas: 3/);
    assert.doesNotMatch(textReport,/PED-999|norte@ejemplo\.test/);
    await page.locator("#experienceToggle").click();
    assert.equal(await page.locator(".workbench-editor-grid").isVisible(),true);
    assert.equal(await page.locator("#clientJourney").isVisible(),false);
    await page.locator("#experienceToggle").click();
    assert.equal(await page.locator("#clientJourney").isVisible(),true);
    assert.equal(await page.locator("#clientPrepared").innerText(),"3");
    assert.match(page.url(),/view=simple/);
    const dims=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(dims.scroll<=dims.width+3,"guided mode overflows mobile "+JSON.stringify(dims));
    assert.deepEqual(errors,[],"guided visit runtime errors");
    // The consultation link must use the same privacy-safe aggregated handoff.
    await page.locator("#clientContactAction").click();
    await page.waitForURL(/\/#contacto$/);
    assert.match(await page.locator("#diagnosticoBrief").inputValue(),/Escenario de simulación: Pedidos/);
    assert.doesNotMatch(await page.locator("#diagnosticoBrief").inputValue(),/PED-999/);
    console.log("CLIENT FIRST-VISIT PASS ("+engineName+"): problem, findings, one correction, actual outcome, report, consultation and mobile");
  }finally{await page.close();}
}

async function auditProductWorkbench(browser) {
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:"reduce",acceptDownloads:true});
  const failures=[];
  page.on("pageerror",error=>failures.push(error.message));
  try {
    await page.goto(base+"/demo.html?scenario=orders",{waitUntil:"load"});
    await page.waitForFunction(()=>document.querySelector("#countTotal")?.textContent==="6");
    assert.equal(await page.locator("#countReady").innerText(),"3");
    assert.equal(await page.locator("#countReview").innerText(),"1");
    assert.equal(await page.locator("#countBlocked").innerText(),"2");
    assert.equal(await page.locator("#insightsActionable").innerText(),"2");
    assert.equal(await page.locator("#insightsHistoric").innerText(),"1");
    assert.equal(await page.locator("#insightsRatio").innerText(),"33 %");
    assert.equal(await page.locator("#qualityCockpit").isVisible(),true);
    assert.equal(await page.locator("#qualityUniqueIds").innerText(),"5");
    assert.equal(await page.locator("#qualityExactDuplicates").innerText(),"1");
    assert.equal(await page.locator("#qualityConflicts").innerText(),"0");
    assert.match(await page.locator("#qualityColumnDetails").innerText(),/email[\s\S]*1 vacío/);
    await page.locator("#qualityColumnDetails [data-quality-index]").first().click();
    assert.equal(await page.locator("#workflowEditForm").isVisible(),true);
    assert.match(await page.locator("#workbench-edit-title").innerText(),/PED-103/);
    await page.locator("#cancelWorkflowEdit").click();
    assert.equal(await page.locator("#r2Evidence").isVisible(),true);
    assert.equal(await page.locator("#r2BeforePrepared").innerText(),"2");
    assert.equal(await page.locator("#r2AfterPrepared").innerText(),"2");
    assert.equal(await page.locator("#r2BeforeBlocked").innerText(),"2");
    assert.equal(await page.locator("#r2AfterBlocked").innerText(),"2");
    assert.equal(await page.locator("#insightsDistribution span").count(),4);
    assert.equal(await page.locator("#workflowRows tr").count(),6);
    await page.locator("#workflowSearch").fill("duplicado");
    assert.equal(await page.locator(".workbench-row:visible").count(),1);
    assert.equal(await page.locator("#exportVisible").isEnabled(),true);
    const visibleDownloadPromise=page.waitForEvent("download");
    await page.locator("#exportVisible").click();
    const visibleDownload=await visibleDownloadPromise;
    assert.match(visibleDownload.suggestedFilename(),/revops-vista-orders\.csv/);
    const visibleText=await readFile(await visibleDownload.path(),"utf8");
    assert.match(visibleText,/PED-101/);
    assert.doesNotMatch(visibleText,/PED-102|PED-103/);
    await page.locator("#workflowSearch").fill("sin coincidencias");
    assert.equal(await page.locator("#workflowNoResults").isVisible(),true);
    assert.equal(await page.locator("#exportVisible").isDisabled(),true);
    await page.locator("#resetResultsView").click();
    assert.equal(await page.locator(".workbench-row:visible").count(),6);
    assert.equal(await page.locator("#workflowNoResults").isHidden(),true);
    await page.locator("#quickDemoAction").click();
    assert.equal(await page.locator("#workflowEditForm").isVisible(),true);
    await page.locator("#cancelWorkflowEdit").click();
    assert.equal(await page.locator("#exportWorkflow").isEnabled(),true);
    const initial=await page.locator("#workflowSource").inputValue();
    assert.match(initial,/PED-101/);
    assert.equal(await page.locator("#qualityCompleteness").innerText(),"97 %");
    assert.match(await page.locator("#qualityFields").innerText(),/email: 1 sin dato/);
    await page.locator("#workflowSort").selectOption("risk");
    assert.match(await page.locator(".workbench-row:visible").first().innerText(),/bloqueado/i);
    await page.locator("#workflowSort").selectOption("source");
    await page.locator("#workflowRecipe").selectOption("duplicates");
    assert.match(await page.locator("#recipeHint").innerText(),/IDs repetidos/);
    assert.match(await page.locator("#workflowSource").inputValue(),/PED-101/,"selection must not overwrite text");
    await page.locator("#loadWorkflowRecipe").click();
    assert.equal(await page.locator("#countTotal").innerText(),"4");
    assert.equal(await page.locator("#countBlocked").innerText(),"2");
    assert.equal(await page.locator("#qualityCompleteness").innerText(),"100 %");
    const templatePromise=page.waitForEvent("download");
    await page.locator("#downloadWorkflowTemplate").click();
    const templateFile=await templatePromise;
    assert.match(templateFile.suggestedFilename(),/revops-plantilla-orders\.csv/);
    assert.match(await readFile(await templateFile.path(),"utf8"),/ORD-201/);
    await page.locator("#workflowRecipe").selectOption("original");
    await page.locator("#loadWorkflowRecipe").click();
    assert.equal(await page.locator("#countTotal").innerText(),"6");
    assert.equal(await page.locator("#countBlocked").innerText(),"2");

    // Product value: repair an actual duplicate via the interface, not textarea edits.
    await page.locator('[data-workflow-filter="bloqueado"]').click();
    assert.equal(await page.locator(".workbench-row:visible").count(),2);
    await page.locator(".workbench-row:visible .workbench-row-edit").first().click();
    assert.equal(await page.locator("#workflowEditForm").isVisible(),true);
    await page.locator('#workflowEditFields input[name="pedido"]').fill("PED-999");
    await page.locator("#saveWorkflowEdit").click();
    assert.equal(await page.locator("#countBlocked").innerText(),"1");
    assert.equal(await page.locator("#insightsActionable").innerText(),"3");
    assert.equal(await page.locator("#insightsHistoric").innerText(),"1");
    assert.equal(await page.locator("#insightsRatio").innerText(),"50 %");
    assert.match(await page.locator("#changeComparison").innerText(),/Antes: 2 acciones preparadas/);
    assert.match(await page.locator("#changeComparison").innerText(),/Después: 3 acciones preparadas/);
    assert.equal(await page.locator("#r2BeforePrepared").innerText(),"2");
    assert.equal(await page.locator("#r2AfterPrepared").innerText(),"3");
    assert.equal(await page.locator("#r2AfterBlocked").innerText(),"1");
    assert.equal(await page.locator("#qualityUniqueIds").innerText(),"6");
    assert.equal(await page.locator("#qualityExactDuplicates").innerText(),"0");
    assert.match(await page.locator("#qualityDelta").innerText(),/-1 bloqueos/);
    const qualityDownloadPromise=page.waitForEvent("download");
    await page.locator("#qualityExport").click();
    const qualityFile=await qualityDownloadPromise;
    assert.match(qualityFile.suggestedFilename(),/revops-calidad-pr73-orders\.txt/);
    const qualityText=await readFile(await qualityFile.path(),"utf8");
    assert.match(qualityText,/Cambio de bloqueados: -1/);
    assert.match(qualityText,/Acciones ejecutadas fuera del navegador: 0/);
    assert.doesNotMatch(qualityText,/PED-101|PED-999|norte@ejemplo\.test|Tienda Norte/);
    assert.match(await page.locator("#r2Delta").innerText(),/\+1 propuestas, -1 bloqueos/);
    assert.match(await page.locator("#r2Transitions").innerText(),/bloqueado → listo/);
    const r2Promise=page.waitForEvent("download");
    await page.locator("#r2Export").click();
    const r2Download=await r2Promise;
    assert.match(r2Download.suggestedFilename(),/revops-comparativa-r2-orders\.txt/);
    const r2Text=await readFile(await r2Download.path(),"utf8");
    assert.match(r2Text,/Acciones ejecutadas fuera del navegador: 0/);
    assert.doesNotMatch(r2Text,/PED-999|PED-101|norte@ejemplo\.test|Tienda Norte/);
    assert.equal(await page.locator(".workbench-row:visible").count(),1);
    assert.equal(await page.locator("#undoCorrection").isEnabled(),true);
    await page.locator("#undoCorrection").click();
    assert.equal(await page.locator("#countBlocked").innerText(),"2");
    assert.equal(await page.locator("#changeComparison").isHidden(),true);
    assert.equal(await page.locator("#r2AfterPrepared").innerText(),"2");
    assert.equal(await page.locator("#r2AfterBlocked").innerText(),"2");
    assert.equal(await page.locator("#undoCorrection").isDisabled(),true);
    assert.equal(await page.locator("#redoCorrection").isEnabled(),true);
    await page.locator("#redoCorrection").click();
    assert.equal(await page.locator("#countBlocked").innerText(),"1");
    assert.equal(await page.locator("#r2AfterPrepared").innerText(),"3");
    await page.locator("#undoCorrection").click();
    assert.equal(await page.locator("#countBlocked").innerText(),"2");
    await page.locator('[data-workflow-filter="all"]').click();
    const reportPromise=page.waitForEvent("download");
    await page.locator("#exportInsights").click();
    const report=await reportPromise;
    assert.match(report.suggestedFilename(),/revops-informe-orientativo-orders\.txt/);
    const reportText=await readFile(await report.path(),"utf8");
    assert.match(reportText,/Acciones preparadas: 2/);
    assert.doesNotMatch(reportText,/PED-101|norte@ejemplo\.test|Tienda Norte/);
    // Import a real local CSV, export actionable records only, and recover from a bad file.
    const ownCsv="pedido;cliente;email;total;estado\nNEW-1;Tienda;test@ejemplo.test;200;nuevo\nNEW-2;Tienda;;50;nuevo";
    await page.locator("#importWorkflow").setInputFiles({name:"datos-prueba.csv",mimeType:"text/csv",buffer:Buffer.from(ownCsv)});
    await page.waitForFunction(()=>document.querySelector("#countTotal")?.textContent==="2");
    assert.equal(await page.locator("#countBlocked").innerText(),"1");
    assert.equal(await page.locator("#exportActionQueue").isEnabled(),true);
    const readyDownload=page.waitForEvent("download");
    await page.locator("#exportActionQueue").click();
    const readyFile=await readyDownload;
    assert.match(readyFile.suggestedFilename(),/revops-cola-preparada-orders\.csv/);
    const queueContent=await readFile(await readyFile.path(),"utf8");
    assert.match(queueContent,/NEW-1/);
    assert.doesNotMatch(queueContent,/NEW-2/);
    // PR72: binary encoding guard preserves the previous valid input.
    const originalAfterImport=await page.locator("#workflowSource").inputValue();
    await page.locator("#importWorkflow").setInputFiles({
      name:"utf16.csv",mimeType:"text/csv",buffer:Buffer.from([0xff,0xfe,0x70,0])
    });
    await page.locator("#workflowError").waitFor({state:"visible"});
    assert.match(await page.locator("#workflowError").innerText(),/UTF-16/);
    assert.equal(await page.locator("#workflowSource").inputValue(),originalAfterImport);
    await page.locator("#importWorkflow").setInputFiles({
      name:"latin1.csv",mimeType:"text/csv",buffer:Buffer.from([0x61,0x3b,0x62,0x0a,0xe9,0x3b,0x31])
    });
    assert.match(await page.locator("#workflowError").innerText(),/UTF-8/);
    assert.equal(await page.locator("#workflowSource").inputValue(),originalAfterImport);
    // PR72: TSV import, strict text decoding and no silent conversion of IDs.
    await page.locator("#importWorkflow").setInputFiles({
      name:"pedidos.tsv",mimeType:"text/tab-separated-values",
      buffer:Buffer.from("pedido\tcliente\temail\ttotal\testado\n0007\tEmpresa\tx@ejemplo.test\t34\tnuevo")
    });
    assert.equal(await page.locator("#countTotal").innerText(),"1");
    assert.equal(await page.locator("#workflowRows .workbench-row").first().getAttribute("data-status"),"listo");
    assert.match(await page.locator("#importAuditTitle").innerText(),/TSV/);
    assert.match(await page.locator("#workflowSource").inputValue(),/0007/);
    // Ambiguous amounts are flagged and never interpreted as decimals or thousands.
    const beforeAmbiguous=await page.locator("#workflowSource").inputValue();
    await page.locator("#importWorkflow").setInputFiles({
      name:"ambiguous.csv",mimeType:"text/csv",
      buffer:Buffer.from('pedido;cliente;email;total;estado\n0007;Tienda;x@ejemplo.test;"1.234";nuevo')
    });
    await page.locator("#workflowError").waitFor({state:"visible"});
    assert.match(await page.locator("#workflowError").innerText(),/Importe ambiguo/);
    assert.equal(await page.locator("#workflowSource").inputValue(),beforeAmbiguous);
    const savedSource=await page.locator("#workflowSource").inputValue();
    await page.locator("#importWorkflow").setInputFiles({
      name:"invalid.csv",mimeType:"text/csv",buffer:Buffer.from("foo;bar\n1;2")
    });
    await page.locator("#workflowError").waitFor({state:"visible"});
    assert.equal(await page.locator("#workflowSource").inputValue(),savedSource);
    await page.locator("#runWorkflow").click();
    assert.equal(await page.locator("#workflowError").isHidden(),true);
    const previousCsv=await page.locator("#workflowSource").inputValue();
    const externalCsv="Order ID;Company;Correo;Amount;Status;Nota privada\n0007;Almacén Norte;test@ejemplo.test;44;nuevo;solo prueba";
    await page.locator("#importWorkflow").setInputFiles({
      name:"exportacion-crm.csv",mimeType:"text/csv",buffer:Buffer.from(externalCsv)
    });
    await page.locator("#columnMapper").waitFor({state:"visible",timeout:10000});
    assert.equal(await page.locator("#workflowSource").inputValue(),previousCsv,"no replacement before confirmation");
    assert.equal(await page.locator("#columnMappingRows select").count(),5);
    assert.equal(await page.locator("#mapping-pedido").inputValue(),"order id");
    assert.equal(await page.locator("#mapping-cliente").inputValue(),"company");
    assert.match(await page.locator("#columnMappingIgnored").innerText(),/nota privada/);
    await page.locator("#mapping-cliente").selectOption("order id");
    await page.locator("#applyColumnMapping").click();
    assert.match(await page.locator("#columnMappingStatus").innerText(),/misma columna|más de un campo/);
    await page.locator("#mapping-cliente").selectOption("company");
    assert.match(await page.locator("#importAuditFindings").innerText(),/Columnas extras:/);
    // PR72: cannot discard an extra column without explicit confirmation.
    await page.locator("#applyColumnMapping").click();
    assert.match(await page.locator("#columnMappingStatus").innerText(),/Confirma expresamente/);
    assert.equal(await page.locator("#workflowSource").inputValue(),previousCsv);
    const profileDownloadPromise=page.waitForEvent("download");
    await page.locator("#exportMappingProfile").click();
    const profileDownload=await profileDownloadPromise;
    assert.match(profileDownload.suggestedFilename(),/revops-perfil-columnas-orders\.json/);
    const profileText=await readFile(await profileDownload.path(),"utf8");
    assert.match(profileText,/revops-mapping-profile-v1/);
    assert.doesNotMatch(profileText,/Almacén Norte|0007|test@ejemplo.test|solo prueba/);
    // Importing that profile fills the mapper, without modifying any source records.
    await page.locator("#mapping-cliente").selectOption("order id");
    await page.locator("#importMappingProfile").setInputFiles({
      name:"columns.json",mimeType:"application/json",buffer:Buffer.from(profileText)
    });
    await page.waitForFunction(()=>document.querySelector("#mapping-cliente")?.value==="company",null,{timeout:5000});
    assert.equal(await page.locator("#mapping-cliente").inputValue(),"company");
    assert.equal(await page.locator("#workflowSource").inputValue(),previousCsv);
    await page.locator("#confirmDiscardColumns").check();
    await page.locator("#applyColumnMapping").click();
    assert.equal(await page.locator("#columnMapper").isHidden(),true);
    assert.equal(await page.locator("#countTotal").innerText(),"1");
    assert.equal(await page.locator("#countReady").innerText(),"1");
    assert.match(await page.locator("#workflowSource").inputValue(),/0007/);
    assert.doesNotMatch(await page.locator("#workflowSource").inputValue(),/solo prueba/);
    await page.locator("#workflowSource").fill("id;empresa;email;total;estado\n0008;Tienda;test2@ejemplo.test;12;nuevo");
    await page.locator("#openColumnMapper").click();
    assert.equal(await page.locator("#columnMapper").isVisible(),true);
    await page.locator("#mapping-cliente").selectOption("empresa");
    await page.locator("#mapping-pedido").selectOption("id");
    await page.locator("#applyColumnMapping").click();
    assert.equal(await page.locator("#countReady").innerText(),"1");
    assert.match(await page.locator("#workflowSource").inputValue(),/0008/);
    await page.locator("#workflowSource").fill("pedido;cliente;email;total;estado\nA-1;Tienda;a@ejemplo.test;200;nuevo\nA-2;Tienda;email-invalido;50;nuevo");
    assert.equal(await page.locator("#exportWorkflow").isDisabled(),true);
    await page.locator("#runWorkflow").click();
    assert.equal(await page.locator("#countTotal").innerText(),"2");
    assert.equal(await page.locator("#countBlocked").innerText(),"1");
    const downloadPromise=page.waitForEvent("download");
    await page.locator("#exportWorkflow").click();
    const download=await downloadPromise;
    assert.match(download.suggestedFilename(),/revops-simulacion-orders\.csv/);
    const oldInputs=await page.locator("#workflowSource").inputValue();
    await page.locator('[data-scenario="support"]').click();
    assert.equal(await page.locator("#scenarioDiscard").isVisible(),true);
    assert.equal(await page.locator("#workflowSource").inputValue(),oldInputs,"user modifications survive an unconfirmed switch");
    await page.locator("#cancelScenarioDiscard").click();
    assert.equal(await page.locator("#scenarioDiscard").isHidden(),true);
    assert.equal(await page.locator("#workflowSource").inputValue(),oldInputs);
    await page.locator('[data-scenario="support"]').click();
    await page.locator("#confirmScenarioDiscard").click();
    assert.equal(await page.locator("#scenarioDiscard").isHidden(),true);
    await page.locator("#runWorkflow").click();
    assert.match(await page.locator("#scenarioDescription").innerText(),/incidencias/);
    assert.equal(await page.locator("#countReview").innerText(),"1");
    await page.locator('[data-scenario="data"]').click();
    await page.locator("#runWorkflow").click();
    assert.equal(await page.locator("#countReady").innerText(),"3");
    const tsvSample="registro\tfuente\tvalor\tfecha\nTSV-001\tCRM\t24,50\t2026-10-08";
    await page.locator("#importWorkflow").setInputFiles({
      name:"exportacion.tsv",mimeType:"text/tab-separated-values",buffer:Buffer.from(tsvSample)
    });
    await page.waitForFunction(()=>document.querySelector("#countTotal")?.textContent==="1");
    assert.equal(await page.locator("#countReady").innerText(),"1");
    assert.match(await page.locator("#workflowSource").inputValue(),/TSV-001/);
    await page.locator("#workflowSource").fill("registro;fuente;valor;fecha\nA;CRM;10");
    await page.locator("#runWorkflow").click();
    assert.equal(await page.locator("#workflowError").isVisible(),true);
    assert.equal(await page.locator("#exportWorkflow").isDisabled(),true);
    await page.locator("#resetWorkflow").click();
    await page.locator("#runWorkflow").click();
    assert.equal(await page.locator("#workflowError").isHidden(),true);
    await page.locator("#demoContact").click();
    await page.waitForURL(/\/#contacto$/);
    assert.match(await page.locator("#diagnosticoBrief").inputValue(),/Escenario de simulación: Datos/);
    assert.doesNotMatch(await page.locator("#diagnosticoBrief").inputValue(),/REG-01/);
    assert.equal(await page.locator("#diagnosticContext").isVisible(),true);
    assert.equal(await page.locator("#servicio").inputValue(),"Datos y BI");
    const dims=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(dims.scroll<=dims.viewport+3,"product demo mobile overflow "+JSON.stringify(dims));
    assert.deepEqual(failures,[],"demo script runtime errors");
    console.log("PRODUCT WORKBENCH PASS ("+engineName+"): guided triage, search, correction delta, private report, CSV mapping, export and contact");
  }finally{await page.close();}
}

try {
  browser=await browserEngine.launch(engineName==="chrome"?
    {channel:"chrome",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]}:
    {headless:true});
  await auditCommercialCssParity(browser);
  await auditCustomerDiagnostic(browser);
  await auditDiscoveryStudio(browser);
  await auditClientFirstVisit(browser);
  await auditProductWorkbench(browser);
  await auditCorrectionWorkbench(browser);
  await auditDecisionStudio(browser);
  await auditScenarioBuilder(browser);
  await auditExecutivePdf(browser);
  await auditInclusiveWorkbench(browser);
  await auditPrivacySecurity(browser);
  await auditPilotReadiness(browser);
  const page=await browser.newPage({viewport:{width:1366,height:840},reducedMotion:"reduce"});
  page.on("pageerror",describe);
  page.on("console",message=>{if(message.type()==="error")console.log("CONSOLE_ERROR:",message.text())});
  page.on("response",response=>{if(response.status()>=400)console.log("HTTP_ERROR:",response.status(),response.url())});

  await page.goto(base+"/laboratorio.html",{waitUntil:"load"});
  await page.locator("#demoRows tr").first().waitFor({state:"attached",timeout:45000});
  assert.equal(await page.locator("#demoRows tr").count(),8,"V40 should render eight demo records");
  assert.equal(await page.locator("#advancedWorkbench").evaluate(el=>el.open),false);
  await page.locator("#runDemo").click();
  await page.locator("#guidedNext").click();
  assert.match(await page.locator("#guidedProgress").innerText(),/02 \/ 04/);
  await page.locator("#advancedWorkbench summary").click();
  assert.ok(await page.locator("#calibration-v20-title").isVisible());
  assert.equal(await page.locator("#calibrationV20Severity").evaluate(el=>getComputedStyle(el.closest(".feedback-metrics")).display),"grid");
  await page.locator("#resetCalibrationV20").click();
  await page.locator("#generatePolicySignerV27").click();
  await auditAccessibility(page,"lab-expanded");
  assert.deepEqual(errors,[],"Lab runtime errors");

  await page.goto(base+"/",{waitUntil:"load"});
  await page.locator(".service-card").first().waitFor();
  assert.equal(await page.locator(".study-card").count(),3);
  // Case study evidence uses native disclosure and avoids made-up performance claims.
  await page.locator('[data-case-id="bodytone"] .study-decisions summary').click();
  assert.equal(await page.locator('[data-case-id="bodytone"] .study-decisions').evaluate(el=>el.open),true);
  await page.locator('[data-case-choice="bodytone"]').click();
  assert.match(await page.locator("#caseContextSummary").innerText(),/Bodytone/);
  assert.equal(await page.locator("#servicio").inputValue(),"Automatización");
  await page.locator("#dolor").fill("Mi necesidad redactada por mí, no por la web.");
  await page.locator('[data-case-choice="calculadora"]').click();
  assert.equal(await page.locator("#dolor").inputValue(),"Mi necesidad redactada por mí, no por la web.");
  assert.match(await page.locator("#caseContextSummary").innerText(),/Calculadora de gimnasios/);
  assert.match(decodeURIComponent(await page.locator("#briefEmailFallback").getAttribute("href")),/Calculadora de gimnasios/);
  await page.locator("#caseContextClear").click();
  assert.equal(await page.locator("#casoReferencia").inputValue(),"");
  assert.equal(await page.locator("#caseContext").isHidden(),true);
  // V44 filters must actually remove hidden cards, not merely set a hidden attribute.
  for (const [key, expected] of [["ai",1],["data",2],["automation",3],["apps",3],["all",6]]) {
    const button=page.locator('[data-filter="'+key+'"]');
    await button.click();
    assert.equal(await page.locator(".service-card:visible").count(),expected,key+" visible cards");
    assert.equal(await page.locator(".service-card[hidden]").count(),6-expected,key+" hidden cards");
    assert.equal(await button.getAttribute("aria-pressed"),"true");
    assert.match(await page.locator("#filterStatus").innerText(),new RegExp("Mostrando "+expected+" "));
  }

  // A calculator scenario can travel to the brief, but is never sent automatically.
  await page.locator("#hoursWeek").fill("4");
  await page.locator("#people").fill("3");
  await page.locator("#hourCost").fill("30");
  assert.match(await page.locator("#annualCost").innerText(),/18\.720/);
  await page.locator("#calcToContact").click();
  assert.equal(await page.locator("#horas").inputValue(),"4");
  assert.match(await page.locator("#calcContextSummary").innerText(),/18\.720/);
  assert.match(decodeURIComponent(await page.locator("#briefEmailFallback").getAttribute("href")),/18\.720/);
  assert.equal(await page.locator("#privacyConsent").isChecked(),false);
  await page.locator("#horas").fill("5");
  assert.equal(await page.locator("#estimacion").inputValue(),"");
  await page.locator("#calcToContact").click();
  await page.locator("#calcContextClear").click();
  assert.equal(await page.locator("#estimacion").inputValue(),"");
  await page.locator("#calcToContact").click();

  // Distinct modes, persisted across page boundaries.
  await page.evaluate(()=>localStorage.setItem("revops-theme","dark"));
  await page.reload();
  assert.equal(await page.locator("html").getAttribute("data-theme"),"dark");
  await page.evaluate(() => { window.scrollTo({top:0,behavior:"instant"}); document.activeElement?.blur(); });
  await page.waitForTimeout(180);
  await auditAccessibility(page,"home-dark");
  await captureVisual(page,"dark-hero");
  await captureVisual(page,"dark-cases",page.locator("#casos"));
  await captureVisual(page,"dark-contact",page.locator("#contacto"));
  await page.locator("[data-theme-toggle]").click();
  assert.equal(await page.locator("html").getAttribute("data-theme"),"light");
  await page.evaluate(() => { window.scrollTo({top:0,behavior:"instant"}); document.activeElement?.blur(); });
  await page.waitForTimeout(180);
  await auditAccessibility(page,"home-light");
  await captureVisual(page,"light-hero");
  await page.reload();
  assert.equal(await page.locator("html").getAttribute("data-theme"),"light");
  await page.locator("[data-theme-toggle]").click();
  assert.equal(await page.locator("html").getAttribute("data-theme"),"dark");

  await page.locator('[data-filter="all"]').click();
  await page.locator('[data-service-choice="Quick win"]').click();
  assert.equal(await page.locator("#servicio").inputValue(),"Quick win");
  await page.locator('[data-case-choice="outreach"]').click();
  assert.match(await page.locator("#caseContextSummary").innerText(),/Outreach GenAI/);
  assert.equal(await page.locator("#servicio").inputValue(),"Quick win");
  await page.locator("#hoursWeek").fill("4");
  await page.locator("#people").fill("3");
  await page.locator("#hourCost").fill("30");
  await page.locator("#calcToContact").click();
  assert.match(await page.locator("#calcContextSummary").innerText(),/18\.720/);
  await page.locator("#nombre").fill("Cliente de prueba");
  await page.locator("#email").fill("prueba@example.net");
  await page.locator("#dolor").fill("Duplicamos datos entre herramientas y necesitamos una validación.");
  await page.locator("#privacyConsent").check();

  // FormSubmit can request activation in an HTTP 200 success envelope.
  await page.route("https://formsubmit.co/ajax/**", route=>route.fulfill({
    status:200,contentType:"application/json",
    body:JSON.stringify({success:true,message:"Please activate your form. Check your email."})
  }));
  await page.locator("#briefSubmit").click();
  await page.locator("#formStatus[data-state='error']").waitFor();
  assert.match(await page.locator("#formStatus").innerText(),/propietario active el formulario/);
  assert.equal(new URL(page.url()).pathname,"/");
  assert.equal(await page.locator("#briefSubmit").isEnabled(),true);
  assert.equal(await page.locator("#briefForm").getAttribute("aria-busy"),null);
  await page.unroute("https://formsubmit.co/ajax/**");
  await page.reload();
  assert.equal(await page.locator("#nombre").inputValue(),"Cliente de prueba");
  assert.equal(await page.locator("#servicio").inputValue(),"Quick win");
  assert.match(await page.locator("#caseContextSummary").innerText(),/Outreach GenAI/);
  assert.match(await page.locator("#calcContextSummary").innerText(),/18\.720/);
  assert.match(await page.locator("#formStatus").innerText(),/recuperado tu consulta pendiente/);
  assert.equal(await page.locator("#privacyConsent").isChecked(),false);
  await page.locator("#privacyConsent").check();

  // No real messages leave CI. Test the error path and mailto data preservation.
  await page.route("https://formsubmit.co/ajax/**",route=>route.fulfill({
    status:503,contentType:"application/json",body:'{"success":false}'
  }));
  await page.locator("#briefSubmit").click();
  await page.locator("#formStatus[data-state='error']").waitFor({timeout:15000});
  const fallback=await page.locator("#briefEmailFallback").getAttribute("href");
  assert.ok(fallback.startsWith("mailto:"));
  assert.ok(decodeURIComponent(fallback).includes("Duplicamos datos entre herramientas"));

  await page.unroute("https://formsubmit.co/ajax/**");
  await page.route("https://formsubmit.co/ajax/**",route=>route.fulfill({
    status:200,contentType:"application/json",body:'{"success":"true"}'
  }));
  await page.locator("#briefSubmit").click();
  await page.waitForURL(/gracias\.html\?via=proveedor/,{timeout:16000});
  assert.match(await page.locator("#deliveryExplanation").textContent(),/FormSubmit ha aceptado tu consulta/);
  assert.equal(await page.locator("html").getAttribute("data-theme"),"dark");
  assert.equal(await page.evaluate(()=>sessionStorage.getItem("revops-studio:brief:pending")),null);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem("revops-studio:contact:accepted")),"true");
  assert.match(await page.locator("#briefSummary").innerText(),/18\.720/);
  assert.match(await page.locator("#briefSummary").innerText(),/Outreach GenAI/);
  assert.deepEqual(errors,[],"Desktop runtime errors");

  // A shared or bookmarked thanks URL must never masquerade as a successful send.
  const freshTab=await browser.newPage();
  await freshTab.goto(base+"/gracias.html?via=proveedor",{waitUntil:"load"});
  assert.match(await freshTab.locator("#deliveryExplanation").innerText(),/No se puede verificar un envío/);
  assert.match(await freshTab.locator("#thanksStatus").innerText(),/no confirma un envío/);
  await freshTab.close();

  const mobile=await browser.newPage({
    viewport:{width:390,height:844},
    isMobile:engineName==="chrome",
    hasTouch:engineName==="chrome",
    reducedMotion:"reduce"
  });
  mobile.on("pageerror",describe);
  await mobile.goto(base+"/laboratorio.html",{waitUntil:"load"});
  await mobile.locator("#demoRows tr").first().waitFor({state:"attached",timeout:45000});
  await mobile.locator("#advancedWorkbench summary").click();
  for(const url of ["/laboratorio.html","/"]) {
    await mobile.goto(base+url,{waitUntil:"load"});
    await mobile.waitForTimeout(250);
    const dimensions=await mobile.evaluate(()=>({
      viewport:window.innerWidth,
      scroll:document.documentElement.scrollWidth
    }));
    assert.ok(dimensions.scroll<=dimensions.viewport+3,
      engineName+" mobile horizontal overflow on "+url+" "+JSON.stringify(dimensions));
  }
  await captureVisual(mobile,"mobile-hero");
  // Keyboard Escape closes the mobile menu and returns focus to its trigger.
  await mobile.locator("#menuBtn").click();
  assert.equal(await mobile.locator("#menuBtn").getAttribute("aria-expanded"),"true");
  await mobile.keyboard.press("Escape");
  assert.equal(await mobile.locator("#menuBtn").getAttribute("aria-expanded"),"false");
  assert.equal(await mobile.evaluate(()=>document.activeElement?.id),"menuBtn");
  assert.equal(await mobile.evaluate(()=>document.body.classList.contains("menu-open")),false);
  await mobile.locator("#menuBtn").click();
  assert.equal(await mobile.locator("#menuBtn").getAttribute("aria-expanded"),"true");
  await mobile.locator(".mobile-nav a[href='#servicios']").click();
  assert.equal(await mobile.locator("#menuBtn").getAttribute("aria-expanded"),"false");
  for(const width of [320,390]) {
    await mobile.setViewportSize({width,height:844});
    const dimensions=await mobile.evaluate(()=>({viewport:window.innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(dimensions.scroll<=dimensions.viewport+3,
      engineName+" narrow overflow at "+width+"px "+JSON.stringify(dimensions));
  }
  const tablet=await browser.newPage({viewport:{width:850,height:850},reducedMotion:"reduce"});
  tablet.on("pageerror",describe);
  await tablet.goto(base+"/",{waitUntil:"load"});
  assert.equal(await tablet.locator(".study-card").count(),3);
  assert.equal(await tablet.locator('[data-case-id="bodytone"]').evaluate(el=>getComputedStyle(el).gridColumnEnd),"-1");
  await tablet.locator("#menuBtn").click();
  assert.equal(await tablet.locator("#menuBtn").getAttribute("aria-expanded"),"true");
  await tablet.setViewportSize({width:1024,height:850});
  // matchMedia("change") is dispatched asynchronously: wait for the real UI state.
  await tablet.waitForFunction(() => {
    const button=document.querySelector("#menuBtn");
    return button?.getAttribute("aria-expanded")==="false" &&
      !document.body.classList.contains("menu-open");
  },null,{timeout:5000});
  assert.equal(await tablet.locator("#menuBtn").getAttribute("aria-expanded"),"false");
  assert.equal(await tablet.evaluate(()=>document.body.classList.contains("menu-open")),false);
  await tablet.close();
  assert.deepEqual(errors,[],"Mobile runtime errors");
  console.log("BROWSER SMOKE PASS ("+engineName+"): V40 demo, dark/light, business, contact failure/success, and mobile");
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
