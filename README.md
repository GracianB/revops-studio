## RevOps Studio · Web comercial V47 (motor técnico V40)

La portada de RevOps Studio se ha simplificado a cinco preguntas: qué problema resolvemos, qué entregamos, qué experiencia lo respalda, cuánto puede costar y cómo contactar. El laboratorio Control Room conserva el motor V40 por separado en `laboratorio.html`.

### Envío de consultas (activación verificada)

La web está alojada en GitHub Pages y no tiene servidor de formularios propio. El formulario usa la API AJAX de **FormSubmit** (`https://formsubmit.co/ajax/gracianbaenagonzalez@gmail.com`) con validación nativa, campo antispam y consentimiento explícito. Los datos enviados son nombre, email, servicio, herramientas opcionales, horas opcionales y descripción.

**Recepción verificada el 8 de octubre de 2026:** FormSubmit activado y prueba enviada desde la web publicada recibida en el Gmail del propietario. Referencia de prueba: `REVOPS-CONTACT-49-20261008`, recibida a las 08:03 UTC. Esta prueba verifica ese envío; no garantiza la entrega de todos los mensajes futuros. Una respuesta HTTP acredita aceptación por el proveedor, no entrega individual al buzón.

Una respuesta que solicita activación se trata como pendiente incluso si incluye `success: true`: no abre la página de confirmación. Si el envío falla, la consulta se recupera al recargar la misma pestaña cuando el almacenamiento de sesión está disponible; el consentimiento debe marcarse de nuevo. El correo alternativo conserva los datos introducidos. Las pruebas de navegador simulan el proveedor y no envían consultas reales.

Si el proveedor falla, el formulario no borra los datos: muestra una vía alternativa de correo `mailto:` precargada. También hay reserva de conversación a través del calendario existente. No se simulan contactos recibidos.

**V42 · Del coste estimado a una consulta real:** la calculadora permite trasladar las horas por persona, el número de personas, el coste horario y el cálculo orientativo de 52 semanas al formulario, sin enviarlo automáticamente. El contexto es visible y se puede quitar; si cambian las horas del formulario, la estimación anterior se elimina para no enviarla desactualizada. Una confirmación de FormSubmit solo se muestra si la sesión actual registró previamente una respuesta de aceptación. Una URL de gracias compartida no certifica el envío.

La privacidad se explica en `privacidad.html`. Revisar cumplimiento final antes de ofrecer el servicio públicamente a terceros: alojamiento externo, tratamiento por FormSubmit y plazos de conservación.

### V43 · Evidencia profesional conectada con el contacto

Los tres casos comerciales se contrastaron con la documentación de `GracianB/professional-deck` en `case.js`. Cada tarjeta explica reto, solución, evidencia accesible y límites; el desglose de decisiones se consulta con un `<details>` nativo accesible.

- **Bodytone**: Help Center público verificable; la operación interna y los informes no se publican.
- **Calculadora de gimnasios**: 200+ reglas coordinan modelos, espacio, transporte y propuesta; las tarifas, fórmulas y datos siguen privados.
- **Outreach GenAI**: segmentación, borradores, revisión humana y seguimiento; no se muestran contactos ni métricas inventadas.

Las tres tarjetas ofrecen una vía `Tengo un problema parecido` hacia el formulario: adjunta una *referencia opcional*, visible y eliminable, sin modificar el texto del visitante ni su elección de servicio. La referencia acompaña al correo alternativo, a la consulta consentida y a la recuperación de un envío fallido. No se envían consultas reales desde CI.

### V44 · Cierre de navegación, filtros y responsive

- Los cinco filtros de soluciones muestran únicamente las tarjetas correctas. El atributo `hidden` se respeta en CSS incluso con tarjetas `display:flex`, y el resultado anuncia el número visible mediante una región de estado accesible.
- El menú móvil vuelve a enfocar el botón al cerrarse con Escape; se cierra al pulsar fuera o al ampliar la ventana, evitando scroll bloqueado. La lista permanece desplazable en pantallas de poca altura.
- En tablet, el caso público Bodytone ocupa el ancho completo y los dos casos privados se presentan en la segunda fila. En móvil se apilan, se afinan márgenes y botones, y los enlaces se pueden leer sin scroll horizontal.
- Smoke de Chrome y Firefox comprueba filtros 6/3/2/3/1, Escape/foco, responsive a 320, 390 y 850 px, y transición a 1024 px. Los formularios usan respuestas simuladas: las pruebas no envían mensajes reales.

### V45 · Reducción de carga comercial sin modificar el laboratorio

- La hoja original `assets/css/main.css` (~98,9 KB sin comprimir) se mantiene intacta y continúa sirviendo el laboratorio V40.
- La portada, `privacidad.html` y `gracias.html` cargan `assets/css/commercial.css` (~52,7 KB sin comprimir): se excluyen exclusivamente ~46,3 KB del bloque de estilos antiguos y exclusivos del laboratorio. Reducción de ~47 % de bytes CSS de origen en estas páginas; no equivale a un porcentaje medido de mejora en tiempo de carga.
- `node scripts/build-commercial-css.mjs` regenera el fichero desde `main.css`; `npm run css:check` impide publicar si la versión derivada está desincronizada. `npm run verify` incluye ese control.
- El script externo opcional de analítica utiliza `async` y `fetchpriority="low"`, sin bloquear `DOMContentLoaded` como un script diferido. La recepción de contactos y el motor técnico no cambian.
- El smoke de Chrome y Firefox compara estilo computado y dimensiones de la hoja antigua versus la nueva en portada de escritorio/móvil, página de privacidad y confirmación, modos claro/oscuro. El test de Node impone presupuestos de 55 KB para CSS comercial y 18,5 KB para JavaScript comercial. Los presupuestos son de *payload local sin comprimir*, no métricas de red del visitante.

### V46 · Presupuestos de carga simulada

El CI mide la portada en **Chrome real con caché deshabilitada y red/CPU simuladas**, servida desde un HTTP local reproducible. Se prueban 1366 px con perfil 4G (100 ms de latencia, ~1,68 Mbit/s) y 390 px con perfil 3G (250 ms, ~0,76 Mbit/s, CPU ×4). Recursos externos como la analítica se sustituyen en la prueba para aislar exclusivamente los activos propios; no se envían correos ni se contactan servicios de terceros.

- **Presupuesto duro:** como máximo 130 000 bytes de transferencia *first-party* y 9 solicitudes, sin el CSS del laboratorio, `app.js` ni `laboratorio.html` en la portada. Se comprueba el HTML, hoja comercial, tema, `site.js` y su módulo de respuesta.
- **Renderizado:** medición de First Contentful Paint (FCP), Largest Contentful Paint (LCP, cuando el navegador lo proporciona) y Cumulative Layout Shift (CLS). Los umbrales son conservadores para reducir ruido del runner y detectar regresiones severas, no reflejan una certificación Core Web Vitals para visitantes.
- **Informe:** `scripts/performance-budget.mjs` crea `.ci-artifacts/performance-v46.json`. El workflow de validación lo adjunta como artefacto descargable durante 30 días, con bytes, solicitudes, perfiles y valores capturados.
- **Reproducción:** `npm run perf:check` después de instalar `playwright-core@1.58.2` y tener Chrome disponible. `npm run verify` conserva las pruebas de unidad, el chequeo CSS y el motor V40.
- **Límite de evidencia:** la simulación mide una página servida localmente, sin CDN externo, latencia de Internet real, ni condiciones de hardware auténticas. Para comparar el rendimiento experimentado por usuarios reales hacen falta métricas de campo como CrUX / RUM.

### V47 · Auditoría HTTPS de la web publicada

El informe de V46 era sintético y de red local, por lo que no se puede llamar «rendimiento de la web real». V47 incorpora `scripts/audit-live.mjs` y `.github/workflows/live-audit.yml` para analizar la URL publicada `https://gracianb.github.io/revops-studio/` **desde Chrome en un runner de GitHub**, sin convertir esa visita en una métrica de usuarios reales.

- Se comprueba por SHA-256 que los archivos **CSS y JS publicados** coinciden con `main`, y que la página devuelve HTTP 200, presenta el contenido comercial y no carga el motor V40.
- Hay **tres navegaciones en frío** por tamaño (1366 px y 390 px), con caché desactivada, sin alterar el ancho de banda ni la CPU del runner. Se miden TTFB, FCP, LCP y CLS cuando están disponibles, más bytes de red transferidos y solicitudes propias o de terceros, separadas.
- El informe JSON guarda los valores individuales y su **mediana**, además de avisos de terceros o saltos de diseño. Las capturas de escritorio y móvil se adjuntan como evidencia visual.
- La auditoría se inicia con cada push a `main`, pero **espera activamente** a que los hashes de los archivos CSS/JS publicados coincidan con el checkout (hasta unos 4 minutos), de modo que no mide inadvertidamente la versión anterior mientras Pages despliega. También se puede ejecutar manualmente desde Actions y se repite semanalmente los lunes. Los informes permanecen 30 días como artefactos de Actions.
- **Política de CI:** la falta de CSS/JS publicado, una respuesta rota, un error JS propio o la ausencia de contenido comercial son fallos. Los **tiempos** y el comportamiento de proveedores externos son observaciones, no motivos para bloquear un despliegue por fluctuaciones de Internet.
- No se envía ningún formulario, no se prueban datos personales y no se envían datos de empresas. Las cifras de Chrome en CI **no son datos de CrUX, RUM, Lighthouse ni usuarios reales**. Sin cobertura de campo, no se afirma que cumpla CWV reales.

Para repetir: `npm run perf:live` tras instalar `playwright-core@1.58.2` y disponer de Chrome. Para simulaciones locales reproducibles continúa `npm run perf:check` (V46).

### Diseño y QA
- Tema claro y oscuro con preferencia del sistema, botón accesible y persistencia opcional.
- Tres ámbitos de servicio; seis ejemplos reales de entregables; tres proyectos documentados como experiencia profesional, no testimonios inventados.
- Precios desde 900 €, 4.000 € y 600 €/mes, orientativos y sujetos a presupuesto.
- CI valida estructura, CSS, JS, navegación, formularios sin envío externo y laboratorio.
- El motor V40 y sus contratos internos no se versionan de nuevo solo por actualizar la landing comercial.

---

# RevOps Studio

**Servicios de automatización, datos y software a medida · con un laboratorio técnico abierto para demostrar cómo se construyen los sistemas.**

[![Live](https://img.shields.io/badge/LIVE-DAA428?style=for-the-badge)](https://gracianb.github.io/revops-studio/)
[![Tests](https://img.shields.io/badge/TESTS-300%2B-7AF3FF?style=for-the-badge)](https://github.com/GracianB/revops-studio/actions)
[![JavaScript](https://img.shields.io/badge/JavaScript-181717?style=for-the-badge&logo=javascript)](https://github.com/GracianB/revops-studio)

## Qué se contrata y qué se demuestra

La home está dedicada a los servicios. `laboratorio.html` aloja el motor V40 completo sin obligar a los clientes a cargarlo. `site.js` controla únicamente navegación, filtros, calculadora orientativa y preparación local del brief.

**Casos enlazados y alcance de la evidencia:** Bodytone Support OS es un caso público, con Help Center consultable. La calculadora comercial de 200+ reglas y Outreach GenAI son casos documentados cuyo núcleo privado y métricas internas no se publican. No son productos SaaS de RevOps Studio ni testimonios de clientes externos del estudio.

**Conversión:** desde los paquetes se puede elegir tipo de servicio para rellenar el brief. Si sessionStorage está bloqueado, el formulario ofrece un correo preparado sin perder el texto en una navegación fallida. Ningún formulario envía un email automáticamente.

## Servicios para empresas

RevOps Studio es el escaparate de servicios de Gracián Baena: **automatización de procesos, BI/datos y aplicaciones internas a medida** para pymes y equipos operativos.

La conversación comercial comienza con un problema, no con una tecnología:
- Trabajo manual duplicado entre CRM, hojas y correo → automatización o integración con control de errores.
- Informes dispersos o incoherentes → orden de datos, definiciones y dashboard útil.
- Conocimiento y procesos dependientes de personas → herramienta interna, documentación y asistentes acotados.

**Modalidades orientativas:** Quick win desde 900 €, sistema desde 4.000 € y continuidad opcional desde 600 €/mes. Alcance y precio se confirman tras diagnóstico. El formulario prepara un correo local que el visitante revisa y envía manualmente; no hay un backend que reciba el brief.

**El laboratorio V40 no es el producto que se comercializa.** Es una demo local con datos sintéticos, scoring, previsión y política de aprobación. No ejecuta acciones sobre CRM ni demuestra ahorros económicos reales. Se ha trasladado al final de la página y se inicializa solo cuando el visitante lo abre para priorizar el rendimiento de la landing comercial.

---

## Laboratorio técnico y arquitectura

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

## V26 · Portable policy evidence

V26 separates **policy state** from **policy evidence** by introducing a portable JSON evidence bundle:

`POLICY → LEDGER → MANIFEST → VERIFY`

The bundle contains the governed proposal, policy decision ledger and deterministic fingerprints, but it does **not** contain the raw CSV rows.

A reviewer can verify the exported package in another browser or environment without mutating the active policy. Verification has two levels:

- **FINGERPRINT_ONLY** verifies schema, dataset scope, proposal lineage, ledger replay and policy identity from the exported evidence.
- **OBSERVED_ROWS** additionally replays the active policy against the original observed outcome rows when those rows are supplied separately.

The export therefore remains privacy-preserving while making the policy lineage portable and independently inspectable.

V26 is still local-first. The operator identity remains an assertion, not authentication, and the fingerprints remain integrity evidence rather than cryptographic signatures.

## V27 · Cryptographic policy evidence signatures

V27 adds a real cryptographic signing layer on top of the portable V26 evidence package:

`EVIDENCE → SHA-256 DIGEST → ECDSA P-256 SIGNATURE → PUBLIC-KEY VERIFICATION`

The Control Room can generate an ephemeral P-256 signing key, sign the current V26 evidence package and export the signed JSON. The private key is kept only in memory for the active browser tab and is never written to `localStorage`.

The signed package contains:

- the V26 evidence package;
- the ECDSA P-256 public JWK;
- a public-key fingerprint;
- a SHA-256 fingerprint of the exact signed payload;
- the ECDSA signature.

Verification can run without a pinned key to prove internal cryptographic consistency, or with an expected public-key fingerprint to prove that the package matches a specific signer key.

V27 does **not** claim enterprise identity or authentication. Anyone can create a different valid key and sign a different package. Trust comes from pinning or otherwise distributing the expected public-key fingerprint.

## V28 · Trusted signer registry

V28 adds a governed trust layer above the V27 cryptographic signature:

`SIGNATURE → KEY FINGERPRINT → TRUST REGISTRY → TEMPORAL TRUST DECISION`

The trust registry is an append-only local ledger with its own event fingerprints and head fingerprint.

Supported lifecycle actions:

- **REGISTER** creates an `ACTIVE` trusted signer.
- **RETIRE** stops the signer for new evidence while preserving historical signatures created before retirement.
- **ROTATE** retires the predecessor and activates a new signer at the declared effective time.
- **REVOKE** is an emergency trust break. Evidence signed by that key is rejected even when the signature itself remains cryptographically valid.

Trust verification evaluates the signer state **at the evidence signing time** and again at the current time. This makes routine key retirement different from emergency key revocation.

The registry can be exported and re-imported only after its event fingerprints and head have been verified. The registry itself is still a local trust anchor, so moving it between machines is not equivalent to enterprise identity management. For a stronger deployment boundary, the exported registry head or approved signer fingerprints should be distributed and pinned through an external trusted channel.

## V29 · Signed trust root

V29 adds the missing distribution boundary above the V28 local trust registry:

ROOT KEY → SIGNED REGISTRY SNAPSHOT → TRUST REGISTRY → SIGNED EVIDENCE

The root layer signs the complete V28 registry, including its event fingerprints and head fingerprint, with an ECDSA P-256 key. The exported package contains the public root JWK, its deterministic RK29-* fingerprint, the registry snapshot, the exact signed-payload fingerprint and the signature.

The browser keeps the root private key only in memory. The signed snapshot can be exported and verified independently, then used to verify V27 evidence through the full chain:

ROOT → REGISTRY → SIGNER → EVIDENCE

V29 supports an explicit external root pin. Verification without a pin proves only that the snapshot is internally consistent and cryptographically signed by the public key it carries. Verification with a pin proves that the snapshot matches a specific root identity distributed through another channel.

This is still not enterprise authentication. The public application is intentionally local-first. A production deployment would distribute or pin the approved root fingerprint through an independent trust channel rather than trusting browser storage.

## V30 · Trust Fabric & quorum verification

V30 takes the trust model from a single root to an explicit M-of-N cryptographic trust fabric:

ROOT SET → QUORUM CHECKPOINT → TRUST REGISTRY → TRUSTED SIGNER → POLICY EVIDENCE

The fabric defines a fixed set of P-256 root identities and an explicit threshold. A checkpoint is valid only when enough distinct pinned roots sign the exact same registry state, governance metadata and timestamp.

V30 also adds conflict analysis over multiple checkpoints. Divergent registry heads are reported as a trust-fabric fork. A single checkpoint cannot silently redefine the root set or quorum because the verification can require an externally supplied root fingerprint set and threshold.

The Control Room can generate three cryptographic roots for demonstration, sign a 2-of-3 checkpoint, verify the quorum and verify signed policy evidence through the entire chain. This demonstrates the mechanism, but roots generated in one browser session are not operationally independent organisations or HSMs.

Verification receipts expose the fabric fingerprint, registry head, threshold, achieved quorum and verified root identities. They are portable audit evidence, not authentication.

V30 remains local-first. Independent trust still depends on distributing the approved root fingerprint set and quorum policy outside the snapshot, through a channel that the browser cannot rewrite.

## V31 · Trust Transparency & Witness Log

V31 adds the temporal transparency layer above the V30 trust fabric:

`CHECKPOINT → APPEND-ONLY LOG → HEAD → WITNESS → RECEIPT`

Each V30 checkpoint is anchored as a sequential transparency entry containing the previous entry fingerprint, checkpoint fingerprint, registry head, fabric fingerprint, payload fingerprint and an observed timestamp. The log has a deterministic TL31-* event fingerprint and a single verifiable head.

The verifier fails closed on:

- sequence gaps or duplicate sequence observations;
- broken previous-entry links;
- modified event fingerprints;
- duplicate checkpoint anchors;
- timestamp regression;
- missing checkpoint references;
- invalid V30 checkpoints;
- external head-pin mismatch;
- conflicting observations across transparency logs.

V31 also introduces cryptographic witnesses using ECDSA P-256. A witness signs the exact log entry it observed and produces a portable WA31-* attestation. Witness keys are kept in browser memory only. Multiple valid attestations can be checked for a given head, and a witness that signs two different checkpoints for the same sequence is reported as witness equivocation.

The exported transparency log carries the verified V30 checkpoint snapshots, so a reviewer can verify the chain without relying on browser state. A separate transparency receipt exposes the verified head, latest checkpoint and witness set.

This closes an important gap left by V30: cryptographic validity proves that a checkpoint is well-formed, while transparency proves that the checkpoint also belongs to a consistent, auditable history. Multiple logs can be compared to detect conflicting observations at the same sequence.

V31 is still local-first. A browser-generated witness demonstrates a real cryptographic signature, not an independently operated external organisation. Strong external trust requires distributing the approved transparency head and witness identities through a channel outside the application.

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
