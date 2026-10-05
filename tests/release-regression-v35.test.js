import test from "node:test";
import assert from "node:assert/strict";

import {
  REGRESSION_FORTRESS_VERSION,
  buildRegressionReport,
  regressionGatePassed
} from "../assets/js/release-regression-v35.js";

test("V35 exposes fixed version", () => {
  assert.equal(
    REGRESSION_FORTRESS_VERSION,
    "35.0"
  );
});

test("complete regression report passes", () => {
  const report = buildRegressionReport({
    syntax: true,
    unit: true,
    repository: true,
    certificate: true,
    security: true,
    documentation: true
  });

  assert.equal(report.valid, true);
  assert.equal(report.failed.length, 0);
  assert.equal(
    regressionGatePassed(
      report,
      "certificate"
    ),
    true
  );
});

test("failed gate fails closed", () => {
  const report = buildRegressionReport({
    syntax: true,
    unit: true,
    repository: true,
    certificate: false,
    security: true,
    documentation: true
  });

  assert.equal(report.valid, false);
  assert.equal(
    regressionGatePassed(
      report,
      "certificate"
    ),
    false
  );
});
