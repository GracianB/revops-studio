# Architecture

## Goal

RevOps Studio is a static portfolio/service application. Its technical job is not to become a full CRM. Its job is to show disciplined product thinking around a real lead flow.

## Components

### Presentation

- \`index.html\`
- semantic sections
- accessible navigation
- calculator
- service filtering
- contact form

### Behavior

- \`assets/js/app.js\`
- menu state
- reduced-motion aware reveal
- navigation state
- service filtering
- friction calculator
- local brief storage
- analytics event dispatch

### Handoff

- \`gracias.html\`
- \`assets/js/thanks.js\`
- generated mailto
- copy-to-clipboard
- calendar link

## Data boundary

The browser is the trust boundary.

\`\`\`text
Form
  ↓
FormData
  ↓
sessionStorage
  ↓
Thanks page
  ↓
mailto URL
  ↓
User's mail client
\`\`\`

There is no direct API call carrying the brief.

## Analytics boundary

Plausible receives only event names and small contextual properties such as the click location.

No form field is passed to analytics.

## Deployment

The repository is compatible with GitHub Pages because it has no build step.

The GitHub Actions workflow performs static validation on pushes and pull requests. It does not need deployment credentials.

## Design principle

Use the smallest architecture that gives the user a reliable outcome.

That is the same principle the project sells.


## Technical engine

The public playground now uses a deterministic engine with weighted scoring, data-quality validation, explainability, a state machine, a human approval gate and audit events. The engine is covered by Node's built-in test runner.


## V11 intelligence architecture

The deterministic engine is layered so commercial analysis does not contaminate qualification logic:

```
Core scoring
    ↓
Commercial context
    ↓
Forecast
    ↓
Intelligence functions
 ├─ account health
 ├─ segment intelligence
 ├─ cohort analysis
 ├─ business rules
 ├─ anomaly detection
 └─ revenue leakage
    ↓
Executive decision surface
```

All intelligence functions are pure calculations over the current in-browser dataset. They return structured objects that the UI renders using DOM text nodes, avoiding HTML injection from imported CSV values.

Forecast multipliers are normalized separately from stage probabilities, so values above 100% such as a 115% upside assumption remain representable and reproducible in run identity.


## V13 interaction architecture

V13 adds a presentation layer without changing the core trust boundary:

```
Current evaluated run
      ↓
Executive Intelligence
      ↓
Executive Brief
      ↓
Guided proof navigation
      ↓
Human review
```

The guided path deliberately operates on the same dataset and configuration used by the Control Room. This prevents a separate demo state from drifting away from the actual engine.

The executive brief is generated from structured engine output and rendered with DOM text nodes. Clipboard export is user initiated.


## V14 decision architecture

V14 introduces a reusable run-analysis contract and an explicit execution boundary:

Source records
    ↓
evaluateBatch
    ↓
buildRunAnalysis
 ├─ pipeline
 ├─ commercial
 ├─ forecast / scenarios
 ├─ health
 ├─ segments / cohorts
 ├─ rules / anomalies / leakage
 ├─ owners
 └─ executive brief
    ↓
UI surfaces
 ├─ Executive Readout
 ├─ Owner Operating Matrix
 └─ Decision Trace
    ↓
Human Gate
    ↓
Simulation-only execution boundary
    ↓
Audit events

The analysis contract reuses the same forecast and intelligence results across dependent layers. The execution boundary remains a UI-visible contract rather than a hidden fake integration.
