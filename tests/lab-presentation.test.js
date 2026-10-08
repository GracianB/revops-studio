import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../assets/css/main.css", import.meta.url), "utf8");
const lab = readFileSync(new URL("../laboratorio.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../assets/js/app.js", import.meta.url), "utf8");

function balancedCssBraces(source) {
  let state = "normal";
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (state === "comment") { if (c === "*" && next === "/") { state = "normal"; i++; } continue; }
    if (state === "single" || state === "double") {
      if (c === "\\") { i++; continue; }
      if (c === (state === "single" ? "'" : '"')) state = "normal";
      continue;
    }
    if (c === "/" && next === "*") { state = "comment"; i++; continue; }
    if (c === "'") { state = "single"; continue; }
    if (c === '"') { state = "double"; continue; }
    if (c === "{") depth++;
    if (c === "}") { depth--; assert.ok(depth >= 0, "extra closing brace near position " + i); }
  }
  assert.equal(depth, 0, "unclosed CSS block: later rules may be ignored by browsers");
  assert.equal(state, "normal", "unclosed CSS quote or comment");
}

test("CSS block integrity: no unclosed media query can hide whole lab sections", () => {
  balancedCssBraces(css);
  assert.match(css, /\.execution-ledger-metrics\{grid-template-columns:repeat\(3,1fr\)\}/);
});

test("Lab: V20–V32 controls live in a clearly marked advanced area", () => {
  assert.match(lab, /id="advancedWorkbench"/);
  assert.match(lab, /Calibración V20:/);
  assert.match(lab, /Políticas V25:/);
  assert.match(lab, /Firmas y confianza V27–V32:/);
  assert.ok(lab.indexOf('id="advancedWorkbench"') < lab.indexOf('id="calibration-v20-title"'));
  assert.ok(lab.indexOf('</details>') > lab.indexOf('id="policy-decision-certificate-title"'));
});

test("Trust pins: both verification paths accept whitespace and commas", () => {
  const expressions = app.match(/\.split\(\/\[,\\s\]\+\/\)/g) || [];
  assert.equal(expressions.length, 2);
  assert.doesNotMatch(app, /\.split\(\/\[,s\]\+\/\)/);
});

test("Lab: safe, explicit instructions about required observations and no external execution", () => {
  assert.match(lab, /INSUFFICIENT/);
  assert.match(lab, /No hace:/);
  assert.match(lab, /no ejecutan acciones empresariales/);
  assert.match(app, /initAdvancedWorkbench/);
});
