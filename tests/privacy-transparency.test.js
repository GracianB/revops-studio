import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("analytics on the commercial home page is disclosed in the privacy notice", () => {
  const home = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const notice = readFileSync(new URL("../privacidad.html", import.meta.url), "utf8");

  assert.match(home, /https:\/\/plausible\.io\/js\/script\.tagged-events\.js/,
    "Plausible script must be visible to maintainers");
  assert.match(notice, /Plausible Analytics/);
  assert.match(notice, /proveedor externo de analítica web/);
  assert.match(notice, /https:\/\/plausible\.io\/privacy/);
  assert.match(notice, /FormSubmit/);
  assert.match(notice, /distinta del formulario de contacto/);
  assert.match(home, /href="\.\/privacidad\.html"/);
});
