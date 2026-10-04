# RevOps Studio

**Customer Success × Data × Operations × AI × Systems**

RevOps Studio is the public lab of Gracián Baena González. It is both a commercial surface and a technical proof: a small RevOps system whose operating logic is inspectable instead of being hidden behind a glossy interface.

Live: https://gracianb.github.io/revops-studio/  
Source: https://github.com/GracianB/revops-studio

## Technical layer

The site includes a local Pipeline Model Lab.

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

Visitors can change model weights and inspect how the pipeline changes. The demo is deterministic and does not call a CRM, database or external API.

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

## Engineering decisions

### Explainability

The engine exposes the contribution of each signal to the final score.

### Data quality

Records are validated before scoring. Invalid records fail closed into a blocked state rather than receiving a misleading score.

### Human-in-the-loop

Classification and execution are separate. Sensitive transitions require explicit approval.

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
