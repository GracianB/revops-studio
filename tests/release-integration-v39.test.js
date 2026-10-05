import test from "node:test";
import assert from "node:assert/strict";

import {
  RELEASE_INTEGRATION_V39_VERSION,
  EXPECTED_RELEASE_COMPONENTS,
  buildComponentManifest,
  verifyComponentManifest,
  buildReleaseLineage,
  verifyReleaseLineage,
  isDefinitiveReleaseCandidate
} from "../assets/js/release-integration-v39.js";

function complete() {
  return Object.fromEntries(Object.entries(EXPECTED_RELEASE_COMPONENTS));
}

test("V39 version is fixed", () => {
  assert.equal(RELEASE_INTEGRATION_V39_VERSION, "39.0");
});

test("V39 defines the full V25-V40 chain", () => {
  assert.equal(Object.keys(EXPECTED_RELEASE_COMPONENTS).length, 16);
  assert.equal(EXPECTED_RELEASE_COMPONENTS.V25, "25.0");
  assert.equal(EXPECTED_RELEASE_COMPONENTS.V32, "32.0");
  assert.equal(EXPECTED_RELEASE_COMPONENTS.V40, "40.0");
});

test("V39 builds a complete component manifest", () => {
  const manifest = buildComponentManifest(complete());
  assert.equal(manifest.V25.valid, true);
  assert.equal(manifest.V40.valid, true);
});

test("V39 verifies a complete manifest", () => {
  assert.equal(
    verifyComponentManifest(buildComponentManifest(complete())).valid,
    true
  );
});

test("V39 rejects missing component", () => {
  const components = complete();
  delete components.V31;
  assert.equal(isDefinitiveReleaseCandidate(components), false);
});

test("V39 rejects version substitution", () => {
  const components = complete();
  components.V30 = "29.0";
  assert.equal(isDefinitiveReleaseCandidate(components), false);
});

test("V39 rejects unknown manifest component", () => {
  const manifest = {
    ...buildComponentManifest(complete()),
    V41: {
      expected: "41.0",
      actual: "41.0",
      valid: true
    }
  };

  assert.equal(
    verifyComponentManifest(manifest).valid,
    false
  );
});

test("V39 lineage verifies", () => {
  const lineage = buildReleaseLineage(complete());
  assert.equal(verifyReleaseLineage(lineage).valid, true);
});

test("V39 rejects sequence substitution", () => {
  const lineage = {
    ...buildReleaseLineage(complete()),
    sequence: ["V25", "V26"]
  };

  assert.equal(
    verifyReleaseLineage(lineage).valid,
    false
  );
});

test("V39 candidate is explicitly definitive", () => {
  assert.equal(
    isDefinitiveReleaseCandidate(complete()),
    true
  );
});
