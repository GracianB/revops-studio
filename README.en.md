## V41 public services website / V40 technical engine

The public website now focuses on operational problems, defined deliverables, documented experience, indicative pricing and contact. Theme choices persist where browser storage permits. The technical Control Room remains isolated in `laboratorio.html`.

Contact uses FormSubmit AJAX on a static GitHub Pages site. **The recipient must complete FormSubmit's one-time activation email before delivery can be considered verified.** Errors reveal a populated mailto fallback, and the existing booking calendar remains available. The contact form explains third-party processing and requires the visitor's consent. See `privacidad.html`.

---

# RevOps Studio

**Customer Success × Data × Operations × AI × Systems**

RevOps Studio is the public services showcase and technical laboratory of **Gracián Baena González**. The commercial offer is process automation, operational dashboards and custom internal tools for SMEs and operational teams. The V40 Control Room is a secondary, simulation-only proof of technical execution, not the product being sold.

Live: **https://gracianb.github.io/revops-studio/**  
Source: **https://github.com/GracianB/revops-studio**

## Public proof versus private projects

The commercial site links three documented works: Bodytone Support OS (public Help Center), a 200+ rules quoting system (private core) and a context-aware outbound automation case (private core). Technical scope is evidenced; revenue impact or customer savings are not claimed. The V40 demo lives on a distinct page and uses synthetic data.

## Commercial entry points

1. Identify the problem: repeated manual work, unreliable reporting or scattered knowledge.
2. Choose a service: automation, data/BI or custom software with appropriately scoped AI.
3. Review indicative engagement models (from €900 project, €4,000 system, €600/month continuity).
4. Prepare a local brief, review the email and send it yourself. The form does not submit to a server.

Do not mistake the technical laboratory for a production SaaS or an integrated CRM. Customer results and savings are never invented.

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

## Control Room

The public playground is a local decision cockpit, not a decorative chart.

```text
input → quality gate → scoring → classification
     → impact analysis → priority/SLA queue
     → human approval → audit
```

It supports:

- configurable model weights;
- configurable stage thresholds;
- four operating scenarios;
- baseline sensitivity comparison;
- per-record explanations;
- local CSV ingestion with size/row guards;
- operational queue with priority, owner lane and SLA;
- deterministic run identity;
- shareable configuration URLs that never embed CSV records;
- JSON run export.

The Control Room remains simulation-only. It has no CRM, database or external execution layer.

See docs/OPERATING_MODEL.md for the full operating model.


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
