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

try {
  browser=await browserEngine.launch(engineName==="chrome"?
    {channel:"chrome",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]}:
    {headless:true});
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
  await page.locator('[data-filter="ai"]').click();
  assert.ok(await page.locator(".service-card:visible").count()>=1);

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
  assert.deepEqual(errors,[],"Desktop runtime errors");

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
  await mobile.locator("#menuBtn").click();
  assert.equal(await mobile.locator("#menuBtn").getAttribute("aria-expanded"),"true");
  await mobile.locator(".mobile-nav a[href='#servicios']").click();
  assert.equal(await mobile.locator("#menuBtn").getAttribute("aria-expanded"),"false");
  assert.deepEqual(errors,[],"Mobile runtime errors");
  console.log("BROWSER SMOKE PASS ("+engineName+"): V40 demo, dark/light, business, contact failure/success, and mobile");
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
