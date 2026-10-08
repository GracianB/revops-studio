// V47: live HTTPS/browser observability, not field Core Web Vitals or Lighthouse.
// The CI runner is a single synthetic observer, so timings are descriptive rather than release gates.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const SITE="https://gracianb.github.io/revops-studio/";
const ORIGIN=new URL(SITE).origin;
const root=process.cwd();
const output=path.join(root,".ci-artifacts");
const assetPaths=["assets/css/commercial.css","assets/js/site.js","assets/js/theme.js","assets/js/contact-response.js"];
const profiles=[
  {name:"desktop",width:1366,height:840,mobile:false},
  {name:"mobile",width:390,height:844,mobile:true}
];
const runsPerProfile=3;
const sha256=bytes=>createHash("sha256").update(bytes).digest("hex");
const median=values=>{
  const sorted=values.filter(x=>typeof x==="number"&&Number.isFinite(x)).sort((a,b)=>a-b);
  return sorted.length?sorted[Math.floor(sorted.length/2)]:null;
};
const report={
  schema:1,kind:"synthetic production audit",url:SITE,
  source:"GitHub Actions Chrome in a hosted runner, via public GitHub Pages HTTPS",
  measuredAt:new Date().toISOString(),samplesPerProfile:runsPerProfile,
  methodology:{
    cache:"disabled; independent incognito context per cold navigation",
    throttling:"none (runner's real network/CPU, which varies)",
    thirdParties:"not stubbed; counted separately, failures reported as warnings",
    content:"GET only; no FormSubmit submission or private data",
    fieldData:"unavailable: browser CI samples are not Chrome UX Report or real-user monitoring",
    action:"functional and asset-integrity checks fail; timing outliers are reported, never automatically interpreted as regressions"
  },
  assets:[],profiles:[],warnings:[]
};
mkdirSync(output,{recursive:true});
let browser;
try{
  browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  const request=await browser.newContext({ignoreHTTPSErrors:false});
  try{
    // Compare the *deployed* CSS/JS to checkout. A successful Pages job does not imply the CDN has the right revision.
    for(const asset of assetPaths){
      const expected=await readFile(path.join(root,asset));
      const response=await request.request.get(new URL(asset,SITE).href,{timeout:30000});
      assert.equal(response.status(),200,"deployed resource HTTP status "+asset);
      const received=await response.body();
      const actualHash=sha256(received),expectedHash=sha256(expected);
      report.assets.push({path:asset,httpStatus:response.status(),bytes:received.length,
        matchesMain:actualHash===expectedHash,sha256:actualHash});
      assert.equal(actualHash,expectedHash,"deployed asset differs from checked-out main: "+asset);
    }
  }finally{await request.close();}

  for(const profile of profiles){
    const attempts=[];
    for(let i=0;i<runsPerProfile;i++){
      const context=await browser.newContext({
        viewport:{width:profile.width,height:profile.height},
        isMobile:profile.mobile,hasTouch:profile.mobile,reducedMotion:"reduce",
        serviceWorkers:"block",acceptDownloads:false
      });
      const page=await context.newPage();
      const cdp=await context.newCDPSession(page);
      const resources=new Map();
      const browserErrors=[], thirdPartyFailures=[];
      page.on("pageerror",error=>browserErrors.push(String(error.message)));
      page.on("requestfailed",req=>{
        const url=req.url();
        if(url.startsWith(ORIGIN+"/"))browserErrors.push("Failed first-party resource "+url+" "+req.failure()?.errorText);
        else thirdPartyFailures.push({host:new URL(url).hostname,error:req.failure()?.errorText||"failed"});
      });
      try{
        await page.addInitScript(()=>{
          window.__v47={lcp:null,cls:0};
          try{new PerformanceObserver(list=>{
            for(const entry of list.getEntries())window.__v47.lcp=entry.startTime;
          }).observe({type:"largest-contentful-paint",buffered:true});}catch{}
          try{new PerformanceObserver(list=>{
            for(const entry of list.getEntries())if(!entry.hadRecentInput)window.__v47.cls+=entry.value;
          }).observe({type:"layout-shift",buffered:true});}catch{}
        });
        cdp.on("Network.requestWillBeSent",event=>{
          try{
            const url=new URL(event.request.url);
            if(!["http:","https:"].includes(url.protocol))return;
            resources.set(event.requestId,{host:url.hostname,path:url.pathname,
              firstParty:url.origin===ORIGIN,bytes:0,status:null,cached:false});
          }catch{}
        });
        cdp.on("Network.responseReceived",event=>{
          const item=resources.get(event.requestId);
          if(item){item.status=event.response.status;
            item.cached=Boolean(event.response.fromDiskCache||event.response.fromServiceWorker);}
        });
        cdp.on("Network.loadingFinished",event=>{
          const item=resources.get(event.requestId);
          if(item)item.bytes=event.encodedDataLength;
        });
        await cdp.send("Network.enable");
        await cdp.send("Network.setCacheDisabled",{cacheDisabled:true});
        const response=await page.goto(SITE,{waitUntil:"domcontentloaded",timeout:40000});
        assert.equal(response?.status(),200,"public home unavailable");
        await page.locator("#hero-title").waitFor({state:"visible",timeout:10000});
        await page.waitForLoadState("load",{timeout:15000}).catch(()=>{});
        await page.waitForTimeout(650); // deliver LCP and layout-shift observers after first paint
        const metrics=await page.evaluate(()=>{
          const nav=performance.getEntriesByType("navigation")[0];
          const fcp=performance.getEntriesByType("paint").find(x=>x.name==="first-contentful-paint");
          const hero=document.querySelector("#hero-title"),styles=document.querySelector("link[rel=stylesheet]");
          const css=hero?getComputedStyle(hero):null;
          return {
            ttfbMs:nav?Math.round(nav.responseStart):null,
            dclMs:nav?Math.round(nav.domContentLoadedEventEnd):null,
            loadMs:nav?Math.round(nav.loadEventEnd):null,
            fcpMs:fcp?Math.round(fcp.startTime):null,
            lcpMs:window.__v47?.lcp==null?null:Math.round(window.__v47.lcp),
            cls:Number((window.__v47?.cls||0).toFixed(4)),
            heroVisible:Boolean(hero&&hero.getBoundingClientRect().width>0),
            stylesheet:styles?.getAttribute("href")||null,
            fontSize:css?.fontSize||null,
            cards:document.querySelectorAll(".service-card:not([hidden])").length,
            overflowPx:Math.max(0,document.documentElement.scrollWidth-innerWidth),
            title:document.title
          };
        });
        const entries=[...resources.values()];
        const firstParty=entries.filter(e=>e.firstParty);
        const thirdParty=entries.filter(e=>!e.firstParty);
        const sample={
          sequence:i+1,metrics,
          transfer:{
            firstPartyBytes:firstParty.reduce((n,e)=>n+e.bytes,0),
            firstPartyRequests:firstParty.length,
            thirdPartyBytes:thirdParty.reduce((n,e)=>n+e.bytes,0),
            thirdPartyRequests:thirdParty.length
          },
          firstParty:firstParty.map(e=>({path:e.path,status:e.status,bytes:e.bytes,cached:e.cached})),
          thirdParty:thirdParty.map(e=>({host:e.host,status:e.status,bytes:e.bytes})),
          runtimeErrors:browserErrors,thirdPartyFailures
        };
        attempts.push(sample);
        assert.equal(metrics.heroVisible,true,"hero not visible");
        assert.equal(metrics.cards,6,"expected six unfiltered service cards");
        assert.match(metrics.stylesheet||"",/assets\/css\/commercial\.css/);
        assert.ok(metrics.fontSize && metrics.fontSize!=="0px","CSS not applied");
        assert.ok(metrics.overflowPx<=3,"mobile horizontal overflow");
        assert.ok(metrics.fcpMs!==null && metrics.fcpMs>0,"no First Contentful Paint recorded");
        assert.deepEqual(browserErrors,[],"production script or first-party resource errors");
        for(const asset of ["/revops-studio/assets/css/commercial.css",
          "/revops-studio/assets/js/site.js","/revops-studio/assets/js/theme.js",
          "/revops-studio/assets/js/contact-response.js"]){
          assert.ok(firstParty.some(e=>e.path===asset&&e.status===200),
            "missing successful production request "+asset);
        }
        assert.ok(!firstParty.some(e=>/\/assets\/(css\/main\.css|js\/app\.js)/.test(e.path)),
          "V40 assets leaked to commercial home");
        if(metrics.cls>0.12)report.warnings.push({profile:profile.name,run:i+1,kind:"layout shift",value:metrics.cls});
        if(metrics.lcpMs!==null&&metrics.lcpMs>4000)report.warnings.push({profile:profile.name,run:i+1,kind:"slow LCP sample",value:metrics.lcpMs});
        if(thirdPartyFailures.length)report.warnings.push({
          profile:profile.name,run:i+1,kind:"third-party failure",count:thirdPartyFailures.length
        });
        console.log("LIVE_SAMPLE "+JSON.stringify({profile:profile.name,run:i+1,
          ttfbMs:metrics.ttfbMs,fcpMs:metrics.fcpMs,lcpMs:metrics.lcpMs,
          cls:metrics.cls,firstPartyBytes:sample.transfer.firstPartyBytes,
          thirdPartyRequests:sample.transfer.thirdPartyRequests}));
        if(i===0){
          await page.screenshot({path:path.join(output,"live-v47-"+profile.name+".png"),
            animations:"disabled",fullPage:false});
        }
      }finally{await context.close();}
    }
    const summary={name:profile.name,viewport:{width:profile.width,height:profile.height},
      attempts,median:{
        ttfbMs:median(attempts.map(a=>a.metrics.ttfbMs)),
        fcpMs:median(attempts.map(a=>a.metrics.fcpMs)),
        lcpMs:median(attempts.map(a=>a.metrics.lcpMs)),
        cls:median(attempts.map(a=>a.metrics.cls)),
        firstPartyBytes:median(attempts.map(a=>a.transfer.firstPartyBytes))
      }};
    report.profiles.push(summary);
    console.log("LIVE_MEDIAN "+JSON.stringify({profile:profile.name,...summary.median}));
  }
  console.log("LIVE_AUDIT PASS: deployed files match checkout; browser renders desktop/mobile; "+report.warnings.length+" warnings");
}finally{
  writeFileSync(path.join(output,"live-v47.json"),JSON.stringify(report,null,2)+"\n");
  if(browser)await browser.close();
}
