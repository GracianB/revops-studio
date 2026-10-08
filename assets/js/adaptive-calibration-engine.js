import {
  calculateCalibrationMetrics
} from "./calibration-engine.js";

export const ADAPTIVE_CALIBRATION_CONTRACT_VERSION = "20.0";

export const ADAPTIVE_CALIBRATION_DEFAULTS = Object.freeze({
  windowDays: 30,
  minSamples: 8,
  minGroupSamples: 5,
  watchDelta: 0.05,
  warningDelta: 0.10,
  criticalDelta: 0.20,
  historyLimit: 36
});

const SEVERITY_RANK = Object.freeze({
  STABLE: 0,
  WATCH: 1,
  WARNING: 2,
  CRITICAL: 3,
  INSUFFICIENT: -1
});

const numeric = (value) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
};

const clamp = (value, min, max) => {
  const result = numeric(value);
  if (result === null) return null;
  return Math.max(min, Math.min(max, result));
};

const round = (value, places = 6) => {
  const result = numeric(value);
  if (result === null) return null;
  const factor = 10 ** places;
  return Math.round((result + Number.EPSILON) * factor) / factor;
};

const isoTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const stableHash = (value) => {
  const text = String(value);
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
};

const stableRowKey = (row) => [
  String(row.leadId ?? ""),
  String(row.observedAt ?? ""),
  String(row.probability ?? ""),
  String(row.observedSuccess ?? ""),
  String(row.segment ?? "unknown"),
  String(row.cohort ?? "unknown")
].join("|");

const sortRows = (rows) => [...rows].sort((a, b) =>
  stableRowKey(a).localeCompare(stableRowKey(b))
);

export function normaliseAdaptiveCalibrationConfig(config = {}) {
  const defaults = ADAPTIVE_CALIBRATION_DEFAULTS;

  const windowDays = Math.round(
    clamp(config.windowDays, 1, 365) ?? defaults.windowDays
  );

  const minSamples = Math.round(
    clamp(config.minSamples, 1, 10000) ?? defaults.minSamples
  );

  const minGroupSamples = Math.round(
    clamp(config.minGroupSamples, 1, 10000) ?? defaults.minGroupSamples
  );

  const watchDelta = clamp(config.watchDelta, 0.001, 1) ?? defaults.watchDelta;
  const warningDelta = clamp(config.warningDelta, 0.001, 1) ?? defaults.warningDelta;
  const criticalDelta = clamp(config.criticalDelta, 0.001, 1) ?? defaults.criticalDelta;

  const ordered = warningDelta >= watchDelta && criticalDelta >= warningDelta;
  const finalWatch = ordered ? watchDelta : defaults.watchDelta;
  const finalWarning = ordered ? warningDelta : defaults.warningDelta;
  const finalCritical = ordered ? criticalDelta : defaults.criticalDelta;

  return {
    windowDays,
    minSamples,
    minGroupSamples,
    watchDelta: finalWatch,
    warningDelta: finalWarning,
    criticalDelta: finalCritical,
    historyLimit: Math.round(
      clamp(config.historyLimit, 1, 120) ?? defaults.historyLimit
    )
  };
}

export function buildObservedCalibrationRows(forecastRows = [], outcomes = []) {
  const forecasts = Array.isArray(forecastRows) ? forecastRows : [];
  const events = Array.isArray(outcomes) ? outcomes : [];
  const byLead = new Map();

  events.forEach((outcome) => {
    const leadId = String(outcome?.leadId ?? "");
    if (!leadId) return;
    byLead.set(leadId, [...(byLead.get(leadId) || []), outcome]);
  });

  const rows = [];

  forecasts.forEach((forecast) => {
    const leadId = String(forecast?.leadId ?? "");
    const leadOutcomes = byLead.get(leadId) || [];
    if (!leadId || !leadOutcomes.length) return;

    const terminal = leadOutcomes
      .filter((outcome) => outcome?.terminal)
      .sort((a, b) => String(a?.occurredAt ?? "").localeCompare(String(b?.occurredAt ?? "")))[0] || null;

    const success = terminal
      ? terminal.type === "CLOSED_WON"
      : leadOutcomes.some((outcome) => outcome?.positive);

    const observedSource = terminal || [...leadOutcomes]
      .sort((a, b) => String(a?.occurredAt ?? "").localeCompare(String(b?.occurredAt ?? "")))
      .at(-1);

    const observedAt = isoTime(observedSource?.occurredAt);
    const probability = clamp(
      forecast?.expectedProbability ?? forecast?.probability,
      0,
      1
    );

    if (probability === null || observedAt === null) return;

    rows.push({
      leadId,
      account: String(forecast?.account || "Unnamed account"),
      segment: String(forecast?.segment || "unknown"),
      cohort: String(forecast?.cohort || "unknown"),
      probability,
      observedSuccess: success ? 1 : 0,
      observedAt
    });
  });

  return sortRows(
    [...new Map(rows.map((row) => [stableRowKey(row), row])).values()]
  );
}

function normaliseAdaptiveRows(rows = [], fallbackObservedAt = null) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const leadId = String(row?.leadId ?? "").trim();
    const probability = clamp(
      row?.probability ?? row?.expectedProbability,
      0,
      1
    );
    const observedSuccess = numeric(row?.observedSuccess);
    const observedAt = isoTime(row?.observedAt) || isoTime(fallbackObservedAt);

    if (!leadId || probability === null || ![0, 1].includes(observedSuccess) || observedAt === null) {
      return null;
    }

    return {
      leadId,
      account: String(row?.account || "Unnamed account"),
      segment: String(row?.segment || "unknown").trim() || "unknown",
      cohort: String(row?.cohort || "unknown").trim() || "unknown",
      probability,
      observedSuccess,
      observedAt
    };
  }).filter(Boolean);
}

export function normaliseCalibrationHistory(history = []) {
  if (!Array.isArray(history)) return [];

  return history.map((snapshot) => {
    const snapshotId = String(snapshot?.snapshotId ?? "");
    const runId = String(snapshot?.runId ?? "");
    const datasetFingerprint = String(snapshot?.datasetFingerprint ?? "");
    const capturedAt = isoTime(snapshot?.capturedAt);
    const rows = normaliseAdaptiveRows(snapshot?.rows || [], capturedAt);

    if (!snapshotId || !capturedAt) return null;

    return Object.freeze({
      snapshotId,
      runId,
      datasetFingerprint,
      capturedAt,
      rows: sortRows(rows)
    });
  }).filter(Boolean);
}

export function createCalibrationSnapshot({
  runId = null,
  datasetFingerprint = null,
  capturedAt = null,
  rows = []
} = {}) {
  const safeCapturedAt = isoTime(capturedAt);
  const safeRows = sortRows(normaliseAdaptiveRows(rows, safeCapturedAt));

  if (!safeCapturedAt || !safeRows.length) return null;

  const material = JSON.stringify({
    runId: runId || null,
    datasetFingerprint: datasetFingerprint || null,
    capturedAt: safeCapturedAt,
    rows: safeRows
  });

  return Object.freeze({
    contractVersion: ADAPTIVE_CALIBRATION_CONTRACT_VERSION,
    snapshotId: "CAL20-" + stableHash(material),
    runId: runId || null,
    datasetFingerprint: datasetFingerprint || null,
    capturedAt: safeCapturedAt,
    rows: safeRows
  });
}

export function appendCalibrationSnapshot(history = [], snapshot = null, limit = 36) {
  const normalised = normaliseCalibrationHistory(history);
  if (!snapshot) return normalised;

  const merged = [
    ...normalised.filter((item) => item.snapshotId !== snapshot.snapshotId),
    snapshot
  ];

  return merged
    .sort((a, b) => String(a.capturedAt).localeCompare(String(b.capturedAt)))
    .slice(-Math.max(1, Math.round(Number(limit) || 36)));
}

export function flattenCalibrationHistory(history = []) {
  const snapshots = normaliseCalibrationHistory(history);
  const rows = snapshots.flatMap((snapshot) => snapshot.rows || []);
  const deduped = new Map();

  rows.forEach((row) => {
    deduped.set(stableRowKey(row), row);
  });

  return sortRows([...deduped.values()]);
}

function windowRows(rows, startMs, endMs) {
  return rows.filter((row) => {
    const time = new Date(row.observedAt).getTime();
    return Number.isFinite(time) && time >= startMs && time < endMs;
  });
}

function classifySeverity(maxDelta, config, sufficient) {
  if (!sufficient) return "INSUFFICIENT";
  if (maxDelta >= config.criticalDelta) return "CRITICAL";
  if (maxDelta >= config.warningDelta) return "WARNING";
  if (maxDelta >= config.watchDelta) return "WATCH";
  return "STABLE";
}

function maxSignalDelta(signals) {
  return Math.max(
    ...Object.values(signals)
      .map((signal) => Math.abs(signal.delta ?? 0)),
    0
  );
}

function compareWindows(currentRows, previousRows, config) {
  const current = calculateCalibrationMetrics(currentRows);
  const previous = calculateCalibrationMetrics(previousRows);
  const sufficient = current.records >= config.minSamples &&
    previous.records >= config.minSamples;

  const signals = {
    calibrationError: {
      delta: round((current.calibrationError ?? 0) - (previous.calibrationError ?? 0)),
      current: current.calibrationError,
      previous: previous.calibrationError
    },
    brierScore: {
      delta: round((current.brierScore ?? 0) - (previous.brierScore ?? 0), 6),
      current: current.brierScore,
      previous: previous.brierScore
    },
    actualRate: {
      delta: round((current.actualRate ?? 0) - (previous.actualRate ?? 0)),
      current: current.actualRate,
      previous: previous.actualRate
    }
  };

  const maxDelta = maxSignalDelta(signals);

  return {
    current,
    previous,
    sampleSufficient: sufficient,
    severity: classifySeverity(maxDelta, config, sufficient),
    drift: sufficient && maxDelta >= config.watchDelta,
    signals,
    maxDelta: round(maxDelta)
  };
}

function groupRows(rows, key) {
  const groups = {};
  rows.forEach((row) => {
    const value = String(row?.[key] || "unknown").trim() || "unknown";
    groups[value] = [...(groups[value] || []), row];
  });
  return groups;
}

function compareGroups(currentRows, previousRows, key, config) {
  const currentGroups = groupRows(currentRows, key);
  const previousGroups = groupRows(previousRows, key);
  const keys = [...new Set([
    ...Object.keys(currentGroups),
    ...Object.keys(previousGroups)
  ])].sort();

  return keys.map((value) => {
    const current = currentGroups[value] || [];
    const previous = previousGroups[value] || [];
    const sufficient = current.length >= config.minGroupSamples &&
      previous.length >= config.minGroupSamples;

    const currentMetrics = calculateCalibrationMetrics(current);
    const previousMetrics = calculateCalibrationMetrics(previous);

    const signals = {
      calibrationError: {
        delta: round((currentMetrics.calibrationError ?? 0) - (previousMetrics.calibrationError ?? 0)),
        current: currentMetrics.calibrationError,
        previous: previousMetrics.calibrationError
      },
      brierScore: {
        delta: round((currentMetrics.brierScore ?? 0) - (previousMetrics.brierScore ?? 0), 6),
        current: currentMetrics.brierScore,
        previous: previousMetrics.brierScore
      },
      actualRate: {
        delta: round((currentMetrics.actualRate ?? 0) - (previousMetrics.actualRate ?? 0)),
        current: currentMetrics.actualRate,
        previous: previousMetrics.actualRate
      }
    };

    const maxDelta = maxSignalDelta(signals);

    return {
      key,
      value,
      currentRecords: current.length,
      previousRecords: previous.length,
      current: currentMetrics,
      previous: previousMetrics,
      sampleSufficient: sufficient,
      severity: classifySeverity(maxDelta, config, sufficient),
      drift: sufficient && maxDelta >= config.watchDelta,
      signals,
      maxDelta: round(maxDelta)
    };
  });
}

function highestSeverity(globalSeverity, ...groupSeverities) {
  if (globalSeverity === "INSUFFICIENT") return "INSUFFICIENT";

  const materialGroups = groupSeverities
    .filter((severity) => severity !== "INSUFFICIENT")
    .sort((a, b) => SEVERITY_RANK[b] - SEVERITY_RANK[a]);

  const highestGroup = materialGroups[0] || null;
  if (
    highestGroup &&
    SEVERITY_RANK[highestGroup] > SEVERITY_RANK[globalSeverity]
  ) {
    return highestGroup;
  }

  return globalSeverity || "STABLE";
}

function buildRecommendations(global, segments, cohorts, config) {
  const recommendations = [];

  if (global.severity === "INSUFFICIENT") {
    recommendations.push({
      priority: "high",
      code: "SAMPLE_INSUFFICIENT",
      action: "Collect more observed outcomes before treating the comparison as drift.",
      detail: "Global windows require at least " + config.minSamples + " observed records."
    });
  }

  if (global.severity === "WATCH") {
    recommendations.push({
      priority: "medium",
      code: "WATCH_GLOBAL_CALIBRATION",
      action: "Monitor calibration movement across the next observation window.",
      detail: "A measurable delta exists, but the warning threshold has not been reached."
    });
  }

  if (global.severity === "WARNING") {
    recommendations.push({
      priority: "high",
      code: "REVIEW_FORECAST_ASSUMPTIONS",
      action: "Review forecast probabilities and the assumptions behind the affected run.",
      detail: "Global calibration has crossed the warning threshold."
    });
  }

  if (global.severity === "CRITICAL") {
    recommendations.push({
      priority: "critical",
      code: "CONTROLLED_RECALIBRATION",
      action: "Start a controlled recalibration review before relying on the affected forecast.",
      detail: "Global calibration has crossed the critical threshold; no automatic model change is performed."
    });
  }

  const affectedSegments = segments.filter((item) => item.drift);
  const affectedCohorts = cohorts.filter((item) => item.drift);

  if (affectedSegments.length) {
    recommendations.push({
      priority: "high",
      code: "SEGMENT_DRIFT",
      action: "Inspect the affected segments before changing global assumptions.",
      detail: affectedSegments.map((item) => item.value + " · " + item.severity).join(" | ")
    });
  }

  if (affectedCohorts.length) {
    recommendations.push({
      priority: "high",
      code: "COHORT_DRIFT",
      action: "Inspect cohort-specific behaviour before applying a broad recalibration.",
      detail: affectedCohorts.map((item) => item.value + " · " + item.severity).join(" | ")
    });
  }

  const insufficientGroups = [...segments, ...cohorts]
    .filter((item) => item.severity === "INSUFFICIENT").length;

  if (insufficientGroups) {
    recommendations.push({
      priority: "low",
      code: "GROUP_SAMPLE_GAP",
      action: "Keep low-volume segment and cohort alerts in observation until their sample floor is reached.",
      detail: insufficientGroups + " group comparisons are below the minimum sample threshold."
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      priority: "low",
      code: "CALIBRATION_STABLE",
      action: "Keep the current forecast configuration under normal observation.",
      detail: "No material global, segment or cohort drift was detected."
    });
  }

  return recommendations;
}

function buildAuditTrail({
  reportId,
  snapshot,
  baselineEstablished,
  severity,
  drift,
  currentRecords,
  previousRecords
}) {
  const events = [{
    eventId: reportId + ":SNAPSHOT",
    type: "CALIBRATION_SNAPSHOT_RECORDED",
    status: snapshot ? "RECORDED" : "EMPTY",
    detail: snapshot
      ? snapshot.snapshotId + " · " + snapshot.rows.length + " observed rows"
      : "No observed outcomes available for this snapshot."
  }, {
    eventId: reportId + ":BASELINE",
    type: "CALIBRATION_BASELINE_STATUS",
    status: baselineEstablished ? "ESTABLISHED" : "INSUFFICIENT",
    detail: currentRecords + " current · " + previousRecords + " previous"
  }];

  if (drift) {
    events.push({
      eventId: reportId + ":DRIFT",
      type: "CALIBRATION_DRIFT_ALERT",
      status: severity,
      detail: "Adaptive calibration severity " + severity
    });
  }

  return events;
}

export function buildAdaptiveCalibrationReport({
  forecastRows = [],
  outcomes = [],
  history = [],
  datasetFingerprint = null,
  runId = null,
  now = new Date().toISOString(),
  config = {}
} = {}) {
  const options = normaliseAdaptiveCalibrationConfig(config);
  const generatedAt = isoTime(now);

  if (!generatedAt) {
    throw new Error("Invalid calibration evaluation timestamp.");
  }

  const currentObserved = buildObservedCalibrationRows(forecastRows, outcomes);
  const safeHistory = normaliseCalibrationHistory(history)
    .filter((snapshot) =>
      !datasetFingerprint ||
      !snapshot.datasetFingerprint ||
      snapshot.datasetFingerprint === String(datasetFingerprint)
    );
  const historicalRows = flattenCalibrationHistory(safeHistory);

  const mergedRows = sortRows([
    ...historicalRows,
    ...currentObserved
  ]);

  const dedupedRows = [...new Map(
    mergedRows.map((row) => [stableRowKey(row), row])
  ).values()];

  const endMs = new Date(generatedAt).getTime();
  const windowMs = options.windowDays * 24 * 60 * 60 * 1000;
  const currentRows = windowRows(dedupedRows, endMs - windowMs, endMs + 1);
  const previousRows = windowRows(dedupedRows, endMs - (windowMs * 2), endMs - windowMs);

  const global = compareWindows(currentRows, previousRows, options);
  const segments = compareGroups(currentRows, previousRows, "segment", options);
  const cohorts = compareGroups(currentRows, previousRows, "cohort", options);

  const establishedBeforeCurrentSnapshot = previousRows.length >= options.minSamples;
  const snapshot = createCalibrationSnapshot({
    runId,
    datasetFingerprint,
    capturedAt: generatedAt,
    rows: currentObserved
  });

  const nextHistory = appendCalibrationSnapshot(
    safeHistory,
    snapshot,
    options.historyLimit
  );

  const alertSeverity = highestSeverity(
    global.severity,
    ...segments.map((item) => item.severity),
    ...cohorts.map((item) => item.severity)
  );

  const baselineEstablished = establishedBeforeCurrentSnapshot;

  const reportId = "V20-" + stableHash(JSON.stringify({
    datasetFingerprint,
    runId,
    generatedAt,
    currentRows,
    previousRows
  }));

  const recommendations = buildRecommendations(
    global,
    segments,
    cohorts,
    options
  );

  const auditTrail = buildAuditTrail({
    reportId,
    snapshot,
    baselineEstablished,
    severity: alertSeverity,
    drift: global.drift || segments.some((item) => item.drift) || cohorts.some((item) => item.drift),
    currentRecords: currentRows.length,
    previousRecords: previousRows.length
  });

  return Object.freeze({
    contractVersion: ADAPTIVE_CALIBRATION_CONTRACT_VERSION,
    reportId,
    generatedAt,
    datasetFingerprint: datasetFingerprint || null,
    runId: runId || null,
    configuration: options,
    baselineEstablished,
    currentWindow: {
      start: new Date(endMs - windowMs).toISOString(),
      end: generatedAt,
      records: currentRows.length
    },
    previousWindow: {
      start: new Date(endMs - (windowMs * 2)).toISOString(),
      end: new Date(endMs - windowMs).toISOString(),
      records: previousRows.length
    },
    global,
    segments,
    cohorts,
    severity: alertSeverity,
    drift: global.drift ||
      segments.some((item) => item.drift) ||
      cohorts.some((item) => item.drift),
    recommendations,
    auditTrail,
    snapshotId: snapshot?.snapshotId || null,
    nextHistory
  });
}
