// V46 synthetic network/CPU audit for the commercial landing.
// This is a controlled CI contract, not a claim about real-world Core Web Vitals.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const root = process.cwd();
const mime = {".html":"text/html",".js":"text/javascript",".css":"text/css",".svg":"image/svg+xml"};
const server=createServer(async(req,res)=>{
  try{
    const route=new URL(req.url,"http://localhost");
    const relative=decodeURIComponent(route.pathname.replace(/^\/+/,""))||"index.html";
    const filepath=path.resolve(root,relative);
    if(!filepath.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const body=await readFile(filepath);
    res.writeHead(200,{"Content-Type":(mime[path.extname(filepath)]||"text/plain")+"; charset=utf-8",
      "Content-Length":body.length,"Cache-Control":"no-store"});
    res.end(body);
  }catch{res.writeHead(404);res.end("Not found");}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const base="http://127.0.0.1:"+server.address().port;

// Throughputs are bytes per second, not bits. Thresholds intentionally allow runner variance.
const profiles=[
  {name:"desktop-4g",width:1366,height:850,latencyMs:100,downloadBps:210000,uploadBps:105000,
    cpuSlowdown:1,maxFcpMs:8500,maxLcpMs:12500,maxCls:0.12},
  {name:"mobile-3g",width:390,height:844,latencyMs:250,downloadBps:95000,uploadBps:45000,
    cpuSlowdown:4,maxFcpMs:14000,maxLcpMs:19000,maxCls:0.12}
];
const budget={maxFirstPartyBytes:130000,maxFirstPartyRequests:9};
const checks=[];
let browser;
try{
  browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  for(const profile of profiles){
    const page=await browser.newPage({viewport:{width:profile.width,height:profile.height},
      reducedMotion:"reduce",serviceWorkers:"block"});
    const cdp=await page.context().newCDPSession(page);
    const requests=new Map();
    try{
      // CI never contacts an external measurement provider; local HTML/CSS/JS are real.
      await page.route("**/*",route=>{
        const url=new URL(route.request().url());
        if(url.hostname==="127.0.0.1")return route.continue();
        return route.fulfill({status:200,contentType:"text/javascript",body:"/* CI: third-party disabled */"});
      });
      await page.addInitScript(()=>{
        window.__revopsVitals={lcp:null,cls:0};
        if(!("PerformanceObserver" in window))return;
        try{
          new PerformanceObserver(list=>{
            for(const e of list.getEntries())window.__revopsVitals.lcp=e.startTime;
          }).observe({type:"largest-contentful-paint",buffered:true});
        }catch{}
        try{
          new PerformanceObserver(list=>{
            for(const e of list.getEntries())if(!e.hadRecentInput)window.__revopsVitals.cls+=e.value;
          }).observe({type:"layout-shift",buffered:true});
        }catch{}
      });
      cdp.on("Network.requestWillBeSent",event=>{
        if(!event.request.url.startsWith(base))return;
        const url=new URL(event.request.url);
        requests.set(event.requestId,{path:url.pathname==="/"?"/index.html":url.pathname,bytes:0});
      });
      cdp.on("Network.loadingFinished",event=>{
        const entry=requests.get(event.requestId);
        if(entry)entry.bytes=event.encodedDataLength;
      });
      cdp.on("Network.loadingFailed",event=>{
        const entry=requests.get(event.requestId);
        if(entry)entry.failed=event.errorText||"failed";
      });
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled",{cacheDisabled:true});
      await cdp.send("Network.emulateNetworkConditions",{
        offline:false,latency:profile.latencyMs,downloadThroughput:profile.downloadBps,
        uploadThroughput:profile.uploadBps
      });
      await cdp.send("Emulation.setCPUThrottlingRate",{rate:profile.cpuSlowdown});
      const response=await page.goto(base+"/",{waitUntil:"load",timeout:30000});
      assert.equal(response.status(),200);
      await page.locator("#annualCost").waitFor({state:"attached"});
      await page.waitForTimeout(450); // allow paint/layout observers to deliver buffered data
      const performance=await page.evaluate(()=>{
        const nav=performance.getEntriesByType("navigation")[0];
        const paint=performance.getEntriesByType("paint");
        const fcp=paint.find(entry=>entry.name==="first-contentful-paint");
        return {
          domContentLoadedMs:Math.round(nav?.domContentLoadedEventEnd||0),
          loadMs:Math.round(nav?.loadEventEnd||0),
          fcpMs:fcp?Math.round(fcp.startTime):null,
          lcpMs:window.__revopsVitals.lcp===null?null:Math.round(window.__revopsVitals.lcp),
          cls:Number(window.__revopsVitals.cls.toFixed(4)),
          visualChecks:{
            heading:!!document.querySelector("#hero-title")?.getBoundingClientRect().width,
            cards:document.querySelectorAll(".service-card:not([hidden])").length,
            calculator:document.querySelector("#annualCost")?.textContent?.trim()||"",
            horizontalOverflow:document.documentElement.scrollWidth>innerWidth+3
          }
        };
      });
      const entries=[...requests.values()].sort((a,b)=>a.path.localeCompare(b.path));
      const bytes=entries.reduce((sum,e)=>sum+e.bytes,0);
      const paths=entries.map(e=>e.path);
      const result={profile:profile.name,network:{
        latencyMs:profile.latencyMs,downloadKbps:Math.round(profile.downloadBps*8/1000),
        uploadKbps:Math.round(profile.uploadBps*8/1000),cpuSlowdown:profile.cpuSlowdown
      },bytes,requests:entries.length,performance,resources:entries};
      checks.push(result);
      assert.ok(entries.every(e=>!e.failed),profile.name+": failed first-party resource");
      assert.ok(bytes>90000,profile.name+": missing first-party transfer measurements");
      assert.ok(bytes<=budget.maxFirstPartyBytes,profile.name+": first-party transfer budget "+bytes);
      assert.ok(entries.length<=budget.maxFirstPartyRequests,profile.name+": request count "+entries.length);
      for(const necessary of ["/index.html","/assets/css/commercial.css","/assets/js/site.js","/assets/js/theme.js","/assets/js/contact-response.js"]){
        assert.ok(paths.includes(necessary),profile.name+": missing "+necessary);
      }
      for(const forbidden of ["/assets/css/main.css","/assets/js/app.js","/laboratorio.html"]){
        assert.ok(!paths.includes(forbidden),profile.name+": V40 asset leaked "+forbidden);
      }
      assert.equal(performance.visualChecks.heading,true,profile.name+": hero missing");
      assert.equal(performance.visualChecks.cards,6,profile.name+": services missing");
      assert.equal(performance.visualChecks.horizontalOverflow,false,profile.name+": horizontal overflow");
      assert.ok(performance.visualChecks.calculator.includes("€"),profile.name+": calculator not initialized");
      assert.ok(performance.fcpMs!==null&&performance.fcpMs>0,profile.name+": FCP not measured");
      assert.ok(performance.fcpMs<=profile.maxFcpMs,profile.name+": FCP budget exceeded "+performance.fcpMs);
      if(performance.lcpMs!==null)assert.ok(performance.lcpMs<=profile.maxLcpMs,profile.name+": LCP budget exceeded "+performance.lcpMs);
      assert.ok(performance.cls<=profile.maxCls,profile.name+": CLS budget exceeded "+performance.cls);
      console.log("PERF_PROFILE PASS "+JSON.stringify({
        profile:profile.name,bytes,requests:entries.length,fcpMs:performance.fcpMs,
        lcpMs:performance.lcpMs,cls:performance.cls,loadMs:performance.loadMs
      }));
    }finally{
      await page.close();
    }
  }
  mkdirSync(path.join(root,".ci-artifacts"),{recursive:true});
  writeFileSync(path.join(root,".ci-artifacts/performance-v46.json"),
    JSON.stringify({schema:1,source:"CI local HTTP on Chromium; third parties stubbed; synthetic throttling",
      thresholds:budget,results:checks},null,2)+"\n");
  console.log("PERFORMANCE BUDGET PASS: "+checks.length+" throttled profiles; artifact .ci-artifacts/performance-v46.json");
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
