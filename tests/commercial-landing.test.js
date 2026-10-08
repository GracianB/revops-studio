import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../assets/js/app.js", import.meta.url), "utf8");
const thanks = readFileSync(new URL("../gracias.html", import.meta.url), "utf8");

test("landing: problems, services, pricing and contact precede the lab", () => {
  const names = ["problemas", "servicios", "oferta", "casos", "proceso", "contacto", "playground"];
  const offsets = names.map(id => index.indexOf('id="' + id + '"'));
  assert.ok(offsets.every(offset => offset >= 0), "missing commercial section");
  for (let i = 1; i < offsets.length; i++) assert.ok(offsets[i] > offsets[i - 1], names[i] + " is out of order");
});

test("landing: main contact call-to-action points to the brief", () => {
  assert.match(index, /class="btn btn-primary" href="#contacto">Cuéntame qué necesitas/);
  assert.match(index, /id="briefForm"/);
  assert.match(index, /no envía nada automáticamente/);
});

test("landing: filtering offers understandable services", () => {
  for (const filter of ["all", "automation", "data", "apps", "ai"]) {
    assert.ok(index.includes('data-filter="' + filter + '"'));
  }
  assert.equal((index.match(/class="service-card reveal"/g) || []).length, 6);
});

test("lab: advanced V40 remains available behind a disclosure", () => {
  const details = index.indexOf('id="labDisclosure"');
  const control = index.indexOf('class="control-room"');
  assert.ok(details !== -1 && control > details);
  assert.match(index, /La? demo local|datos sintéticos/);
  assert.ok(app.includes('disclosure.addEventListener("toggle", activate)'));
  assert.ok(app.includes("initPlayground();"));
  assert.equal(app.trimEnd().endsWith("initPlayground();"), false, "eager lab init reintroduced");
});

test("conversion: thanks page does not imply a sent lead", () => {
  assert.match(thanks, /La solicitud todavía no se ha enviado/);
  assert.match(thanks, /Abrir email preparado/);
});

test("navigation: all internal hash links reference an existing id", () => {
  const ids = new Set([...index.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const duplicates = [...index.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]).filter((id, i, all) => all.indexOf(id) !== i);
  assert.deepEqual(duplicates, []);
  for (const href of index.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(href[1]), "missing " + href[1]);
});
