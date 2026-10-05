export const RELEASE_INTEGRATION_V39_VERSION = "39.0";

export const EXPECTED_RELEASE_COMPONENTS = Object.freeze({
  V25: "25.0",
  V26: "26.0",
  V27: "27.0",
  V28: "28.0",
  V29: "29.0",
  V30: "30.0",
  V31: "31.0",
  V32: "32.0",
  V33: "33.0",
  V34: "34.0",
  V35: "35.0",
  V36: "36.0",
  V37: "37.0",
  V38: "38.0",
  V39: "39.0",
  V40: "40.0"
});

export function buildComponentManifest(components = {}) {
  return Object.freeze(
    Object.fromEntries(
      Object.keys(EXPECTED_RELEASE_COMPONENTS).map((key) => [
        key,
        {
          expected: EXPECTED_RELEASE_COMPONENTS[key],
          actual: components[key] ?? null,
          valid: components[key] === EXPECTED_RELEASE_COMPONENTS[key]
        }
      ])
    )
  );
}

export function verifyComponentManifest(manifest = {}) {
  const failures = [];

  for (const [key, expectedVersion] of Object.entries(EXPECTED_RELEASE_COMPONENTS)) {
    const entry = manifest[key];

    if (!entry) {
      failures.push({ code: "COMPONENT_MISSING", component: key });
      continue;
    }

    if (entry.actual !== expectedVersion || entry.valid !== true) {
      failures.push({
        code: "COMPONENT_VERSION_MISMATCH",
        component: key,
        expected: expectedVersion,
        actual: entry.actual ?? null
      });
    }
  }

  for (const key of Object.keys(manifest)) {
    if (!(key in EXPECTED_RELEASE_COMPONENTS)) {
      failures.push({ code: "UNKNOWN_COMPONENT", component: key });
    }
  }

  return {
    valid: failures.length === 0,
    failures
  };
}

export function buildReleaseLineage(components = {}) {
  return Object.freeze({
    releaseIntegrationVersion: RELEASE_INTEGRATION_V39_VERSION,
    components: buildComponentManifest(components),
    sequence: Object.keys(EXPECTED_RELEASE_COMPONENTS)
  });
}

export function verifyReleaseLineage(lineage = {}) {
  if (lineage.releaseIntegrationVersion !== RELEASE_INTEGRATION_V39_VERSION) {
    return {
      valid: false,
      failures: [{ code: "INTEGRATION_VERSION_MISMATCH" }]
    };
  }

  const expectedSequence = Object.keys(EXPECTED_RELEASE_COMPONENTS);

  if (
    JSON.stringify(lineage.sequence) !==
    JSON.stringify(expectedSequence)
  ) {
    return {
      valid: false,
      failures: [{ code: "RELEASE_SEQUENCE_MISMATCH" }]
    };
  }

  return verifyComponentManifest(lineage.components);
}

export function isDefinitiveReleaseCandidate(components = {}) {
  return verifyComponentManifest(
    buildComponentManifest(components)
  ).valid === true;
}
