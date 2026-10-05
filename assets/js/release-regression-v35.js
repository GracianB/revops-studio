export const REGRESSION_FORTRESS_VERSION = "35.0";

export const REGRESSION_GATES = Object.freeze([
  "syntax",
  "unit",
  "repository",
  "certificate",
  "security",
  "documentation"
]);

export function buildRegressionReport(results = {}) {
  const gates = REGRESSION_GATES.map((gate) => ({
    gate,
    pass: results[gate] === true
  }));

  const failed = gates
    .filter((entry) => !entry.pass)
    .map((entry) => entry.gate);

  return Object.freeze({
    version: REGRESSION_FORTRESS_VERSION,
    valid: failed.length === 0,
    total: gates.length,
    passed: gates.length - failed.length,
    failed,
    gates
  });
}

export function regressionGatePassed(report, gate) {
  return Boolean(
    report &&
    report.valid === true &&
    report.gates?.some(
      (entry) => entry.gate === gate && entry.pass === true
    )
  );
}
