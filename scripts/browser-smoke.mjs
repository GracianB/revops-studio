import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

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
const errors=[];
let browser;
try {
  browser = await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  const page = await browser.newPage({viewport:{width:1366,height:840},reducedMotion:"reduce"});
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{ if(m.type()==="error") console.log("CHROME_CONSOLE_ERROR:",m.text()); });
  page.on("response",response=>{ if(response.status()>=400) console.log("HTTP_RESPONSE_ERROR:",response.status(),response.url()); });
  await page.goto(base + "/laboratorio.html",{waitUntil:"load"});
  await page.waitForTimeout(1200);
  console.log("LAB_DIAGNOSTIC:",JSON.stringify(await page.evaluate(()=>({
    documentReady:document.readyState,
    rows:document.querySelectorAll("#demoRows tr").length,
    rowContainer:document.getElementById("demoRows")?.outerHTML.slice(0,600),
    runState:document.querySelector("#lastRun")?.textContent,
    bodyScrollWidth:document.documentElement.scrollWidth,
    scripts:[...document.scripts].map(s=>s.src)
  }))));
  console.log("LAB_PAGE_ERRORS:",JSON.stringify(errors));
  await page.locator("#demoRows tr").first().waitFor({state:"attached",timeout:5000});
  assert.equal(await page.locator("#demoRows tr").count()>0,true,"demo has no pipeline rows");
  assert.equal(await page.locator("#advancedWorkbench").evaluate(el=>el.open),false,"advanced workbench must start closed");
  await page.locator("#runDemo").click();
  await page.locator("#guidedNext").click();
  assert.match(await page.locator("#guidedProgress").innerText(),/02 \/ 04/);
  await page.locator("#advancedWorkbench summary").click();
  assert.equal(await page.locator("#advancedWorkbench").evaluate(el=>el.open),true);
  assert.equal(await page.locator("#calibration-v20-title").isVisible(),true);
  const feedbackDisplay = await page.locator("#calibration-v20-title").evaluate(el=>getComputedStyle(el.closest(".feedback-panel")).borderTopStyle);
  assert.equal(feedbackDisplay,"solid","feedback panel missing its CSS styling");
  const metricsDisplay = await page.locator("#calibrationV20Severity").evaluate(el=>getComputedStyle(el.closest(".feedback-metrics")).display);
  assert.equal(metricsDisplay,"grid","feedback metrics not laid out in a grid");
  await page.locator("#resetCalibrationV20").click();
  await page.locator("#generatePolicySignerV27").click();
  assert.equal(errors.length,0,"JavaScript runtime errors: " + errors.join(" | "));
  await page.goto(base + "/",{waitUntil:"load"});
  await page.locator('.service-card').first().waitFor({timeout:10000});
  assert.equal(await page.locator('.study-card').count(),3);
  await page.locator('[data-filter="ai"]').click();
  assert.ok(await page.locator('.service-card:visible').count()>=1,"service filter hid all AI services");
  assert.equal(errors.length,0,"Landing JavaScript errors: " + errors.join(" | "));
  const mobile = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:"reduce"});
  mobile.on("pageerror",e=>errors.push(e.message));
  await mobile.goto(base + "/laboratorio.html",{waitUntil:"load"});
  await mobile.locator("#demoRows tr").first().waitFor({timeout:20000});
  await mobile.locator("#advancedWorkbench summary").click();
  const dimensions = await mobile.evaluate(()=>({viewport:window.innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(dimensions.scroll<=dimensions.viewport+3,"mobile horizontal overflow "+JSON.stringify(dimensions));
  assert.equal(errors.length,0,"Mobile JavaScript errors: " + errors.join(" | "));
  console.log("BROWSER SMOKE PASS: desktop lab, CSS, run, guided tour, advanced controls, commercial page, mobile");
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
