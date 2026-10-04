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
