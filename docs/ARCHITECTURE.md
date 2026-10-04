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

## V15 · Operational Workflow Control

V15 adds an orchestration layer without changing the deterministic core:

```text
current run
   ↓
buildRunAnalysis
   ↓
Decision Trace
   ↓
buildOperationalPlan
   ├─ ranked work
   ├─ SLA
   ├─ approval state
   └─ execution state
        ↓
execution envelope
        ↓
adapter boundary (NOT_CONNECTED)
```

The workflow plan is still a pure local calculation. It does not perform network requests.

`buildRunArtifact()` exports the run contract without raw records. It includes a dataset fingerprint, configuration, aggregate analysis, workflow plan and decision outcomes. `verifyRunArtifact()` checks the fingerprint and record count against the currently loaded dataset.

`assets/js/execution-adapter.js` is deliberately small. It validates the handoff contract and returns `NOT_EXECUTED / SIMULATION_ONLY` rather than pretending that a CRM integration exists.

## V16 · Workflow replay and impact

V16 adds a pure preview layer between the operational plan and an eventual external adapter:

```text
Decision Trace
    ↓
Operational Plan
    ↓
Impact Preview
    ↓
Human Approval
    ↓
Integration Contract
    ↓
External Adapter boundary
```

`buildWorkflowImpact()` projects stage changes without mutating the loaded dataset. Non-sensitive proposals can be projected; sensitive transitions remain pending unless an explicit approval set is supplied.

`buildActionDigest()` and `buildDecisionDigest()` provide stable workflow and decision identities that survive rerendering while excluding volatile timestamps from the workflow digest.

`buildReplayReport()` combines dataset fingerprint, workflow digest and decision integrity into one replay result.
