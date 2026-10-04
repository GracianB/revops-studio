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
