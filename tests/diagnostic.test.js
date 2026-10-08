import test from "node:test";
import assert from "node:assert/strict";
import { buildDiagnostic, PROBLEMS } from "../assets/js/diagnostic.js";

test("does not invent a recommendation before selecting a real problem",()=>{
  assert.equal(buildDiagnostic(""),null);
  assert.equal(buildDiagnostic("__invalid__"),null);
});

test("four distinct customer problems yield their own route and practical verification",()=>{
  const expected={
    repetitive:"Automatización",
    reporting:"Datos y BI",
    knowledge:"Software a medida",
    rules:"Software a medida"
  };
  for(const [problem,service] of Object.entries(expected)){
    const result=buildDiagnostic(problem,"sheets","team");
    assert.equal(result.service,service);
    assert.ok(result.deliverable.length>35);
    assert.ok(result.verification.length>35);
    assert.match(result.summary,/Primer entregable:/);
    assert.match(result.summary,/Cómo validarlo:/);
    assert.equal(result.problem,PROBLEMS[problem].label);
  }
});

test("cross-team or mixed systems recommend scoped projects instead of guaranteed quotes",()=>{
  for(const [tool,scope] of [["mixed","single"],["sheets","cross"],["unknown","cross"]]){
    const result=buildDiagnostic("repetitive",tool,scope);
    assert.equal(result.packageType,"Sistema a medida");
    assert.match(result.packageNote,/desde 4\.000 €/);
    assert.match(result.packageNote,/sujeto a diagnóstico/);
  }
  const small=buildDiagnostic("reporting","sheets","single");
  assert.equal(small.packageType,"Quick win");
  assert.match(small.packageNote,/desde 900 €/);
});

test("unknown selection values fall back to safe labels rather than injecting arbitrary text",()=>{
  const item=buildDiagnostic("knowledge","<script>","<img>");
  assert.equal(item.tools,"Aún no lo tengo claro");
  assert.equal(item.scope,"Un equipo");
  assert.doesNotMatch(item.summary,/<script|<img/);
});

test("generated brief is a clear multiline, non-binding handoff with no user data",()=>{
  const summary=buildDiagnostic("rules","crm","team").summary;
  assert.equal(summary.split("\n").length,8);
  assert.match(summary,/Revisar campos, permisos/);
  assert.match(summary,/Prototipo/);
  assert.doesNotMatch(summary,/contraseña|email|persona identificada/i);
});
