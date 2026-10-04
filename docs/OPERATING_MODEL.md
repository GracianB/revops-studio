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
## Revenue forecast layer

V10 adds a deterministic forecast view that uses optional commercial value plus stage probabilities.

Default demo assumptions:

    qualified = 80%
    nurture   = 35%
    new       = 10%
    blocked   = 0%

Expected value is calculated as:

    expected value = deal value × stage probability

The Forecast Lab also applies explicit downside/base/upside multipliers. These are scenario controls, not a claim about future revenue.

The layer exposes:

- active pipeline value;
- expected value;
- expected coverage;
- downside/base/upside expected value;
- forecast range;
- top-account concentration;
- expected value by segment.

Forecast assumptions do not modify the core qualification score. The commercial and qualification layers remain separate.

## Executive Intelligence Layer

V11 adds a decision surface designed for an operator or executive review.

### Segment intelligence

Each segment exposes:

- active and blocked record counts;
- pipeline and qualified value;
- weighted pipeline;
- expected value from the current forecast assumptions;
- qualification rate by records;
- qualified value share;
- stale rate;
- average score;
- pipeline concentration relative to record share.

### Cohort intelligence

Optional `cohort` context groups records into comparable operating cohorts and exposes:

- active / blocked records;
- pipeline value;
- expected value;
- qualified rate;
- stale rate;
- average score.

The shipped demo uses synthetic quarterly cohorts.

### Account health

Health is intentionally separate from qualification. It combines fit, intent, engagement, urgency and contact recency into an explainable 0–100 operational health score.

Health states:

```
75–100  healthy
55–74   watch
35–54   risk
0–34    critical
```

Missing recency lowers confidence rather than silently inventing a fresh signal.

### Business rules

The rule layer surfaces deterministic conditions such as:

- revenue attached to blocked data;
- high-value stale accounts;
- material ownerless pipeline;
- qualified accounts without recent touch;
- high intent / low engagement gaps;
- fit / intent mismatches;
- material value below qualified stage.

Rules do not mutate records.

### Anomaly detection

The anomaly layer uses deterministic IQR outlier detection for deal value and compares segment stale rate, qualification rate and pipeline concentration against the current run baseline.

### Revenue leakage

Revenue leakage measures value carrying one or more operational risk signals while keeping category totals separate. The aggregate exposure counts each record once, preventing double-counting across overlapping risk reasons.

### Executive decision surface

The executive layer combines forecast, health, rules, anomalies, leakage, segments and cohorts into:

- controlled / attention / critical signal;
- prioritized risks;
- highlighted opportunities;
- segment and cohort expected value.

This is a decision-support layer, not an autonomous execution layer.
