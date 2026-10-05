# RevOps Studio

**A deterministic Revenue Operations decision system built around data quality, explainability, human approval and replay-verifiable policy lineage.**

[![Live](https://img.shields.io/badge/LIVE-DAA428?style=for-the-badge)](https://gracianb.github.io/revops-studio/)
[![Tests](https://img.shields.io/badge/TESTS-150%2B-7AF3FF?style=for-the-badge)](https://github.com/GracianB/revops-studio/actions)
[![JavaScript](https://img.shields.io/badge/JavaScript-181717?style=for-the-badge&logo=javascript)](https://github.com/GracianB/revops-studio)

RevOps Studio is the public technical proof behind a broader operating idea:

> **Customer data should not only describe the pipeline. It should help an operator decide what happens next.**

It is intentionally inspectable. The public application runs locally in the browser, uses deterministic logic, does not require a CRM, database or external API, and keeps consequential execution behind a human boundary.

**Live:** https://gracianb.github.io/revops-studio/  
**Source:** https://github.com/GracianB/revops-studio

---

## The decision loop

```text
Records
   ↓
Data-quality validation
   ↓
Weighted scoring
   ↓
Classification
   ↓
Commercial context
   ↓
Recommended action
   ↓
Human approval gate
   ↓
Decision Trace / audit
```

The important part is not the score.

The important part is the contract between **data → reasoning → recommendation → human decision**.

---

## What the system demonstrates

### Data quality

Records are validated before scoring.

Invalid or incomplete records can fail closed into a blocked state instead of receiving a misleading score.

### Deterministic scoring

Signals contribute explicitly to the final score.

The active model exposes score contributions, thresholds and deltas so an operator can understand **why** a record moved.

### Classification

The engine turns score and context into an operational state rather than leaving the user with another dashboard.

### Forecasting

Forecast scenarios aggregate exact expected value before rounding, allowing baseline and stressed cases to be compared consistently.

### Segmentation & account health

The intelligence layer exposes owner, segment, cohort and account-health signals to identify concentration, stale context, material risk and opportunities.

### Revenue leakage

The system surfaces operational exposure such as stale pipeline, risk concentration and other rule-based leakage signals.

### Executive priorities

The control room turns model output into a ranked decision surface instead of a collection of disconnected charts.

### Decision Trace

Each run can expose the chain:

```text
input
 → quality
 → score
 → commercial context
 → risk
 → proposal
 → approval boundary
 → execution boundary
```

This makes the model inspectable instead of magical.

### V15 · Operational Workflow Control

V15 extends the Decision Operating System from **traceable decisions** to a **traceable operating plan**.

The workflow layer creates a deterministic plan from the current run:

```text
decision trace
   ↓
operational plan
   ↓
approval state
   ↓
execution envelope
   ↓
adapter boundary
```

Every planned action exposes rank, owner lane, SLA, proposal, approval state and execution state. The public adapter is intentionally disconnected, so the plan can be simulated without pretending to write to a CRM.

V15 also adds a privacy-preserving run artifact. It contains run identity, dataset fingerprint, configuration, aggregate intelligence and decision outcomes, but does not export the raw records.

A replay check can verify that an artifact belongs to the dataset currently loaded in the browser.
---

## V22 · Policy integrity

V22 extends the controlled recalibration layer with a stricter policy contract:

```text
V20 recommendation
   ↓
V21 proposal
   ↓
V22 replay binding
   ↓
explicit approval
   ↓
versioned policy instance
   ↓
bounded effective forecast
```

The approved policy stays within an absolute ±0.15 multiplier from the base policy. The proposal carries a deterministic replay fingerprint and approval verifies that fingerprint together with the replay record count, multiplier and Brier improvement.

This is a tamper-evident consistency layer for the local browser workflow, not a cryptographic trust boundary.

## V23 · Proof-bound policy integrity

V23 extends the controlled recalibration layer by binding approval to the observed outcome rows that produced the replay.

```text
observed outcomes
   ↓
row fingerprint
   ↓
replay calculation
   ↓
replay fingerprint
   ↓
explicit approval
   ↓
bounded policy instance
```

Approval is fail-closed unless the supplied rows reproduce the proposal's evidence fingerprint, record count, Brier values and replay fingerprint. Approved ledger entries also require a dataset scope and bounded multiplier.

This is a deterministic evidence-consistency layer for the local browser workflow, not a cryptographic trust boundary.

## V25 · Policy lineage replay

V25 adds a deterministic verification layer over the governed policy ledger:

```text
policy proposal
   ↓
approval event
   ↓
policy instance
   ↓
historical ledger replay
   ↓
active-policy replay against current evidence
   ↓
VERIFIED / REJECTED
```

The system can now verify the complete policy history for a dataset scope, detect forged policy identities, reject invalid rollback events and replay the active policy against the exact observed evidence currently loaded.

The Control Room exposes separate states for proposal integrity, historical ledger replay and active-policy replay. This makes a previously approved policy inspectable after the fact instead of treating the local ledger as inherently trustworthy.

V25 remains a deterministic local-first control layer. The operator identity is still an assertion stored locally, not authentication, and the ledger fingerprints are tamper-evident rather than cryptographic proof.

## Human-in-the-loop by design

RevOps Studio deliberately separates **recommendation** from **execution**.

A sensitive simulated transition requires explicit approval.

There is no hidden CRM write, no fake integration and no claim of autonomous execution.

That boundary matters.

AI and automation should reduce operational work without silently removing accountability.

---

## Local-first architecture

```text
Browser
│
├── index.html
├── application controller
├── CSS / UI
├── CSV utilities
└── deterministic RevOps engine
      │
      ├── validate
      ├── score
      ├── classify
      ├── forecast
      ├── segment
      ├── recommend
      ├── gate
      └── audit
```

The public application can:

- change model weights;
- switch scenarios;
- inspect record-level explanations;
- import a compatible CSV locally;
- export a run as JSON;
- compare baseline vs active model;
- inspect operational queues;
- inspect decision traces;
- generate an executive readout.

No external runtime service is required.

---

## Engineering principles

| Principle | Implementation |
|---|---|
| **Fail closed** | Invalid records are blocked rather than silently scored |
| **Explainability** | Score contributions and model deltas are visible |
| **Determinism** | Same inputs and configuration produce reproducible output |
| **Human accountability** | Sensitive transitions require explicit approval |
| **Local-first** | Demo data and CSV analysis remain in the browser |
| **Small dependency surface** | Browser-native stack + Node test runner |
| **Auditability** | Decision Trace records the reasoning boundary |
| **Testability** | Engine, contracts and structural behaviour are covered by deterministic tests |

---

## Quality gates

```bash
npm test
npm run validate
npm run verify
```

The repository includes automated validation for:

- engine behaviour;
- CSV contracts;
- score reconciliation;
- exact forecast aggregation;
- run analysis;
- Decision Trace;
- DOM contracts;
- guided proof surfaces;
- project structure;
- JavaScript syntax.

GitHub Actions runs the core quality gates on pushes and pull requests.

---

## Hiring-manager mode

The public experience is designed to answer three questions quickly:

1. **What capability does this project demonstrate?**
2. **What was actually built?**
3. **Where can the reviewer verify it?**

The proof is intentionally evidence-first.

No invented enterprise integrations.  
No fake business results.  
No hidden backend pretending to be production.

---

## Proof ecosystem

| Project | Demonstrates |
|---|---|
| [Bodytone Support OS](https://bodytonehelp.zendesk.com/hc/es) | Customer Operations, Zendesk, workflows, automation |
| [Professional Deck](https://gracianb.github.io/professional-deck/) | Customer Success, Data, Operations, career evidence |
| [Project OHANA](https://github.com/GracianB/project-ohana) | Software engineering, simulation, testing, CI |
| [Vórtice](https://github.com/GracianB/vortex) | WebGL, rendering, interaction |
| [AiGoritmo](https://github.com/GracianB/aigoritmo) | Python, FastAPI, local AI |
| [Systems Lab](https://github.com/GracianB/systems-lab) | Public systems experiments |

---

## Commercial surface

RevOps Studio also exposes a deliberately simple service model for organisations that want to turn one operational bottleneck into a measurable system.

| Package | From | Typical window |
|---|---:|---:|
| Quick win | €900 | 1–2 weeks |
| System | €4,000 | 3–6 weeks |
| Operate | €600/month | after the system exists |

These are positioning examples, not claims of delivered revenue impact.

---

## Author

**Gracián Baena González** · Murcia, Spain

Customer Success · RevOps · Data · Automation · AI · Systems

[LinkedIn](https://www.linkedin.com/in/gracianbaena) · [GitHub](https://github.com/GracianB) · [Professional Deck](https://gracianb.github.io/professional-deck/)


### V16 · Workflow Replay & Impact Control

V16 adds the missing pre-execution question: **what would change before we execute anything?**

The Control Room now supports:

- deterministic workflow impact preview without mutating the dataset;
- stable action and decision digests for replay integrity;
- run artifacts that can be verified against the current dataset and workflow contract;
- an explicit integration contract with idempotency key, dry-run flag and fail-closed execution invariants.

```text
DECIDE → PLAN → PREVIEW → APPROVE → CONTRACT → ADAPTER
```

The public adapter remains disconnected. The prototype can demonstrate the handoff contract but cannot execute external CRM/API calls.

### V17 · Execution Ledger & Integration Simulation

V17 closes the control loop before any external write:

`DECIDE → PLAN → PREVIEW → APPROVE → CONTRACT → SIMULATE → AUDIT → REPLAY`

The new execution ledger is an append-only, hash-chained local evidence stream. Each event has a sequence, previous hash, deterministic event identity, idempotency key when applicable, actor, timestamp and payload.

The integration adapter now produces a deterministic simulation outcome and an execution event. The public prototype still performs **zero external calls** and remains fail-closed.

V17 regression coverage: **72 tests**.



### V18 · Outcome & Feedback Control

V18 closes the loop after an action is simulated or executed:

`DECIDE → PLAN → PREVIEW → APPROVE → CONTRACT → SIMULATE → OUTCOME → MEASURE → REPLAY`

The new outcome engine records explicit results such as response, meeting, opportunity, won, lost and no-response. It calculates action effectiveness, expected-versus-actual value variance, SLA adherence and forecast calibration.

Feedback remains local-first. The public prototype can record and analyze outcomes supplied by the operator, but it does not send customer or CRM data to an external service.

The V18 run artifact can include feedback summaries and observed outcomes while continuing to exclude raw CSV records.

V18 regression coverage: **87 tests**.

### V20 · Adaptive Calibration & Learning

V20 turns forecast calibration from a static comparison into a bounded learning loop:

`FORECAST → OUTCOME → OBSERVATION → WINDOW → DRIFT → RECOMMENDATION → HUMAN REVIEW`

The adaptive calibration layer:

- stores local calibration snapshots without exporting raw CSV records;
- compares current and previous observation windows;
- enforces minimum global, segment and cohort sample sizes;
- measures calibration error, Brier score and observed-rate movement;
- classifies drift as **STABLE**, **WATCH**, **WARNING**, **CRITICAL** or **INSUFFICIENT**;
- isolates calibration history by dataset fingerprint;
- distinguishes segment drift from cohort drift;
- records a deterministic audit trail for snapshots, baseline state and drift alerts;
- produces controlled recalibration recommendations without changing model assumptions automatically;
- exports an aggregate V20 calibration summary in the existing run artifact without exporting the adaptive history rows.

The Control Room exposes the current adaptive state locally in the browser. The execution boundary remains simulation-only.

V20 adds deterministic regression coverage for temporal windows, sample sufficiency, cohort/segment drift, baseline establishment, bounded history, recommendation logic and replay-safe identities.



### V21 · Controlled Recalibration Policy

V21 is the approval boundary that V20 deliberately did not cross:

`RECOMMENDATION → PROPOSAL → REPLAY → APPROVE / REJECT → APPLY → ROLLBACK`

The policy layer:

- builds a bounded probability multiplier from observed calibration bias;
- clamps the step so a single approval cannot move stage probabilities by more than 0.15;
- replays the candidate against the supplied outcomes and blocks it unless Brier improves;
- requires an explicit operator decision before any forecast assumption changes;
- applies the approved multiplier only to qualified, nurture and new probabilities;
- leaves scoring weights, downside and upside untouched;
- isolates decisions by dataset fingerprint;
- supports reject and rollback without deleting the decision trail;
- exports a V21 summary in the run artifact without exporting raw ledger rows.

The public execution boundary remains simulation-only.
