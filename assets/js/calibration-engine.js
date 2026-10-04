import { calibrateForecast } from "./outcome-engine.js";

export const CALIBRATION_CONTRACT_VERSION = "19.0";

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const clampProbability = (value) => {
  const n = num(value);
  if (n === null) return null;
  return Math.min(1, Math.max(0, n));
};

const round = (value, places = 4) => {
  const n = num(value);
  if (n === null) return null;
  const factor = 10 ** places;
  return Math.round((n + Number.EPSILON) * factor) / factor;
};

const mean = (values) => {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export function normaliseCalibrationRows(rows = []) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const probability = clampProbability(row?.expectedProbability ?? row?.probability);
    const observed = num(row?.observedSuccess);

    if (probability === null || observed === null || ![0, 1].includes(observed)) {
      return null;
    }

    return {
      leadId: String(row?.leadId ?? ""),
      segment: String(row?.segment ?? "unknown"),
      probability,
      observedSuccess: observed
    };
  }).filter(Boolean);
}

export function calibrationBins(rows = [], binCount = 10) {
  const safeCount = Number.isInteger(binCount) && binCount > 0 ? binCount : 10;
  const bins = Array.from({ length: safeCount }, (_, index) => ({
    index,
    lower: index / safeCount,
    upper: (index + 1) / safeCount,
    records: 0,
    expectedRate: 0,
    actualRate: 0,
    calibrationError: null
  }));

  for (const row of rows) {
    const index = Math.min(safeCount - 1, Math.floor(row.probability * safeCount));
    const bin = bins[index];
    bin.records += 1;
    bin.expectedRate += row.probability;
    bin.actualRate += row.observedSuccess;
  }

  return bins.map((bin) => {
    if (!bin.records) {
      return Object.freeze({ ...bin, expectedRate: null, actualRate: null });
    }

    const expectedRate = bin.expectedRate / bin.records;
    const actualRate = bin.actualRate / bin.records;

    return Object.freeze({
      ...bin,
      expectedRate: round(expectedRate),
      actualRate: round(actualRate),
      calibrationError: round(actualRate - expectedRate)
    });
  });
}

export function calculateCalibrationMetrics(rows = []) {
  const safeRows = normaliseCalibrationRows(rows);

  if (!safeRows.length) {
    return {
      records: 0,
      expectedRate: null,
      actualRate: null,
      calibrationError: null,
      meanAbsoluteError: null,
      brierScore: null
    };
  }

  const expected = safeRows.map((row) => row.probability);
  const actual = safeRows.map((row) => row.observedSuccess);

  const expectedRate = mean(expected);
  const actualRate = mean(actual);
  const errors = safeRows.map((row) => Math.abs(row.probability - row.observedSuccess));
  const brier = safeRows.map((row) => (row.probability - row.observedSuccess) ** 2);

  return {
    records: safeRows.length,
    expectedRate: round(expectedRate),
    actualRate: round(actualRate),
    calibrationError: round(actualRate - expectedRate),
    meanAbsoluteError: round(mean(errors)),
    brierScore: round(mean(brier), 6)
  };
}

export function compareCalibration(current = {}, baseline = {}, thresholds = {}) {
  const calibrationErrorThreshold = Math.abs(num(thresholds.calibrationError) ?? 0.10);
  const brierScoreThreshold = Math.abs(num(thresholds.brierScore) ?? 0.05);
  const actualRateThreshold = Math.abs(num(thresholds.actualRate) ?? 0.10);

  const calibrationErrorDelta = (num(current.calibrationError) ?? 0) - (num(baseline.calibrationError) ?? 0);
  const brierScoreDelta = (num(current.brierScore) ?? 0) - (num(baseline.brierScore) ?? 0);
  const actualRateDelta = (num(current.actualRate) ?? 0) - (num(baseline.actualRate) ?? 0);

  const signals = {
    calibrationError: {
      delta: round(calibrationErrorDelta),
      breached: Math.abs(calibrationErrorDelta) >= calibrationErrorThreshold
    },
    brierScore: {
      delta: round(brierScoreDelta, 6),
      breached: Math.abs(brierScoreDelta) >= brierScoreThreshold
    },
    actualRate: {
      delta: round(actualRateDelta),
      breached: Math.abs(actualRateDelta) >= actualRateThreshold
    }
  };

  const breached = Object.values(signals).some((signal) => signal.breached);

  return Object.freeze({
    drift: breached,
    severity: breached ? "WARNING" : "STABLE",
    signals
  });
}

export function detectSegmentDrift(currentRows = [], baselineRows = [], thresholds = {}) {
  const current = normaliseCalibrationRows(currentRows);
  const baseline = normaliseCalibrationRows(baselineRows);
  const threshold = Math.abs(num(thresholds.actualRate) ?? 0.15);

  const segments = [...new Set([...current, ...baseline].map((row) => row.segment))].sort();

  return segments.map((segment) => {
    const currentSegment = current.filter((row) => row.segment === segment);
    const baselineSegment = baseline.filter((row) => row.segment === segment);
    const currentRate = mean(currentSegment.map((row) => row.observedSuccess));
    const baselineRate = mean(baselineSegment.map((row) => row.observedSuccess));
    const delta = currentRate === null || baselineRate === null
      ? null
      : currentRate - baselineRate;

    return {
      segment,
      currentRecords: currentSegment.length,
      baselineRecords: baselineSegment.length,
      currentRate: round(currentRate),
      baselineRate: round(baselineRate),
      delta: round(delta),
      drift: delta !== null && Math.abs(delta) >= threshold
    };
  });
}

export function buildCalibrationReport({
  forecastRows = [],
  outcomes = [],
  baselineRows = [],
  thresholds = {}
} = {}) {
  const byLead = new Map();
  (Array.isArray(outcomes) ? outcomes : []).forEach((outcome) => {
    const key = String(outcome?.leadId ?? "");
    byLead.set(key, [...(byLead.get(key) || []), outcome]);
  });

  const currentRows = normaliseCalibrationRows(
    (Array.isArray(forecastRows) ? forecastRows : []).map((row) => {
      const leadOutcomes = byLead.get(String(row?.leadId ?? "")) || [];
      if (!leadOutcomes.length) return null;

      const terminal = leadOutcomes.find((outcome) => outcome?.terminal);
      const success = terminal
        ? terminal.type === "CLOSED_WON"
        : leadOutcomes.some((outcome) => outcome?.positive);

      return {
        ...row,
        observedSuccess: success ? 1 : 0
      };
    }).filter(Boolean)
  );

  const explicitBaselineRows = normaliseCalibrationRows(baselineRows);
  const baselineEstablished = explicitBaselineRows.length > 0;
  const comparisonBaselineRows = baselineEstablished ? explicitBaselineRows : currentRows;

  const baseline = calculateCalibrationMetrics(comparisonBaselineRows);
  const current = calculateCalibrationMetrics(currentRows);
  const drift = compareCalibration(current, baseline, thresholds);
  const segmentDrift = detectSegmentDrift(currentRows, comparisonBaselineRows, thresholds);

  return Object.freeze({
    contractVersion: CALIBRATION_CONTRACT_VERSION,
    records: current.records,
    rows: currentRows,
    baselineEstablished,
    current,
    baseline,
    bins: calibrationBins(currentRows),
    drift,
    segmentDrift,
    source: "outcome-engine"
  });
}

export function calibrateFromOutcomeEngine(forecastRows = [], outcomes = []) {
  return calibrateForecast(forecastRows, outcomes);
}
