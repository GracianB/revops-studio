# RevOps Studio Operating Model

RevOps Studio is intentionally built as a small, inspectable operating system rather than a collection of UI widgets.

## Control loop

INPUT
  ↓
QUALITY GATE
  ↓
SCORING
  ↓
CLASSIFICATION
  ↓
IMPACT ANALYSIS
  ↓
PRIORITISED QUEUE
  ↓
HUMAN APPROVAL
  ↓
AUDIT

### Input

The Control Room supports synthetic records and local CSV ingestion.

CSV processing is browser-only and guarded by size and row limits. No imported records are transmitted to the project.

### Quality gate

Every signal must be numeric and within 0–100. Invalid records fail closed into blocked.

That is deliberate. A decision system that confidently scores bad data is just a faster way to be wrong.

### Scoring

Four signals contribute to the score:

- fit
- intent
- engagement
- urgency

Weights are normalised before calculation. The score exposes its contribution breakdown.

### Classification

Two configurable thresholds determine stage:

score >= qualified threshold → qualified
score >= nurture threshold   → nurture
otherwise                    → new

The engine prevents an invalid threshold relationship.

### Impact analysis

Every run is compared against the baseline model so the operator can see downstream effects:

- promotions;
- demotions;
- new blocked records;
- recovered records;
- score deltas;
- added or removed records.

### Operational queue

| Stage | Priority | Owner lane | SLA |
| --- | --- | --- | --- |
| blocked | critical | Data / RevOps | 2h |
| qualified | high | Sales / CS | 4h |
| nurture | medium | Lifecycle | 24h |
| new | low | RevOps | 72h |

The queue is a simulation. It does not execute CRM actions.

### Human gate

Sensitive transitions require explicit approval. The public demo simulates this gate and records the decision in the audit view.

### Run identity

Each configuration and dataset combination receives a deterministic run identifier. The timestamp is intentionally separate from the identifier so identical inputs produce the same run ID.

### Shareable configuration

The Control Room can generate a URL containing only:

- weights;
- stage thresholds;
- selected scenario.

CSV records are never embedded in the shareable URL.

## Engineering principle

The system separates:

decision
   ≠
execution

That separation is the core design constraint. A useful operations system should make decisions visible, explainable and reviewable before it touches the outside world.

### Reproducible run history

The browser keeps up to eight recent run summaries locally.

Stored:

- run ID;
- timestamp;
- scenario;
- weights;
- thresholds;
- aggregate metrics.

Not stored:

- imported CSV rows;
- uploaded file contents;
- lead records.

A history entry can restore its configuration against the dataset currently loaded in the browser. This makes the demo reproducible without turning local storage into a shadow CRM.


## Commercial operating layer

V9 adds an optional commercial context layer to the local simulator.

Optional fields:

    value
    owner
    segment
    source
    last_touch_days

These fields do not replace the four core scoring signals. They add an operational view around them:

    score → stage → pipeline value → weighted pipeline
                     ↓
                 stale risk
                     ↓
              owner / segment view
                     ↓
              prioritised queue

### Commercial metrics

The public dashboard calculates:

- active pipeline value;
- weighted pipeline value (value × score);
- qualified value;
- stale account count/rate;
- context coverage;
- records by segment;
- records by owner.

Values are demonstrative when using the shipped synthetic dataset.

### Stale signal

`last_touch_days > 14` is treated as stale in the demo. Stale context increases queue priority but never changes the score itself.

This separation is deliberate:

    commercial risk ≠ qualification score

The system can therefore surface a high-value stale account without pretending that staleness is the same thing as product fit or buying intent.