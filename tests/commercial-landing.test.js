import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const index = readFileSync(new URL("../index.html",import.meta.url),"utf8");
const lab = readFileSync(new URL("../laboratorio.html",import.meta.url),"utf8");
const site = readFileSync(new URL("../assets/js/site.js",import.meta.url),"utf8");
const app = readFileSync(new URL("../assets/js/app.js",import.meta.url),"utf8");
const thanks = readFileSync(new URL("../gracias.html",import.meta.url),"utf8");
const thanksJs = readFileSync(new URL("../assets/js/thanks.js",import.meta.url),"utf8");

test("commercial journey prioritises problems, services, prices, cases and contact", () => {
  const sections = ["problemas","servicios","oferta","casos","proceso","contacto","playground"];
  const positions = sections.map(id => index.indexOf('id="'+id+'"'));
  assert.ok(positions.every(n => n >= 0));
  for (let i=1;i<positions.length;i++) assert.ok(positions[i]>positions[i-1],sections[i]+" out of order");
});

test("hero and direct contact have understandable commercial CTA",()=>{
  assert.match(index,/class="btn btn-primary" href="#contacto">Cuéntame qué necesitas/);
  assert.match(index,/id="briefForm"/);
  assert.match(index,/no envía nada automáticamente/);
});

test("services include six concrete solutions and accessible filters",()=>{
  assert.equal((index.match(/class="service-card reveal"/g)||[]).length,6);
  for (const filter of ["all","automation","data","apps","ai"])
    assert.ok(index.includes('data-filter="'+filter+'"'));
});

test("proof includes grounded public and private case study links",()=>{
  assert.match(index,/proyecto-bodytone\.html/);
  assert.match(index,/proyecto-outreach\.html/);
  assert.match(index,/proyecto-calculadora\.html/);
  assert.match(index,/bodytonehelp\.zendesk\.com/);
  assert.match(index,/Lógica privada/);
  assert.match(index,/Sistema privado/);
  assert.match(index,/No atribuyo porcentajes de ahorro/);
});

test("business landing does not import V40 application",()=>{
  assert.match(index,/src="\.\/assets\/js\/site\.js"/);
  assert.doesNotMatch(index,/src="\.\/assets\/js\/app\.js"/);
  assert.match(index,/href="\.\/laboratorio\.html"/);
  assert.ok(site.length < 14000);
  assert.doesNotMatch(site,/from "\.\/revops-engine|from "\.\/policy/);
});

test("separate V40 lab keeps data, control room and guided tour",()=>{
  assert.match(lab,/src="\.\/assets\/js\/app\.js"/);
  assert.match(lab,/class="control-room"/);
  assert.match(lab,/datos sintéticos/);
  assert.match(lab,/id="demoRows"/);
  assert.match(app,/initPlayground\(\)/);
  assert.deepEqual([...lab.matchAll(/data-guided-step="(\d+)"/g)].map(m=>Number(m[1])),[0,1,2,3]);
});

test("commerce selects the service and handles storage denial without data loss",()=>{
  assert.match(index,/id="servicio" name="servicio"/);
  for (const value of ["Quick win","Sistema a medida","Soporte y evolución"]) {
    assert.ok(index.includes('data-service-choice="'+value+'"'));
  }
  assert.match(site,/initServiceChoice/);
  assert.match(site,/sessionStorage\.setItem/);
  assert.match(site,/catch \{/);
  assert.match(site,/Revisar correo preparado/);
  assert.match(site,/servicio: String\(data\.servicio/);
  assert.match(thanksJs,/Servicio: /);
});

test("thanks page does not imply the message has already been sent",()=>{
  assert.match(thanks,/La solicitud todavía no se ha enviado/);
  assert.match(thanks,/Abrir email preparado/);
});

test("all internal hash links resolve within their own page",()=>{
  for (const [name,page] of [["landing",index],["lab",lab]]) {
    const ids=[...page.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(ids.length,new Set(ids).size,name+" duplicates ids");
    for (const m of page.matchAll(/href="#([^"]+)"/g)) {
      assert.ok(ids.includes(m[1]),name+" missing anchor "+m[1]);
    }
  }
});

test("legacy shared configuration hashes are forwarded to the isolated lab",()=>{
  assert.match(site,/window\.location\.hash\.startsWith\("#config="\)/);
  assert.match(site,/window\.location\.replace\("\.\/laboratorio\.html" \+ window\.location\.hash\)/);
});
