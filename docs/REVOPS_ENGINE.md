# RevOps Engine

The technical playground is a deterministic browser-side demonstration of operating logic.

## Signals

Each synthetic record has:

- fit
- intent
- engagement
- urgency

Score:

```text
fit × 0.35 + intent × 0.30 + engagement × 0.20 + urgency × 0.15
```

Classification:

```text
>= 75 → qualified
50–74 → nurture
< 50 → new
```

## Gate

A score does not equal permission to execute.

Sensitive transitions require an explicit approval flag in the engine. The playground visualizes this separation with a human gate.

## Audit

Evaluation and approval emit timestamped audit events containing an action, record ID and detail.

## Scope

All records are synthetic. The demo performs no network requests and never touches a CRM, email provider or database.
