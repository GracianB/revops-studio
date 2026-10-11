import test from "node:test";
import assert from "node:assert/strict";
import { buildDiagnosticReport } from "../assets/js/diagnostic-report.js";
import { PROBLEMS, TOOLS, SCOPES, buildDiagnostic } from "../assets/js/diagnostic.js";

test("R1 produces a self-contained, Spanish, printable action plan for every supported route", () => {
  for (const problem of Object.keys(PROBLEMS)) {
    for (const tools of Object.keys(TOOLS)) {
      for (const scope of Object.keys(SCOPES)) {
        const report = buildDiagnosticReport(problem, tools, scope);
        const diagnostic = buildDiagnostic(problem, tools, scope);
        assert.ok(report);
        assert.equal(report.phases.length, 3);
        assert.equal(report.service, diagnostic.service);
        assert.equal(report.filename, "revops-plan-" + problem + "-" + scope + ".html");
        assert.match(report.html, /<!doctype html>/);
        assert.match(report.html, /<html lang="es">/);
        assert.match(report.html, /@media print/);
        assert.match(report.html, /04 · Cómo aceptar el piloto/);
        assert.match(report.html, /Riesgos y supuestos/);
        assert.match(report.html, /Preguntas antes de presupuestar/);
        assert.ok(report.html.includes(diagnostic.packageType));
        assert.ok(report.html.includes(diagnostic.deliverable));
        assert.doesNotMatch(report.html, /undefined|NaN|<script|<iframe/i);
      }
    }
  }
});

test("R1 is deterministic and requires a selected supported problem", () => {
  assert.equal(buildDiagnosticReport(""), null);
  assert.equal(buildDiagnosticReport("__other__"), null);
  const left = buildDiagnosticReport("repetitive", "mixed", "cross");
  const right = buildDiagnosticReport("repetitive", "mixed", "cross");
  assert.equal(left.html, right.html);
  assert.equal(left.filename, right.filename);
  assert.match(left.html, /distintos/);
  assert.match(left.html, /responsables y criterios comunes/);
  assert.match(left.html, /4\.000 €/);
});

test("R1 normalizes unfamiliar tools and scope to catalog choices; no arbitrary text is interpolated", () => {
  const report = buildDiagnosticReport("knowledge", '<script>alert("x")</script>', "<img src=x>");
  assert.ok(report);
  assert.match(report.html, /Aún no lo tengo claro/);
  assert.match(report.html, /Un equipo/);
  assert.equal(report.filename, "revops-plan-knowledge-team.html");
  assert.doesNotMatch(report.html, /alert\(|<img|src=x|<script/i);
});

test("R1 is an offline advisory document, not a client-data export, checkout or contractual quote", () => {
  const report = buildDiagnosticReport("rules", "crm", "team");
  assert.match(report.html, /No incorpora información personal/);
  assert.match(report.html, /no ejecuta operaciones en CRM/);
  assert.match(report.html, /no constituye contrato ni presupuesto vinculante/i);
  assert.match(report.html, /permisos/i);
  assert.match(report.html, /900 €|4\.000 €/);
  assert.doesNotMatch(report.html, /https?:\/\/|fetch\(|<form|localStorage|sessionStorage|FormSubmit|Plausible|<script/i);
  assert.ok(report.html.length > 3000);
  assert.ok(report.html.length < 30000);
});
