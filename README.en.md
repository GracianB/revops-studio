# RevOps Studio

**Customer Success × Data × Operations × AI × Systems**

RevOps Studio is the public lab of **Gracián Baena González**: a small, real project used to demonstrate how customer understanding, operations, data and technical execution can become one system.

Live: **https://gracianb.github.io/revops-studio/**  
Source: **https://github.com/GracianB/revops-studio**

## Architecture

The site is intentionally framework-free and static:

\`\`\`text
Browser
  │
  ├── HTML
  ├── CSS
  ├── JavaScript
  │
  ├── calculator
  ├── service filters
  ├── navigation state
  └── brief
        │
        ├── sessionStorage
        └── thanks page
              ├── local mailto
              ├── copy
              └── calendar
\`\`\`

The brief fields are not posted to a backend. The user reviews the generated email and decides whether to send it.

Plausible is used for anonymous interaction events only.

## Why this exists

The project is both a commercial surface and a portfolio proof.

It demonstrates:

- systems thinking;
- Customer Success and operations context;
- frontend execution;
- data framing;
- automation logic;
- accessibility and progressive enhancement;
- GitHub-based delivery and validation.

## Offer

| Package | From | Window |
| --- | ---: | --- |
| Quick win | €900 | 1–2 weeks |
| System | €4,000 | 3–6 weeks |
| Operate | €600/month | when the system exists |

Diagnostic: **30–45 minutes, one process**.

## Proof ecosystem

- OHANA · Canvas 2D platformer.
- Vortex · WebGL interface experiment.
- AiGoritmo · Python + FastAPI / LLM lab.
- Yoga Instructor · bilingual ES/EN portal.
- Navarmedia Outreach · private B2B operations core.

## Development

No framework is required.

Validation:

\`\`\`bash
node --check assets/js/app.js
node --check assets/js/thanks.js
\`\`\`

GitHub Actions additionally checks required files and common credential patterns.

## Author

Gracián Baena González · Murcia, Spain  
LinkedIn: https://www.linkedin.com/in/gracianbaena/  
GitHub: https://github.com/GracianB
