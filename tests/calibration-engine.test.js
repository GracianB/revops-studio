import test from "node:test";
import assert from "node:assert/strict";
import {
  normaliseCalibrationRows,
  calibrationBins,
  calculateCalibrationMetrics,
  compareCalibration,
  detectSegmentDrift,
  buildCalibrationReport
} from "../assets/js/calibration-engine.js";

const rows = [
  { leadId:"L1", segment:"SMB", probability:0.8, observedSuccess:1 },
  { leadId:"L2", segment:"SMB", probability:0.2, observedSuccess:0 },
  { leadId:"L3", segment:"Enterprise", probability:0.7, observedSuccess:0 },
  { leadId:"L4", segment:"Enterprise", probability:0.3, observedSuccess:1 }
];

test("calibration rows normalise valid probabilities", () => {
  const result = normaliseCalibrationRows(rows);
  assert.equal(result.length, 4);
  assert.equal(result[0].probability, 0.8);
});

test("invalid calibration rows are rejected", () => {
  const result = normaliseCalibrationRows([
    { leadId:"BAD", probability:"x", observedSuccess:1 },
    { leadId:"BAD2", probability:0.5, observedSuccess:2 }
  ]);
  assert.equal(result.length, 0);
});

test("calibration metrics calculate deterministic rates", () => {
  const result = calculateCalibrationMetrics(rows);
  assert.equal(result.records, 4);
  assert.equal(result.expectedRate, 0.5);
  assert.equal(result.actualRate, 0.5);
  assert.equal(result.calibrationError, 0);
});

test("brier score is calculated correctly", () => {
  const result = calculateCalibrationMetrics([
    { probability:0.8, observedSuccess:1 },
    { probability:0.2, observedSuccess:0 }
  ]);
  assert.equal(result.brierScore, 0.04);
});

test("calibration bins expose expected and actual rates", () => {
  const result = calibrationBins(rows);
  const high = result.find((bin) => bin.lower === 0.8);
  assert.equal(high.records, 1);
  assert.equal(high.expectedRate, 0.8);
  assert.equal(high.actualRate, 1);
});

test("stable calibration does not trigger drift", () => {
  const current = calculateCalibrationMetrics(rows);
  const baseline = calculateCalibrationMetrics(rows);
  const result = compareCalibration(current, baseline);
  assert.equal(result.drift, false);
  assert.equal(result.severity, "STABLE");
});

test("material calibration degradation triggers drift", () => {
  const current = calculateCalibrationMetrics([
    { probability:0.9, observedSuccess:0 },
    { probability:0.9, observedSuccess:0 }
  ]);
  const baseline = calculateCalibrationMetrics([
    { probability:0.5, observedSuccess:1 },
    { probability:0.5, observedSuccess:0 }
  ]);
  const result = compareCalibration(current, baseline);
  assert.equal(result.drift, true);
  assert.equal(result.severity, "WARNING");
});

test("segment drift identifies degraded segment", () => {
  const baseline = [
    { segment:"SMB", probability:0.5, observedSuccess:1 },
    { segment:"SMB", probability:0.5, observedSuccess:1 }
  ];
  const current = [
    { segment:"SMB", probability:0.5, observedSuccess:0 },
    { segment:"SMB", probability:0.5, observedSuccess:0 }
  ];
  const result = detectSegmentDrift(current, baseline);
  assert.equal(result.length, 1);
  assert.equal(result[0].segment, "SMB");
  assert.equal(result[0].drift, true);
});

test("calibration report ignores forecasts without an observed outcome", () => {
  const report = buildCalibrationReport({
    forecastRows: [
      { leadId:"OBSERVED", segment:"SMB", probability:0.8 },
      { leadId:"PENDING", segment:"SMB", probability:0.2 }
    ],
    outcomes: [
      { leadId:"OBSERVED", positive:true, terminal:true, type:"CLOSED_WON" }
    ]
  });
  assert.equal(report.records, 1);
  assert.equal(report.current.actualRate, 1);
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].leadId, "OBSERVED");
});

test("calibration report is deterministic and versioned", () => {
  const report = buildCalibrationReport({
    forecastRows: [
      { leadId:"L1", segment:"SMB", probability:0.8 }
    ],
    outcomes: [
      { leadId:"L1", positive:true, terminal:true, type:"CLOSED_WON" }
    ],
    baselineRows: [
      { leadId:"L1", segment:"SMB", probability:0.8, observedSuccess:1 }
    ]
  });
  assert.equal(report.contractVersion, "19.0");
  assert.equal(report.records, 1);
  assert.equal(report.current.actualRate, 1);
  assert.ok(Array.isArray(report.bins));
  assert.ok(report.drift);
});
