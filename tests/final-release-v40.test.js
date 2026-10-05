import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  FINAL_RELEASE_V40_VERSION, FINAL_RELEASE_SCHEMA, FINAL_RELEASE_MIN_TESTS,
  buildFinalReleaseCertificate, verifyFinalReleaseCertificate,
  fingerprintFinalRelease, canonicalizeFinalRelease, exportFinalReleaseCertificate
} from "../assets/js/final-release-v40.js";

const components = { V25:"25.0",V26:"26.0",V27:"27.0",V28:"28.0",V29:"29.0",V30:"30.0",V31:"31.0",V32:"32.0",V33:"33.0",V34:"34.0",V35:"35.0",V36:"36.0",V37:"37.0",V38:"38.0",V39:"39.0",V40:"40.0" };
function input() { return { packageVersion:"40.0.0", testCount:FINAL_RELEASE_MIN_TESTS, validationPass:true, verificationPass:true, patchIntegrityPass:true, components, sourceFingerprints:{"package.json":"sha256:test"}, gitHead:"abc123" }; }

test("V40 exposes the definitive contract", () => { assert.equal(FINAL_RELEASE_V40_VERSION, "40.0"); assert.equal(FINAL_RELEASE_SCHEMA, "revops-studio-final-release"); });
test("V40 canonicalization sorts object keys", () => assert.equal(canonicalizeFinalRelease({ b:2, a:1 }), '{"a":1,"b":2}'));
test("V40 fingerprint is deterministic", () => assert.equal(buildFinalReleaseCertificate(input()).releaseFingerprint, buildFinalReleaseCertificate(input()).releaseFingerprint));
test("V40 fingerprint changes when release data changes", () => { const a=buildFinalReleaseCertificate(input()); const d=input(); d.gitHead="different"; const b=buildFinalReleaseCertificate(d); assert.notEqual(a.releaseFingerprint,b.releaseFingerprint); });
test("V40 builds a certified release", () => assert.equal(buildFinalReleaseCertificate(input()).status, "CERTIFIED"));
test("V40 verifies a certified release", () => { const r=verifyFinalReleaseCertificate(buildFinalReleaseCertificate(input())); assert.equal(r.valid,true); assert.equal(r.status,"FINAL_RELEASE_CERTIFIED"); });
test("V40 detects fingerprint tampering", () => { const c=buildFinalReleaseCertificate(input()); c.releaseFingerprint="tampered"; const r=verifyFinalReleaseCertificate(c); assert.equal(r.valid,false); assert.ok(r.failures.some((f)=>f.code==="RELEASE_FINGERPRINT_MISMATCH")); });
test("V40 rejects package version downgrade", () => { const d=input(); d.packageVersion="39.0.0"; assert.equal(verifyFinalReleaseCertificate(buildFinalReleaseCertificate(d)).valid,false); });
test("V40 rejects insufficient tests", () => { const d=input(); d.testCount=FINAL_RELEASE_MIN_TESTS-1; assert.equal(verifyFinalReleaseCertificate(buildFinalReleaseCertificate(d)).valid,false); });
test("V40 rejects a failed gate", () => { const d=input(); d.validationPass=false; assert.equal(buildFinalReleaseCertificate(d).status,"BLOCKED"); });
test("V40 rejects component substitution", () => { const d=input(); d.components={...components,V31:"30.0"}; assert.equal(verifyFinalReleaseCertificate(buildFinalReleaseCertificate(d)).valid,false); });
test("V40 export is valid JSON", () => { const c=buildFinalReleaseCertificate(input()); assert.deepEqual(JSON.parse(exportFinalReleaseCertificate(c)),c); });
test("V40 fingerprint ignores embedded fingerprint", () => { const c=buildFinalReleaseCertificate(input()); const f=fingerprintFinalRelease(c); c.releaseFingerprint="different"; assert.equal(fingerprintFinalRelease(c),f); });
test("V40 release gate executes the real pre-release verification", () => {
  const gate = fs.readFileSync(new URL("../scripts/release-gate-v40.mjs", import.meta.url), "utf8");
  assert.match(gate, /execFileSync\("npm", \["run", "verify:pre-release"\]/);
});
test("V40 package separates pre-release verification from release certification", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(typeof pkg.scripts["verify:pre-release"], "string");
  assert.match(pkg.scripts.verify, /^npm run verify:pre-release && npm run release:check$/);
});
