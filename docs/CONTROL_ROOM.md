# RevOps Control Room

The public playground is deliberately closer to a small operating system than a static chart.

## Inputs

The demo supports two sources:

1. synthetic records shipped with the page;
2. a user-selected CSV read locally in the browser.

Required CSV columns:

```
id, account, fit, intent, engagement, urgency
```

No uploaded file is sent to a server.

## Decisions

The model exposes four tunable signals:

- fit
- intent
- engagement
- urgency

Weights are normalised before scoring.

The pipeline then derives:

```
score → stage → next action
```

## Controls

Scenario presets let the visitor simulate different business priorities. The table supports per-record inspection. The run can be exported as a JSON artifact for inspection.

## Safety

The technical playground contains no real lead data, secrets, CRM calls or network execution.

The human gate is explicit: classification does not automatically grant permission to perform sensitive transitions.


## v5: operational queue

The control room now adds an operational layer after classification:

```
data
  ↓
quality
  ↓
score
  ↓
stage
  ↓
priority
  ↓
lane + SLA
  ↓
execution queue
```

The queue is still a simulation. It never calls a CRM or executes an external action.

Policy used by the demo:

| Stage | Priority | Lane | SLA |
| --- | --- | --- | ---: |
| blocked | critical | Data / RevOps | 2h |
| qualified | high | Sales / CS | 4h |
| nurture | medium | Lifecycle | 24h |
| new | low | RevOps | 72h |

Ordering combines stage priority with score and urgency. Each queue item also exposes the strongest scoring contribution or, for blocked data, the validation error.

The queue accepts an explicit timestamp in the engine so its SLA output can be tested deterministically.


## v6: model impact

The Control Room now compares the active run with the baseline model:

```
baseline weights → current weights → stage deltas
```

The comparison surfaces:

- changed records;
- promotions;
- demotions;
- newly blocked records;
- per-record score deltas.

This makes the sliders operationally meaningful: a visitor can see the downstream effect of changing priorities instead of only seeing a new aggregate score.


## v7: cockpit controls

### Thresholds

Stage thresholds are configurable separately from scoring weights:

- qualified threshold;
- nurture threshold.

The engine rejects invalid threshold relationships and keeps classification deterministic.

### Scenario matrix

All four presets are evaluated side by side against the same records so the operator can compare the operational shape of each priority model without repeatedly clicking between presets.

### Configuration identity

Each run receives a deterministic run ID derived from the dataset, weights, thresholds and selected scenario.

### Shareable configuration

The Control Room can encode only configuration in the URL. Imported CSV rows are deliberately excluded.

### Queue search and keyboard controls

The execution queue can be filtered locally. The public demo also exposes two small keyboard shortcuts:

- R: run the model;
- /: focus queue search.

### Guarded CSV ingestion

CSV input supports comma or semicolon delimiters and quoted multiline fields. The parser rejects malformed quotes, duplicate headers, oversized files and excessive row counts before evaluation.

## v9: commercial pulse

The Control Room can now use optional commercial context:

    value, owner, segment, source, last_touch_days

These fields are intentionally separate from the qualification score.

The dashboard exposes:

- active pipeline value;
- weighted pipeline value;
- qualified value;
- stale account count/rate;
- context coverage;
- segment distribution;
- owner distribution.

For the synthetic dataset, these values are illustrative.

A record with `last_touch_days > 14` is treated as stale. Staleness raises operational queue priority but does not modify the qualification score.

The pipeline table also supports local stage filtering and a stale-only view.