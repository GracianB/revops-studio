# RevOps Studio

**Customer Success × Data × Operations × AI × Systems**

RevOps Studio is the public lab of Gracián Baena González. It is both a commercial surface and a technical proof: a small RevOps system whose operating logic is inspectable instead of being hidden behind a glossy interface.

Live: https://gracianb.github.io/revops-studio/  
Source: https://github.com/GracianB/revops-studio

## Technical layer

The site includes a local Pipeline Model Lab and an executive intelligence layer.

\`\`\`
synthetic records
      ↓
data-quality validation
      ↓
weighted scoring
      ↓
classification
      ↓
next action
      ↓
human approval gate
      ↓
audit event
\`\`\`

Visitors can change model weights, switch scenarios, inspect per-record explanations, import a compatible CSV locally, export a run as JSON, and inspect the resulting operational queue. The demo is deterministic and does not call a CRM, database or external API.

## Architecture

\`\`\`
Browser
  │
  ├── index.html
  ├── CSS
  ├── application controller
  └── deterministic RevOps engine
          │
          ├── score
          ├── classify
          ├── recommend
          ├── gate
          └── audit

Brief:
Form → sessionStorage → gracias.html → user-controlled email
\`\`\`

## Model impact

The active model can be compared with the baseline weights to expose promotions, demotions, blocked records and score deltas. This turns the scoring controls into a visible sensitivity test.

## Operational queue

The control room translates pipeline state into a deterministic work queue with priority, operational lane, SLA and a reason for the proposed action. V9 adds a commercial operating layer on top of the V8 cockpit: pipeline value, weighted pipeline, stale-risk signals, owner/segment views and local operator filters. It is deliberately simulation-only: no CRM, no database and no external execution.

## Engineering decisions

### Explainability

The engine exposes the contribution of each signal to the final score.

### Data quality

Records are validated before scoring. Invalid records fail closed into a blocked state rather than receiving a misleading score.

### Human-in-the-loop

Classification and execution are separate. Sensitive transitions require explicit approval.

### Decision surface

The public UI exposes the score, threshold profile, scenario impact, operational queue and run identity. Configuration can be shared through a URL without embedding CSV records.

### Local-first lead flow

The public brief is stored only in the current browser session. No project backend receives the form fields.

### Small dependency surface

The project uses browser-native HTML, CSS and JavaScript plus Node's built-in test runner.

## Offer

| Package | From | Window |
| --- | ---: | --- |
| Quick win | €900 | 1–2 weeks |
| System | €4,000 | 3–6 weeks |
| Operate | €600/month | when the system exists |

Diagnostic: 30–45 minutes, one process.

## Proof ecosystem

- OHANA · Canvas 2D platformer, Isla Hoku, 10 rooms, 10 characters.
- Vortex · WebGL interface experiment.
- AiGoritmo · Python + FastAPI / LLM lab.
- Yoga Instructor · bilingual ES/EN portal.
- Navarmedia Outreach · private B2B operations core.

## Architecture notes

The Control Room also keeps a local history of run configuration and summary metrics for reproducibility. Dataset rows are never stored in that history. Optional commercial context can be imported without changing the core qualification model. See docs/OPERATING_MODEL.md for the complete decision loop and Control Room design.

## Quality gates

\`\`\`bash
npm test
npm run validate
\`\`\`

GitHub Actions runs both checks on every push and pull request.

## Security

No secrets are intentionally stored in the repository. Validation includes lightweight credential-pattern screening and project-structure checks.

Pattern screening is not a guarantee of absolute absence.

## Author

Gracián Baena González · Murcia, Spain  
LinkedIn: https://www.linkedin.com/in/gracianbaena/  
GitHub: https://github.com/GracianB


## V11 · Executive Intelligence

V11 adds a deterministic decision surface above the existing scoring and forecast layers:

```
score → stage → commercial context
                     ↓
              forecast scenarios
                     ↓
       segment / cohort intelligence
                     ↓
          account health scoring
                     ↓
       business rules + anomalies
                     ↓
           revenue leakage
                     ↓
        executive priorities
```

The new layer remains local and network-free. It does not execute CRM actions. It identifies material risk, operational exposure, concentration, stale context and high-value opportunities so a human can decide what happens next.

The CSV can optionally include `cohort` for cohort analysis.

Quality target for V11: **40 deterministic tests, zero external runtime dependencies, structural validation PASS**.


## V12 · Hiring Manager Mode

V12 adds a recruiter-first proof surface to the public experience.

The first screen now answers three questions before a visitor touches the playground:

1. What role does this project demonstrate?
2. What was actually built?
3. Where can the reviewer verify the work?

The proof surface links the positioning, RevOps Studio itself, the wider public project ecosystem and the Professional Deck / LinkedIn. It is deliberately evidence-first: no invented business results, no fake enterprise integrations and no claims that cannot be inspected.

The Control Room remains the main technical proof. V12 changes the route into it, not the underlying decision engine.


## V13 · 60-second proof

V13 adds a guided proof path for fast technical review.

The Control Room now includes a four-step narrative:

```
baseline
   ↓
model impact
   ↓
forecast stress
   ↓
executive decision
```

The operator can replay the path without loading another environment. Each step points at an existing system surface and uses the same local deterministic engine.

V13 also adds an executive readout that turns the current run into a compact evidence-based brief with key facts, recommended actions, top owner and top segment. The brief can be copied without sending data to a backend.
