# RevOps Studio

**Customer Success × Data × Operations × AI × Systems**

RevOps Studio is the public-facing lab of **Gracián Baena González**: a small, real project used to demonstrate how customer understanding, operational design, data and technical execution can become one system.

Live: **https://gracianb.github.io/revops-studio/**  
Source: **https://github.com/GracianB/revops-studio**

## What this project is

This repository is deliberately public and deliberately small.

The website acts as:

- a service surface for a concrete operations problem;
- a portfolio proof of product and frontend execution;
- a transparent example of client-side state, analytics and controlled handoff;
- a hub connecting the wider project ecosystem.

The commercial language and the technical implementation are meant to describe the same idea:

> understand the process → design the system → build the necessary piece → leave ownership and measurement behind.

## Technical playground

The public site now includes a deterministic RevOps engine demo using synthetic records. It makes scoring, state classification, human approval and auditability visible in the browser.

See [`docs/REVOPS_ENGINE.md`](docs/REVOPS_ENGINE.md) for the domain rules.

## Current architecture

\`\`\`text
Browser
  │
  ├── Static HTML
  ├── Local CSS
  ├── Local JavaScript
  │
  ├── Calculator
  ├── Service filters
  ├── Accessibility / navigation
  └── Brief flow
        │
        ├── sessionStorage (this tab only)
        │
        └── gracias.html
              ├── mailto generated locally
              ├── copy brief
              └── calendar
\`\`\`

Analytics uses Plausible only for event-level interaction signals. The public page does **not** send the brief fields to a project backend.

That is intentional for this version: a static GitHub Pages project, with explicit user-controlled email delivery, is simpler and safer than pretending a fake CRM backend is impressive.

## Technical decisions

### 1. No framework dependency

The project uses HTML, CSS and JavaScript directly. The goal is maintainability, fast loading and visible fundamentals.

### 2. Local-first brief flow

The form is stored in \`sessionStorage\` under a versioned key. Nothing is sent to an API from the page.

The user reviews the generated email and chooses whether to send it.

### 3. No invented ROI

The calculator estimates annual process friction from:

\`hours × people × hourly cost × 52\`

It is a framing tool, not a savings guarantee.

### 4. Progressive enhancement

The important content exists as HTML. JavaScript adds navigation state, filters, calculator behavior, reveal motion and the brief flow.

Reduced-motion preferences disable decorative motion.

### 5. Small security surface

There are no API keys, private tokens or server credentials in the repository.

The current build adds a static secret-pattern check to GitHub Actions.

## Offer

| Package | From | Typical window |
| --- | ---: | --- |
| Quick win | €900 | 1–2 weeks |
| System | €4,000 | 3–6 weeks |
| Operate | €600/month | when the system exists |

The diagnostic is **30–45 minutes, one process**. Pricing is confirmed in writing after the diagnostic.

## Proof

### Bodytone

Product support and knowledge organization. The public proof is the Help Center. No hours-saved figure is claimed here because it has not been measured on this page.

### Private system

**Navarmedia Outreach** remains private. The website exposes the system surface and architectural concepts without publishing proprietary source code.

### Public ecosystem

- **OHANA** · Canvas 2D platformer, Isla Hoku, 10 rooms, 10 characters.
- **Vortex** · WebGL interface experiment.
- **AiGoritmo** · Python + FastAPI / LLM lab.
- **Yoga Instructor** · bilingual ES/EN practice portal.
- **Business Intelligence** · analytics and dashboard work.

## Files

\`\`\`text
revops-studio/
├── index.html
├── gracias.html
├── README.md
├── README.en.md
├── robots.txt
├── sitemap.xml
├── .well-known/
│   └── security.txt
├── .github/
│   └── workflows/
│       └── validate.yml
├── assets/
│   ├── favicon.svg
│   ├── css/
│   │   └── main.css
│   └── js/
│       ├── app.js
│       └── thanks.js
└── docs/
    ├── ARCHITECTURE.md
    └── SECURITY.md
\`\`\`

## Author

Gracián Baena González · Murcia, España  
LinkedIn: https://www.linkedin.com/in/gracianbaena/  
GitHub: https://github.com/GracianB
