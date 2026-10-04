import test from "node:test";
import assert from "node:assert/strict";
import {
  ADAPTIVE_CALIBRATION_CONTRACT_VERSION,
  ADAPTIVE_CALIBRATION_DEFAULTS,
  normaliseAdaptiveCalibrationConfig,
  buildObservedCalibrationRows,
  normaliseCalibrationHistory,
  createCalibrationSnapshot,
  appendCalibrationSnapshot,
  flattenCalibrationHistory,
  buildAdaptiveCalibrationReport
} from "../assets/js/adaptive-calibration-engine.js";

const outcomes = (rows) => rows.map((row, index) => ({
  leadId: row.leadId,
  type: row.success ? "CLOSED_WON" : "CLOSED_LOST",
  terminal: true,
  positive: row.success,
  occurredAt: "2026-09-" + String(10 + index).padStart(2, "0") + "T12:00:00.000Z"
}));

test("V20 contract exposes deterministic defaults", () => {
  assert.equal(ADAPTIVE_CALIBRATION_CONTRACT_VERSION, "20.0");
  assert.equal(ADAPTIVE_CALIBRATION_DEFAULTS.windowDays, 30);
  assert.equal(ADAPTIVE_CALIBRATION_DEFAULTS.minSamples, 8);
});

test("V20 config clamps invalid values and preserves threshold ordering", () => {
  const result = normaliseAdaptiveCalibrationConfig({
    windowDays: 0,
    minSamples: 0,
    minGroupSamples: 0,
    watchDelta: 0,
    warningDelta: 0.02,
    criticalDelta: 0.01
  });
  assert.equal(result.windowDays, 1);
  assert.equal(result.minSamples, 1);
  assert.equal(result.minGroupSamples, 1);
  assert.ok(result.criticalDelta >= result.warningDelta);
  assert.ok(result.warningDelta >= result.watchDelta);
});

test("V20 observed rows ignore forecasts without outcomes", () => {
  const rows = buildObservedCalibrationRows(
    [
      { leadId:"L1", account:"A", segment:"SMB", cohort:"2026-Q3", probability:0.8 },
      { leadId:"L2", account:"B", segment:"SMB", cohort:"2026-Q3", probability:0.2 }
    ],
    [
      { leadId:"L1", terminal:true, positive:true, type:"CLOSED_WON", occurredAt:"2026-09-10T12:00:00.000Z" }
    ]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].leadId, "L1");
  assert.equal(rows[0].observedSuccess, 1);
});

test("V20 observed rows use terminal outcome precedence", () => {
  const rows = buildObservedCalibrationRows(
    [{ leadId:"L1", segment:"SMB", probability:0.8 }],
    [
      { leadId:"L1", positive:true, terminal:false, type:"REPLIED", occurredAt:"2026-09-10T12:00:00.000Z" },
      { leadId:"L1", positive:false, terminal:true, type:"CLOSED_LOST", occurredAt:"2026-09-12T12:00:00.000Z" }
    ]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].observedSuccess, 0);
  assert.equal(rows[0].observedAt, "2026-09-12T12:00:00.000Z");
});

test("V20 history normalisation drops invalid snapshots and preserves rows", () => {
  const result = normaliseCalibrationHistory([
    { snapshotId:"BAD", capturedAt:"bad", rows:[] },
    {
      snapshotId:"OK",
      runId:"R1",
      datasetFingerprint:"D1",
      capturedAt:"2026-09-20T00:00:00.000Z",
      rows:[{ leadId:"L1", probability:0.7, observedSuccess:1, observedAt:"2026-09-19T00:00:00.000Z" }]
    }
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].rows.length, 1);
});

test("V20 snapshot identity is deterministic", () => {
  const input = {
    runId:"R1",
    datasetFingerprint:"D1",
    capturedAt:"2026-09-20T00:00:00.000Z",
    rows:[{ leadId:"L1", probability:0.7, observedSuccess:1, observedAt:"2026-09-19T00:00:00.000Z" }]
  };
  const a = createCalibrationSnapshot(input);
  const b = createCalibrationSnapshot(input);
  assert.equal(a.snapshotId, b.snapshotId);
});

test("V20 snapshot is empty when there are no observed rows", () => {
  assert.equal(createCalibrationSnapshot({
    runId:"R1",
    capturedAt:"2026-09-20T00:00:00.000Z",
    rows:[]
  }), null);
});

test("V20 history append deduplicates snapshot identity", () => {
  const snapshot = createCalibrationSnapshot({
    runId:"R1",
    datasetFingerprint:"D1",
    capturedAt:"2026-09-20T00:00:00.000Z",
    rows:[{ leadId:"L1", probability:0.7, observedSuccess:1, observedAt:"2026-09-19T00:00:00.000Z" }]
  });
  const once = appendCalibrationSnapshot([], snapshot, 3);
  const twice = appendCalibrationSnapshot(once, snapshot, 3);
  assert.equal(once.length, 1);
  assert.equal(twice.length, 1);
});

test("V20 history keeps bounded chronological snapshots", () => {
  const snapshots = Array.from({ length: 5 }, (_, index) =>
    createCalibrationSnapshot({
      runId:"R" + index,
      datasetFingerprint:"D1",
      capturedAt:"2026-09-" + String(10 + index).padStart(2, "0") + "T00:00:00.000Z",
      rows:[{ leadId:"L" + index, probability:0.5, observedSuccess:index % 2, observedAt:"2026-09-" + String(10 + index).padStart(2, "0") + "T00:00:00.000Z" }]
    })
  );
  const result = snapshots.reduce((history, snapshot) =>
    appendCalibrationSnapshot(history, snapshot, 3), []);
  assert.equal(result.length, 3);
  assert.equal(result[0].capturedAt, "2026-09-12T00:00:00.000Z");
});

test("V20 flattening deduplicates identical observed rows", () => {
  const snapshot = createCalibrationSnapshot({
    runId:"R1",
    datasetFingerprint:"D1",
    capturedAt:"2026-09-20T00:00:00.000Z",
    rows:[{ leadId:"L1", probability:0.7, observedSuccess:1, observedAt:"2026-09-19T00:00:00.000Z" }]
  });
  const result = flattenCalibrationHistory([snapshot, snapshot]);
  assert.equal(result.length, 1);
});

function observedRows({
  startDate,
  count,
  probability,
  success,
  segment = "SMB",
  cohort = "2026-Q3"
}) {
  const base = new Date(startDate + "T12:00:00.000Z");
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(base.getTime() + index * 24 * 60 * 60 * 1000);
    return {
      leadId: date.toISOString().slice(0, 10) + "-" + index,
      segment,
      cohort,
      probability,
      observedSuccess: success ? 1 : 0,
      observedAt: date.toISOString()
    };
  });
}

function asForecastOutcomes(rows) {
  return {
    forecastRows: rows.map((row) => ({
      leadId: row.leadId,
      account: row.leadId,
      segment: row.segment,
      cohort: row.cohort,
      probability: row.probability
    })),
    outcomes: rows.map((row) => ({
      leadId: row.leadId,
      terminal: true,
      positive: Boolean(row.observedSuccess),
      type: row.observedSuccess ? "CLOSED_WON" : "CLOSED_LOST",
      occurredAt: row.observedAt
    }))
  };
}

test("V20 first report is insufficient rather than false drift", () => {
  const report = buildAdaptiveCalibrationReport({
    forecastRows: [
      { leadId:"L1", segment:"SMB", cohort:"2026-Q4", probability:0.8 }
    ],
    outcomes:[{ leadId:"L1", terminal:true, positive:true, type:"CLOSED_WON", occurredAt:"2026-10-04T12:00:00.000Z" }],
    now:"2026-10-05T00:00:00.000Z",
    minSamples: 8
  });
  assert.equal(report.baselineEstablished, false);
  assert.equal(report.severity, "INSUFFICIENT");
  assert.equal(report.drift, false);
});

test("V20 stable temporal windows remain stable", () => {
  const previous = observedRows({ startDate:"2026-08-20", count:8, probability:0.5, success:false });
  const current = observedRows({ startDate:"2026-09-20", count:8, probability:0.5, success:false });
  const history = appendCalibrationSnapshot([], createCalibrationSnapshot({
    runId:"PREV",
    datasetFingerprint:"D1",
    capturedAt:"2026-10-01T00:00:00.000Z",
    rows:previous
  }), 36);

  const currentInput = asForecastOutcomes(current);
  const report = buildAdaptiveCalibrationReport({
    ...currentInput,
    history,
    datasetFingerprint:"D1",
    runId:"CURRENT",
    now:"2026-10-05T00:00:00.000Z",
    config:{ minSamples:8 }
  });

  assert.equal(report.global.sampleSufficient, true);
  assert.equal(report.severity, "STABLE");
  assert.equal(report.drift, false);
});

test("V20 warning threshold detects temporal calibration movement", () => {
  const previous = observedRows({ startDate:"2026-08-20", count:8, probability:0.2, success:false });
  const current = observedRows({ startDate:"2026-09-20", count:8, probability:0.9, success:false });

  const history = appendCalibrationSnapshot([], createCalibrationSnapshot({
    runId:"PREV",
    datasetFingerprint:"D1",
    capturedAt:"2026-10-01T00:00:00.000Z",
    rows:previous
  }), 36);

  const currentInput = asForecastOutcomes(current);
  const report = buildAdaptiveCalibrationReport({
    ...currentInput,
    history,
    datasetFingerprint:"D1",
    runId:"CURRENT",
    now:"2026-10-05T00:00:00.000Z",
    config:{ minSamples:8, watchDelta:0.05, warningDelta:0.10, criticalDelta:0.90 }
  });

  assert.equal(report.global.sampleSufficient, true);
  assert.ok(["WATCH","WARNING"].includes(report.severity));
  assert.equal(report.drift, true);
});

test("V20 critical threshold creates controlled recalibration recommendation", () => {
  const previous = observedRows({ startDate:"2026-08-20", count:8, probability:0.1, success:false });
  const current = observedRows({ startDate:"2026-09-20", count:8, probability:0.95, success:false });

  const history = appendCalibrationSnapshot([], createCalibrationSnapshot({
    runId:"PREV",
    datasetFingerprint:"D1",
    capturedAt:"2026-10-01T00:00:00.000Z",
    rows:previous
  }), 36);

  const currentInput = asForecastOutcomes(current);
  const report = buildAdaptiveCalibrationReport({
    ...currentInput,
    history,
    datasetFingerprint:"D1",
    runId:"CURRENT",
    now:"2026-10-05T00:00:00.000Z",
    config:{ minSamples:8, criticalDelta:0.20 }
  });

  assert.equal(report.severity, "CRITICAL");
  assert.ok(report.recommendations.some((item) => item.code === "CONTROLLED_RECALIBRATION"));
});

test("V20 segment drift is surfaced separately", () => {
  const previous = [
    ...observedRows({ startDate:"2026-08-20", count:8, probability:0.5, success:false, segment:"SMB" }),
    ...observedRows({ startDate:"2026-08-20", count:8, probability:0.5, success:false, segment:"Enterprise" })
  ];
  const current = [
    ...observedRows({ startDate:"2026-09-20", count:8, probability:0.5, success:true, segment:"SMB" }),
    ...observedRows({ startDate:"2026-09-20", count:8, probability:0.5, success:false, segment:"Enterprise" })
  ];

  const history = appendCalibrationSnapshot([], createCalibrationSnapshot({
    runId:"PREV",
    datasetFingerprint:"D1",
    capturedAt:"2026-10-01T00:00:00.000Z",
    rows:previous
  }), 36);

  const report = buildAdaptiveCalibrationReport({
    history,
    datasetFingerprint:"D1",
    runId:"CURRENT",
    now:"2026-10-05T00:00:00.000Z",
    config:{ minSamples:8, minGroupSamples:5 }
  });

  const smb = report.segments.find((item) => item.value === "SMB");
  assert.equal(smb.drift, true);
  assert.equal(smb.severity, "CRITICAL");
});

test("V20 cohort drift can be distinguished from segment drift", () => {
  const previous = observedRows({ startDate:"2026-08-20", count:8, probability:0.5, success:false, segment:"SMB", cohort:"A" });
  const current = observedRows({ startDate:"2026-09-20", count:8, probability:0.5, success:true, segment:"SMB", cohort:"B" });

  const history = appendCalibrationSnapshot([], createCalibrationSnapshot({
    runId:"PREV",
    datasetFingerprint:"D1",
    capturedAt:"2026-10-01T00:00:00.000Z",
    rows:previous
  }), 36);

  const report = buildAdaptiveCalibrationReport({
    history,
    datasetFingerprint:"D1",
    runId:"CURRENT",
    now:"2026-10-05T00:00:00.000Z",
    config:{ minSamples:8, minGroupSamples:5 }
  });

  assert.ok(report.cohorts.some((item) => item.value === "B"));
  assert.equal(report.segments.some((item) => item.value === "SMB" && item.drift), true);
});

test("V20 audit trail captures snapshot, baseline and drift state", () => {
  const previous = observedRows({ startDate:"2026-08-20", count:8, probability:0.1, success:false });
  const current = observedRows({ startDate:"2026-09-20", count:8, probability:0.95, success:false });

  const history = appendCalibrationSnapshot([], createCalibrationSnapshot({
    runId:"PREV",
    datasetFingerprint:"D1",
    capturedAt:"2026-10-01T00:00:00.000Z",
    rows:previous
  }), 36);

  const currentInput = asForecastOutcomes(current);
  const report = buildAdaptiveCalibrationReport({
    ...currentInput,
    history,
    datasetFingerprint:"D1",
    runId:"CURRENT",
    now:"2026-10-05T00:00:00.000Z",
    config:{ minSamples:8 }
  });

  assert.ok(report.auditTrail.some((event) => event.type === "CALIBRATION_SNAPSHOT_RECORDED"));
  assert.ok(report.auditTrail.some((event) => event.type === "CALIBRATION_BASELINE_STATUS"));
  assert.ok(report.auditTrail.some((event) => event.type === "CALIBRATION_DRIFT_ALERT"));
});

test("V20 report remains deterministic for identical supplied time", () => {
  const previous = observedRows({ startDate:"2026-08-20", count:8, probability:0.5, success:false });
  const history = appendCalibrationSnapshot([], createCalibrationSnapshot({
    runId:"PREV",
    datasetFingerprint:"D1",
    capturedAt:"2026-10-01T00:00:00.000Z",
    rows:previous
  }), 36);

  const currentInput = asForecastOutcomes([]);
  const args = {
    ...currentInput,
    history,
    datasetFingerprint:"D1",
    runId:"CURRENT",
    now:"2026-10-05T00:00:00.000Z",
    config:{ minSamples:8 }
  };

  const a = buildAdaptiveCalibrationReport(args);
  const b = buildAdaptiveCalibrationReport(args);

  assert.deepEqual(a.global, b.global);
  assert.equal(a.reportId, b.reportId);
  assert.deepEqual(a.recommendations, b.recommendations);
});

test("V20 current window includes outcomes observed exactly at the evaluation boundary", () => {
  const current = observedRows({
    startDate:"2026-09-20",
    count:8,
    probability:0.5,
    success:false
  });
  const input = asForecastOutcomes(current);
  const report = buildAdaptiveCalibrationReport({
    ...input,
    datasetFingerprint:"D1",
    runId:"CURRENT",
    now:"2026-09-28T12:00:00.000Z",
    config:{ minSamples:8 }
  });
  assert.equal(report.currentWindow.records, 8);
  assert.equal(report.global.current.records, 8);
});

test("V20 ignores calibration history from another dataset", () => {
  const foreign = observedRows({
    startDate:"2026-08-20",
    count:8,
    probability:0.1,
    success:false
  });
  const history = appendCalibrationSnapshot([], createCalibrationSnapshot({
    runId:"FOREIGN",
    datasetFingerprint:"FOREIGN-DATASET",
    capturedAt:"2026-09-01T00:00:00.000Z",
    rows:foreign
  }), 36);

  const report = buildAdaptiveCalibrationReport({
    datasetFingerprint:"LOCAL-DATASET",
    runId:"CURRENT",
    now:"2026-10-05T00:00:00.000Z",
    history,
    config:{ minSamples:8 }
  });

  assert.equal(report.previousWindow.records, 0);
  assert.equal(report.severity, "INSUFFICIENT");
});

test("V20 history does not grow on an identical snapshot", () => {
  const previous = observedRows({ startDate:"2026-08-20", count:8, probability:0.5, success:false });
  const history = appendCalibrationSnapshot([], createCalibrationSnapshot({
    runId:"R1",
    datasetFingerprint:"D1",
    capturedAt:"2026-10-01T00:00:00.000Z",
    rows:previous
  }), 36);

  const report = buildAdaptiveCalibrationReport({
    history,
    datasetFingerprint:"D1",
    runId:"R1",
    now:"2026-10-01T00:00:00.000Z",
    config:{ minSamples:8 }
  });

  assert.equal(report.nextHistory.length, 1);
});
