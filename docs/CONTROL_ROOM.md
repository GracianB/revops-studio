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
