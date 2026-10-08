import { parseCsv } from "./csv-utils.js";
import {
  DEFAULT_WEIGHTS,
  evaluateBatch,
  transition,
  auditEvent,
  summarisePipeline,
  buildActionQueue,
  summariseQueue,
  compareEvaluations,
  evaluateScenarios,
  normaliseThresholds,
  createRunSnapshot,
  nextAction,
  commercialMetrics,
  executiveIntelligence,
  buildRunAnalysis,
  buildDecisionTrace,
  buildOperationalPlan,
  buildWorkflowImpact,
  buildRunArtifact,
  verifyRunArtifact,
  createExecutionLedger,
  buildExecutionLedger,
  appendExecutionEvent,
  replayExecutionLedger
} from "./revops-engine.js";
import {
  createExecutionEnvelope,
  createIntegrationContract,
  simulateExecution,
  simulateIntegrationContract,
  createExecutionEvent
} from "./execution-adapter.js";
import {
  OUTCOME_TYPES,
  createOutcomeRecord,
  createOutcomeLedger,
  appendOutcome,
  buildFeedbackAnalysis,
  createOutcomeEvent
} from "./outcome-engine.js";
import {
  buildCalibrationReport
} from "./calibration-engine.js";
import {
  buildAdaptiveCalibrationReport,
  buildObservedCalibrationRows
} from "./adaptive-calibration-engine.js";
import {
  activePolicy,
  applyPolicyToAssumptions,
  buildRecalibrationProposal,
  decidePolicy,
  summarisePolicy,
  normaliseActor,
  normaliseRationale,
  verifyPolicyLedger,
  verifyActivePolicy,
  replayPolicyLedger
} from "./policy-engine.js";
import {
  buildPolicyEvidenceBundle,
  verifyPolicyEvidenceBundle,
  serialisePolicyEvidenceBundle
} from "./policy-evidence.js";
import {
  generatePolicyEvidenceKeyPair,
  signPolicyEvidenceBundle,
  verifyPolicyEvidenceSignature,
  serialiseSignedPolicyEvidenceBundle
} from "./policy-evidence-signing.js";
import {
  TRUST_REGISTRY_VERSION,
  createTrustRegistry,
  buildTrustedSignerFingerprint,
  resolveTrustedSigner,
  registerTrustedSigner,
  retireTrustedSigner,
  revokeTrustedSigner,
  rotateTrustedSigner,
  verifyTrustRegistry,
  verifyTrustedPolicyEvidence,
  exportTrustRegistry,
  importTrustRegistry
} from "./policy-trust-registry.js";
import {
  TRUST_ROOT_VERSION,
  generateTrustRootKeyPair,
  signTrustRegistrySnapshot,
  verifySignedTrustRegistrySnapshot,
  verifyTrustedPolicyEvidenceViaRoot,
  exportSignedTrustRegistrySnapshot,
  importSignedTrustRegistrySnapshot
} from "./policy-trust-root.js";
import {
  TRUST_FABRIC_VERSION,
  generateTrustFabricKeySet,
  createTrustFabric,
  signTrustFabricCheckpoint,
  verifyTrustFabricCheckpoint,
  verifyTrustFabricCheckpointSet,
  verifyTrustedPolicyEvidenceViaFabric,
  buildTrustFabricVerificationReceipt,
  exportTrustFabricCheckpoint,
  importTrustFabricCheckpoint
} from "./policy-trust-fabric.js";
import {
  TRANSPARENCY_VERSION,
  createTransparencyLog,
  appendTransparencyCheckpoint,
  generateTransparencyWitnessKeyPair,
  signTransparencyWitnessAttestation,
  verifyTransparencyLog,
  verifyTransparencyWitnessSet,
  buildTransparencyReceipt,
  exportTransparencyLog,
  importTransparencyLog
} from "./policy-transparency.js";
import {
  DECISION_CERTIFICATE_VERSION,
  buildDecisionCertificate,
  verifyDecisionCertificate,
  exportDecisionCertificate,
  importDecisionCertificate
} from "./policy-decision-certificate.js";

const STORAGE_KEY = "revops-studio:brief:v2";
const ANALYTICS_EVENT = "Reservar";

const CALIBRATION_V19_STORAGE_KEY = "revops-studio:calibration:v19";

function calibrationStorageKeyV19(datasetFingerprint = null) {
  return CALIBRATION_V19_STORAGE_KEY + ":" + String(datasetFingerprint || "global");
}

function readCalibrationBaselineV19(datasetFingerprint = null) {
  try {
    const value = JSON.parse(
      localStorage.getItem(calibrationStorageKeyV19(datasetFingerprint)) || "[]"
    );
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeCalibrationBaselineV19(rows = [], datasetFingerprint = null) {
  try {
    localStorage.setItem(
      calibrationStorageKeyV19(datasetFingerprint),
      JSON.stringify(Array.isArray(rows) ? rows : [])
    );
  } catch {}
}

const CALIBRATION_V20_STORAGE_KEY = "revops-studio:calibration:v20";
const CALIBRATION_V20_CONFIG_KEY = "revops-studio:calibration:v20:config";

function readAdaptiveCalibrationConfigV20() {
  try {
    const value = JSON.parse(localStorage.getItem(CALIBRATION_V20_CONFIG_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function writeAdaptiveCalibrationConfigV20(config = {}) {
  try {
    localStorage.setItem(CALIBRATION_V20_CONFIG_KEY, JSON.stringify(config || {}));
  } catch {}
}

function calibrationStorageKeyV20(datasetFingerprint = null) {
  return CALIBRATION_V20_STORAGE_KEY + ":" + String(datasetFingerprint || "global");
}

function readAdaptiveCalibrationHistoryV20(datasetFingerprint = null) {
  try {
    const value = JSON.parse(
      localStorage.getItem(calibrationStorageKeyV20(datasetFingerprint)) || "[]"
    );
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeAdaptiveCalibrationHistoryV20(history = [], datasetFingerprint = null) {
  try {
    localStorage.setItem(
      calibrationStorageKeyV20(datasetFingerprint),
      JSON.stringify(Array.isArray(history) ? history : [])
    );
  } catch {}
}

const POLICY_V25_STORAGE_KEY = "revops-studio:policy:v24";

function policyStorageKeyV25(datasetFingerprint = null) {
  return POLICY_V25_STORAGE_KEY + ":" + String(datasetFingerprint || "global");
}

function readPolicyLedgerV25(datasetFingerprint = null) {
  try {
    const value = JSON.parse(localStorage.getItem(policyStorageKeyV25(datasetFingerprint)) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writePolicyLedgerV25(ledger = [], datasetFingerprint = null) {
  try {
    localStorage.setItem(
      policyStorageKeyV25(datasetFingerprint),
      JSON.stringify(Array.isArray(ledger) ? ledger : [])
    );
  } catch {}
}

const POLICY_V25_ACTOR_KEY = "revops-studio:policy:v24:actor";

function readPolicyActorV25() {
  try {
    return normaliseActor(localStorage.getItem(POLICY_V25_ACTOR_KEY) || "") || "";
  } catch {
    return "";
  }
}

function writePolicyActorV25(actor = "") {
  const safeActor = normaliseActor(actor);
  if (!safeActor) return;
  try {
    localStorage.setItem(POLICY_V25_ACTOR_KEY, safeActor);
  } catch {}
}

const POLICY_TRUST_V28_STORAGE_KEY = "revops-studio:policy-trust:v28";

function readPolicyTrustRegistryV28() {
  try {
    const value = JSON.parse(localStorage.getItem(POLICY_TRUST_V28_STORAGE_KEY) || "null");
    return value && typeof value === "object" ? value : createTrustRegistry();
  } catch {
    return createTrustRegistry();
  }
}

function writePolicyTrustRegistryV28(registry) {
  try {
    localStorage.setItem(POLICY_TRUST_V28_STORAGE_KEY, JSON.stringify(registry));
  } catch {}
}

const POLICY_TRUST_ROOT_V29_STORAGE_KEY = "revops-studio:policy-trust-root:v29";

function readTrustRootSnapshotV29() {
  try {
    const value = JSON.parse(localStorage.getItem(POLICY_TRUST_ROOT_V29_STORAGE_KEY) || "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function writeTrustRootSnapshotV29(snapshot) {
  try {
    localStorage.setItem(POLICY_TRUST_ROOT_V29_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {}
}

const POLICY_TRUST_FABRIC_V30_STORAGE_KEY = "revops-studio:policy-trust-fabric:v30";

function readTrustFabricCheckpointV30() {
  try {
    const value = JSON.parse(localStorage.getItem(POLICY_TRUST_FABRIC_V30_STORAGE_KEY) || "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function writeTrustFabricCheckpointV30(snapshot) {
  try {
    localStorage.setItem(POLICY_TRUST_FABRIC_V30_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {}
}

const POLICY_TRANSPARENCY_V31_STORAGE_KEY = "revops-studio:policy-transparency:v31";

function readTransparencyLogV31() {
  try {
    const value = JSON.parse(localStorage.getItem(POLICY_TRANSPARENCY_V31_STORAGE_KEY) || "null");
    return value && typeof value === "object" ? value : createTransparencyLog();
  } catch {
    return createTransparencyLog();
  }
}

function writeTransparencyLogV31(log) {
  try {
    localStorage.setItem(POLICY_TRANSPARENCY_V31_STORAGE_KEY, JSON.stringify(log));
  } catch {}
}

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

function awaitableTrustRegistrySummary(registry) {
  if (!registry || !Array.isArray(registry.events)) return "EMPTY";
  return (registry.headFingerprint || "T28-EMPTY") + " · " + registry.events.length + " events";
}

function track(eventName, props = {}) {
  if (typeof window.plausible === "function") window.plausible(eventName, { props });
}

function initMenu() {
  const button = qs("#menuBtn"), menu = qs("#mobileNav");
  if (!button || !menu) return;
  const setOpen = (open) => {
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    menu.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
  };
  button.addEventListener("click", () => setOpen(button.getAttribute("aria-expanded") !== "true"));
  qsa("a", menu).forEach((link) => link.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") setOpen(false); });
}

function initReveal() {
  const items = qsa(".reveal");
  if (!items.length) return;
  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries, io) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });
  items.forEach((item) => observer.observe(item));
}

function initNavState() {
  const links = qsa('.nav-links a[href^="#"], .mobile-nav a[href^="#"]');
  const sections = qsa("main section[id]");
  if (!links.length || !("IntersectionObserver" in window)) return;
  const byId = new Map();
  links.forEach((link) => {
    const id = link.getAttribute("href").slice(1);
    byId.set(id, links.filter((item) => item.getAttribute("href") === "#" + id));
  });
  const clear = () => links.forEach((link) => link.removeAttribute("aria-current"));
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    clear();
    (byId.get(visible.target.id) || []).forEach((link) => link.setAttribute("aria-current", "true"));
  }, { rootMargin: "-18% 0px -70% 0px", threshold: [0.05, 0.25, 0.5] });
  sections.forEach((section) => observer.observe(section));
}

function initFilters() {
  const buttons = qsa(".filter-btn"), cards = qsa(".service-card");
  if (!buttons.length || !cards.length) return;
  buttons.forEach((button) => button.addEventListener("click", () => {
    const filter = button.dataset.filter || "all";
    buttons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    cards.forEach((card) => {
      const services = (card.dataset.service || "").split(/\s+/);
      card.hidden = filter !== "all" && !services.includes(filter);
    });
  }));
}

function numberValue(selector, fallback) {
  const value = Number(qs(selector)?.value);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function formatEuro(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}


function buildCalibrationV19Report(forecastRows = [], outcomes = [], datasetFingerprint = null) {
  const rows = Array.isArray(forecastRows) ? forecastRows : [];
  const events = Array.isArray(outcomes) ? outcomes : [];
  const storedBaseline = readCalibrationBaselineV19(datasetFingerprint);
  const report = buildCalibrationReport({
    forecastRows: rows,
    outcomes: events,
    baselineRows: storedBaseline,
    thresholds: {}
  });
  if (!storedBaseline.length && report.rows.length) {
    writeCalibrationBaselineV19(report.rows, datasetFingerprint);
  }
  return report;
}
function initCalculator() {
  const output = qs("#annualCost"), detail = qs("#annualDetail");
  if (!output || !detail) return;
  const formatMoneyLocal = (value) => new Intl.NumberFormat("es-ES", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0
  }).format(Number(value) || 0);

  const render = () => {
    const hours = numberValue("#hoursWeek", 6);
    const people = Math.max(1, numberValue("#people", 2));
    const cost = numberValue("#hourCost", 25);
    output.textContent = formatEuro(hours * people * cost * 52);
    detail.textContent = hours.toLocaleString("es-ES") + " h/semana × " + people.toLocaleString("es-ES") + " persona(s) × " + formatEuro(cost) + "/h × 52 semanas";
  };
  ["#hoursWeek", "#people", "#hourCost"].forEach((selector) => qs(selector)?.addEventListener("input", render));
  render();
}

function collectBrief(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  return {
    nombre: String(data.nombre || "").trim(),
    email: String(data.email || "").trim(),
    herramientas: String(data.herramientas || "").trim(),
    horas: String(data.horas || "").trim(),
    dolor: String(data.dolor || "").trim(),
    createdAt: new Date().toISOString()
  };
}

function initBriefForm() {
  const form = qs("#briefForm"), status = qs("#formStatus");
  if (!form || !status) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = collectBrief(form);
    let stored = true;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { stored = false; }
    track(ANALYTICS_EVENT, { place: "brief" });
    status.dataset.state = stored ? "ok" : "error";
    status.textContent = stored
      ? "Brief preparado en esta pestaña. La siguiente pantalla te deja revisar el correo."
      : "No se pudo guardar el brief localmente. Continúa sin cerrar esta pestaña.";
    setTimeout(() => { window.location.href = "./gracias.html"; }, 180);
  });
}

function initTracking() {
  qsa('a[data-track="calendar"]').forEach((link) => link.addEventListener("click", () => track(ANALYTICS_EVENT, { place: link.dataset.place || "calendar" })));
  qsa('a[data-track="github"]').forEach((link) => link.addEventListener("click", () => track("GitHub", { place: link.dataset.place || "hero" })));
  qsa('a[data-track="proof-deck"]').forEach((link) => link.addEventListener("click", () => track("ProfessionalDeck", { place: link.dataset.place || "proof" })));
  qsa('a[data-track="proof-linkedin"]').forEach((link) => link.addEventListener("click", () => track("LinkedIn", { place: link.dataset.place || "proof" })));
}

const demoSeed = [
  { id:"L-001", account:"Northstar", fit:92, intent:88, engagement:80, urgency:74, value:42000, owner:"Ana", segment:"Enterprise", source:"Inbound", cohort:"2026-Q4", lastTouchDays:3 },
  { id:"L-002", account:"Atlas", fit:78, intent:61, engagement:56, urgency:52, value:18500, owner:"Luis", segment:"Mid-market", source:"Partner", cohort:"2026-Q4", lastTouchDays:8 },
  { id:"L-003", account:"Kite", fit:41, intent:30, engagement:46, urgency:35, value:7200, owner:"Marta", segment:"SMB", source:"Outbound", cohort:"2026-Q3", lastTouchDays:21 },
  { id:"L-004", account:"Nova", fit:86, intent:90, engagement:72, urgency:91, value:67000, owner:"Ana", segment:"Enterprise", source:"Inbound", cohort:"2026-Q4", lastTouchDays:1 },
  { id:"L-005", account:"Orbit", fit:67, intent:54, engagement:62, urgency:44, value:24000, owner:"Luis", segment:"Mid-market", source:"Event", cohort:"2026-Q3", lastTouchDays:16 },
  { id:"L-006", account:"Pine", fit:74, intent:49, engagement:67, urgency:28, value:31000, owner:"Marta", segment:"Enterprise", source:"Referral", cohort:"2026-Q3", lastTouchDays:11 },
  { id:"L-007", account:"Mica", fit:57, intent:79, engagement:61, urgency:72, value:12800, owner:"Ana", segment:"SMB", source:"Inbound", cohort:"2026-Q4", lastTouchDays:19 },
  { id:"L-008", account:"Echo", fit:28, intent:35, engagement:32, urgency:18, value:4900, owner:"Luis", segment:"SMB", source:"Outbound", cohort:"2026-Q3", lastTouchDays:31 }
];

function initPlayground() {
  const rows = qs("#demoRows");
  if (!rows) return;

  const inputs = {
    fit: qs("#weightFit"), intent: qs("#weightIntent"),
    engagement: qs("#weightEngagement"), urgency: qs("#weightUrgency")
  };
  const values = {
    fit: qs("#weightFitValue"), intent: qs("#weightIntentValue"),
    engagement: qs("#weightEngagementValue"), urgency: qs("#weightUrgencyValue")
  };
  const thresholds = {
    qualified: qs("#thresholdQualified"),
    nurture: qs("#thresholdNurture")
  };
  const thresholdValues = {
    qualified: qs("#thresholdQualifiedValue"),
    nurture: qs("#thresholdNurtureValue")
  };
  const totalWeight = qs("#weightTotal");
  const metrics = {
    total: qs("#demoTotal"), qualified: qs("#demoQualified"), nurture: qs("#demoNurture"),
    avg: qs("#demoAvgScore"), quality: qs("#demoQuality"), rate: qs("#demoRate")
  };
  const status = qs("#demoStatus");
  const audit = qs("#auditLog");
  const detail = qs("#leadInspector");
  const gate = qs("#approveDemo");
  const queue = qs("#actionQueue");
  const queueMeta = qs("#queueMeta");
  const queueSummary = qs("#queueSummary");
  const datasetLabel = qs("#datasetLabel");
  const shapeLabel = qs("#shapeLabel");
  const runId = qs("#runId");
  const shareConfig = qs("#shareConfig");
  const copyConfig = qs("#copyConfig");
  const queueSearch = qs("#queueSearch");
  const tableStageFilter = qs("#tableStageFilter");
  const staleOnly = qs("#staleOnly");
  const scenarioMatrix = qs("#scenarioMatrix");
  const scenarioMatrixMeta = qs("#scenarioMatrixMeta");
  const runHistory = qs("#runHistory");
  const clearHistory = qs("#clearHistory");
  const commercial = {
    pipeline: qs("#commercialPipeline"),
    weighted: qs("#commercialWeighted"),
    qualified: qs("#commercialQualified"),
    stale: qs("#commercialStale"),
    coverage: qs("#commercialCoverage"),
    segments: qs("#segmentBreakdown"),
    owners: qs("#ownerBreakdown")
  };
  const forecast = {
    downside: qs("#forecastDownside"),
    base: qs("#forecastBase"),
    upside: qs("#forecastUpside"),
    coverage: qs("#forecastCoverage"),
    spread: qs("#forecastSpread"),
    concentration: qs("#forecastConcentration"),
    rows: qs("#forecastSegments"),
    probabilities: {
      qualified: qs("#forecastQualifiedProb"),
      nurture: qs("#forecastNurtureProb"),
      new: qs("#forecastNewProb"),
      downside: qs("#forecastDownsideMult"),
      upside: qs("#forecastUpsideMult")
    },
    values: {
      qualified: qs("#forecastQualifiedProbValue"),
      nurture: qs("#forecastNurtureProbValue"),
      new: qs("#forecastNewProbValue"),
      downside: qs("#forecastDownsideMultValue"),
      upside: qs("#forecastUpsideMultValue")
    }
  };
  const intelligence = {
    signal: qs("#intelSignal"),
    health: qs("#intelHealth"),
    risk: qs("#intelRisk"),
    leakage: qs("#intelLeakage"),
    anomalies: qs("#intelAnomalies"),
    priorities: qs("#intelPriorities"),
    opportunities: qs("#intelOpportunities"),
    segments: qs("#intelSegments"),
    cohorts: qs("#intelCohorts")
  };
  const guided = {
    progress: qs("#guidedProgress"),
    title: qs("#guided-title"),
    copy: qs("#guidedCopy"),
    next: qs("#guidedNext"),
    steps: qsa("[data-guided-step]")
  };
  const executiveReadout = {
    signal: qs("#executiveSignal"),
    headline: qs("#executiveHeadline"),
    meta: qs("#executiveMeta"),
    facts: qs("#executiveFacts"),
    actions: qs("#executiveActions"),
    owner: qs("#executiveOwner"),
    segment: qs("#executiveSegment"),
    copyButton: qs("#copyExecutiveBrief"),
    text: qs("#executiveBriefText")
  };
  const ownerMatrix = qs("#ownerMatrix");
  const workflowControl = {
    status: qs("#workflowStatus"),
    meta: qs("#workflowMeta"),
    ready: qs("#workflowReady"),
    approval: qs("#workflowApproval"),
    blocked: qs("#workflowBlocked"),
    adapter: qs("#workflowAdapter"),
    fingerprint: qs("#workflowFingerprint"),
    plan: qs("#workflowPlan"),
    simulate: qs("#simulateWorkflow"),
    artifact: qs("#exportRunArtifact"),
    replayInput: qs("#replayArtifact"),
    replayStatus: qs("#replayStatus"),
    verifyReplay: qs("#verifyReplayArtifact")
  };
  const workflowImpact = {
    proposed: qs("#impactProposed"),
    applied: qs("#impactApplied"),
    pending: qs("#impactPending"),
    qualificationDelta: qs("#impactQualificationDelta"),
    stageDelta: qs("#impactStageDelta"),
    preview: qs("#previewWorkflowImpact")
  };
  const executionLedger = {
    status: qs("#ledgerStatus"),
    meta: qs("#ledgerMeta"),
    sequence: qs("#ledgerSequence"),
    head: qs("#ledgerHead"),
    approvals: qs("#ledgerApprovals"),
    contracts: qs("#ledgerContracts"),
    simulations: qs("#ledgerSimulations"),
    outcomes: qs("#ledgerOutcomes"),
    replay: qs("#replayLedger"),
    events: qs("#ledgerEvents")
  };

  const feedback = {
    lead: qs("#feedbackLead"),
    type: qs("#feedbackType"),
    actualValue: qs("#feedbackActualValue"),
    actualRevenue: qs("#feedbackActualRevenue"),
    responseHours: qs("#feedbackResponseHours"),
    record: qs("#recordFeedback"),
    status: qs("#feedbackStatus"),
    total: qs("#feedbackTotal"),
    positiveRate: qs("#feedbackPositiveRate"),
    winRate: qs("#feedbackWinRate"),
    variance: qs("#feedbackVariance"),
    calibration: qs("#feedbackCalibration"),
    sla: qs("#feedbackSla"),
    effectiveness: qs("#feedbackEffectiveness"),
    v20Severity: qs("#calibrationV20Severity"),
    v20Current: qs("#calibrationV20Current"),
    v20Previous: qs("#calibrationV20Previous"),
    v20CalibrationDelta: qs("#calibrationV20CalibrationDelta"),
    v20BrierDelta: qs("#calibrationV20BrierDelta"),
    v20Alerts: qs("#calibrationV20Alerts"),
    v20Recommendations: qs("#calibrationV20Recommendations"),
    v20WindowDays: qs("#calibrationV20WindowDays"),
    v20MinSamples: qs("#calibrationV20MinSamples"),
    v20MinGroupSamples: qs("#calibrationV20MinGroupSamples"),
    v20Reset: qs("#resetCalibrationV20"),
    v24Status: qs("#calibrationV25Status"),
    v24Multiplier: qs("#calibrationV25Multiplier"),
    v24Improvement: qs("#calibrationV25Improvement"),
    v24Active: qs("#calibrationV25Active"),
    v24Reason: qs("#calibrationV25Reason"),
    v24Replay: qs("#calibrationV25Replay"),
    v24Rows: qs("#calibrationV25Rows"),
    v24Integrity: qs("#calibrationV25Integrity"),
    v24PolicyId: qs("#calibrationV25PolicyId"),
    v24Deviation: qs("#calibrationV25Deviation"),
    v24Actor: qs("#calibrationV25Actor"),
    v24SourceRun: qs("#calibrationV25SourceRun"),
    v24Lineage: qs("#calibrationV25Lineage"),
    policyActor: qs("#policyV25Actor"),
    policyRationale: qs("#policyV25Rationale"),
    v25Verify: qs("#verifyPolicyV25"),
    v25Reason: qs("#calibrationV25Reason"),
    v25Ledger: qs("#calibrationV25Ledger"),
    v25ActiveIntegrity: qs("#calibrationV25ActiveIntegrity"),
    v26Manifest: qs("#calibrationV26Manifest"),
    v26Verification: qs("#calibrationV26Verification"),
    v26Status: qs("#policyEvidenceV26Status"),
    v26Export: qs("#exportPolicyEvidenceV26"),
    v26Import: qs("#importPolicyEvidenceV26"),
    v27Key: qs("#policySignatureV27Key"),
    v27Status: qs("#policySignatureV27Status"),
    v27Generate: qs("#generatePolicySignerV27"),
    v27Sign: qs("#signPolicyEvidenceV27"),
    v27Import: qs("#importPolicySignedV27"),
    v28Registry: qs("#policyTrustV28Registry"),
    v28Key: qs("#policyTrustV28KeyInput"),
    v28State: qs("#policyTrustV28State"),
    v28NewJwk: qs("#policyTrustV28NewJwk"),
    v28Status: qs("#policyTrustV28Status"),
    v28Register: qs("#registerTrustedSignerV28"),
    v28Retire: qs("#retireTrustedSignerV28"),
    v28Revoke: qs("#revokeTrustedSignerV28"),
    v28Rotate: qs("#rotateTrustedSignerV28"),
    v28Export: qs("#exportTrustRegistryV28"),
    v28Import: qs("#importTrustRegistryV28"),
    v28Verify: qs("#verifyTrustedEvidenceV28"),
    v28EvidenceImport: qs("#importTrustedEvidenceV28"),
    v29Root: qs("#policyTrustRootV29"),
    v29Pin: qs("#policyTrustRootV29Pin"),
    v29RegistryHead: qs("#policyTrustRootV29RegistryHead"),
    v29Status: qs("#policyTrustRootV29Status"),
    v29Generate: qs("#generateTrustRootV29"),
    v29Sign: qs("#signTrustRegistryV29"),
    v29VerifyRegistry: qs("#verifyTrustRootV29"),
    v29VerifyEvidence: qs("#verifyRootAnchoredEvidenceV29"),
    v29Export: qs("#exportTrustRootV29"),
    v29Import: qs("#importTrustRootV29"),
    v30Quorum: qs("#policyTrustFabricV30Quorum"),
    v30Roots: qs("#policyTrustFabricV30Roots"),
    v30Head: qs("#policyTrustFabricV30Head"),
    v30Threshold: qs("#policyTrustFabricV30Threshold"),
    v30Pins: qs("#policyTrustFabricV30Pins"),
    v30Status: qs("#policyTrustFabricV30Status"),
    v30Generate: qs("#generateTrustFabricV30"),
    v30Sign: qs("#signTrustFabricV30"),
    v30Verify: qs("#verifyTrustFabricV30"),
    v30VerifyEvidence: qs("#verifyFabricAnchoredEvidenceV30"),
    v30Export: qs("#exportTrustFabricV30"),
    v30Import: qs("#importTrustFabricV30"),
    v31Entries: qs("#policyTransparencyV31Entries"),
    v31Head: qs("#policyTransparencyV31Head"),
    v31Witnesses: qs("#policyTransparencyV31Witnesses"),
    v31HeadPin: qs("#policyTransparencyV31HeadPin"),
    v31MinWitnesses: qs("#policyTransparencyV31MinWitnesses"),
    v31Status: qs("#policyTransparencyV31Status"),
    v31GenerateWitness: qs("#generateTransparencyWitnessV31"),
    v31Anchor: qs("#anchorTrustFabricV31"),
    v31Witness: qs("#witnessTransparencyHeadV31"),
    v31Verify: qs("#verifyTransparencyV31"),
    v31Export: qs("#exportTransparencyV31"),
    v31ExportReceipt: qs("#exportTransparencyReceiptV31"),
    v31Import: qs("#importTransparencyV31"),
    v32CertificateId: qs("#policyDecisionCertificateV32Id"),
    v32Head: qs("#policyDecisionCertificateV32Head"),
    v32Quorum: qs("#policyDecisionCertificateV32Quorum"),
    v32Status: qs("#policyDecisionCertificateV32Status"),
    v32MinWitnesses: qs("#policyDecisionCertificateV32MinWitnesses"),
    v32HeadPin: qs("#policyDecisionCertificateV32HeadPin"),
    v32Build: qs("#buildDecisionCertificateV32"),
    v32Verify: qs("#verifyDecisionCertificateV32"),
    v32Export: qs("#exportDecisionCertificateV32"),
    v32Import: qs("#importDecisionCertificateV32"),
    v24Approve: qs("#approvePolicyV25"),
    v24Reject: qs("#rejectPolicyV25"),
    v24Rollback: qs("#rollbackPolicyV25")
  };
  const formatMoneyLocal = (value) => new Intl.NumberFormat("es-ES", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0
  }).format(Number(value) || 0);

  const renderFeedback = (plan, forecast) => {
    if (!feedback.lead) return;
    const runId = plan?.runId || null;
    if (lastOutcomeRunId !== runId) {
      lastOutcomeRunId = runId;
      feedbackOutcomes = [];
      lastOutcomeLedger = createOutcomeLedger({
        runId,
        datasetFingerprint: plan?.datasetFingerprint || null,
        source: dataSource === "csv" ? "csv" : "simulation"
      });
    }

    const currentIds = evaluated.map((lead) => String(lead.id));
    const selectedId = currentIds.includes(String(feedback.lead.value))
      ? String(feedback.lead.value)
      : currentIds[0] || "";
    feedback.lead.replaceChildren();
    evaluated.forEach((lead) => {
      const option = document.createElement("option");
      option.value = String(lead.id);
      option.textContent = (lead.account || "Unnamed account") + " · " + lead.id + " · " + lead.stage;
      feedback.lead.appendChild(option);
    });
    if (selectedId) feedback.lead.value = selectedId;

    const analysis = buildFeedbackAnalysis({
      plan,
      forecast,
      outcomes: feedbackOutcomes
    });
    lastFeedbackAnalysis = analysis;

    const latestOutcomeAt = feedbackOutcomes
      .map((outcome) => outcome?.occurredAt)
      .filter(Boolean)
      .sort()
      .at(-1);

    const adaptiveConfigV20 = {
      windowDays: Number(feedback.v20WindowDays?.value),
      minSamples: Number(feedback.v20MinSamples?.value),
      minGroupSamples: Number(feedback.v20MinGroupSamples?.value)
    };

    lastAdaptiveCalibrationReportV20 = buildAdaptiveCalibrationReport({
      forecastRows: forecast?.rows || [],
      outcomes: feedbackOutcomes,
      history: readAdaptiveCalibrationHistoryV20(plan?.datasetFingerprint || null),
      datasetFingerprint: plan?.datasetFingerprint || null,
      runId: plan?.runId || null,
      now: latestOutcomeAt || lastCalibrationCapturedAtV20 || new Date().toISOString(),
      config: adaptiveConfigV20
    });

    writeAdaptiveCalibrationHistoryV20(
      lastAdaptiveCalibrationReportV20.nextHistory,
      plan?.datasetFingerprint || null
    );

    if (feedback.v20Severity) {
      feedback.v20Severity.textContent = lastAdaptiveCalibrationReportV20.severity;
      feedback.v20Severity.dataset.state = lastAdaptiveCalibrationReportV20.severity.toLowerCase();
    }
    if (feedback.v20Current) {
      feedback.v20Current.textContent = String(lastAdaptiveCalibrationReportV20.currentWindow.records);
    }
    if (feedback.v20Previous) {
      feedback.v20Previous.textContent = String(lastAdaptiveCalibrationReportV20.previousWindow.records);
    }
    if (feedback.v20CalibrationDelta) {
      const delta = lastAdaptiveCalibrationReportV20.global.sampleSufficient
        ? lastAdaptiveCalibrationReportV20.global.signals.calibrationError.delta : null;
      feedback.v20CalibrationDelta.textContent = delta === null
        ? "—"
        : (delta > 0 ? "+" : "") + Math.round(delta * 100) + "pp";
    }
    if (feedback.v20BrierDelta) {
      const delta = lastAdaptiveCalibrationReportV20.global.sampleSufficient
        ? lastAdaptiveCalibrationReportV20.global.signals.brierScore.delta : null;
      feedback.v20BrierDelta.textContent = delta === null
        ? "—"
        : (delta > 0 ? "+" : "") + delta.toFixed(3);
    }
    if (feedback.v20Alerts) {
      const segmentAlerts = lastAdaptiveCalibrationReportV20.segments.filter((item) => item.drift).length;
      const cohortAlerts = lastAdaptiveCalibrationReportV20.cohorts.filter((item) => item.drift).length;
      feedback.v20Alerts.textContent = String(segmentAlerts + cohortAlerts);
    }
    if (feedback.v20Recommendations) {
      feedback.v20Recommendations.replaceChildren();
      lastAdaptiveCalibrationReportV20.recommendations.slice(0, 5).forEach((item) => {
        const row = document.createElement("div");
        row.className = "feedback-effectiveness-row";
        const title = document.createElement("strong");
        title.textContent = item.code + " · " + item.action;
        const detail = document.createElement("small");
        detail.textContent = item.detail;
        row.append(title, detail);
        feedback.v20Recommendations.appendChild(row);
      });
    }

    const policyRowsV25 = buildObservedCalibrationRows(forecast?.rows || [], feedbackOutcomes);
    lastPolicyProposalV25 = buildRecalibrationProposal({
      report: lastAdaptiveCalibrationReportV20,
      rows: policyRowsV25,
      datasetFingerprint: plan?.datasetFingerprint || null,
      runId: plan?.runId || null,
      now: lastAdaptiveCalibrationReportV20?.generatedAt || new Date().toISOString(),
      config: { minSamples: adaptiveConfigV20.minSamples, proposalTtlHours: 24 }
    });
    const policySummaryV25 = summarisePolicy({
      proposal: lastPolicyProposalV25,
      ledger: readPolicyLedgerV25(plan?.datasetFingerprint || null),
      datasetFingerprint: plan?.datasetFingerprint || null,
      rows: policyRowsV25
    });
    if (feedback.policyActor && !feedback.policyActor.value) {
      feedback.policyActor.value = readPolicyActorV25();
    }
    if (feedback.v24Status) {
      feedback.v24Status.textContent = lastPolicyProposalV25.status;
      feedback.v24Status.dataset.state = lastPolicyProposalV25.status.toLowerCase();
    }
    if (feedback.v24Multiplier) {
      feedback.v24Multiplier.textContent = Number(lastPolicyProposalV25.multiplier || 1).toFixed(2);
    }
    if (feedback.v24Improvement) {
      feedback.v24Improvement.textContent = lastPolicyProposalV25.improvement === null
        ? "—"
        : (lastPolicyProposalV25.improvement > 0 ? "+" : "") + lastPolicyProposalV25.improvement.toFixed(3);
    }
    if (feedback.v24Active) {
      feedback.v24Active.textContent = policySummaryV25.activeMultiplier === null
        ? "none"
        : Number(policySummaryV25.activeMultiplier).toFixed(2);
    }
    if (feedback.v24Reason) {
      feedback.v24Reason.textContent = lastPolicyProposalV25.reason +
        (policySummaryV25.activePolicyInstanceId ? " · active " + policySummaryV25.activePolicyInstanceId : "");
    }
    if (feedback.v24Replay) feedback.v24Replay.textContent = lastPolicyProposalV25.replayFingerprint || "—";
    if (feedback.v24Rows) feedback.v24Rows.textContent = lastPolicyProposalV25.rowsFingerprint || "—";
    if (feedback.v24Integrity) feedback.v24Integrity.textContent = policySummaryV25.integrity;
    if (feedback.v24PolicyId) feedback.v24PolicyId.textContent = policySummaryV25.activePolicyInstanceId || "none";
    if (feedback.v24Deviation) {
      feedback.v24Deviation.textContent = policySummaryV25.baseDeviation === null
        ? "0.0pp"
        : ((policySummaryV25.baseDeviation > 0 ? "+" : "") + (Number(policySummaryV25.baseDeviation) * 100).toFixed(1) + "pp");
    }
    if (feedback.v24Actor) {
      feedback.v24Actor.textContent = policySummaryV25.activeActor || normaliseActor(feedback.policyActor?.value) || "—";
    }
    if (feedback.v24SourceRun) {
      feedback.v24SourceRun.textContent = policySummaryV25.sourceRunId || "—";
    }
    if (feedback.v24Lineage) {
      feedback.v24Lineage.textContent =
        policySummaryV25.activeLineageFingerprint ||
        policySummaryV25.proposalLineageFingerprint ||
        "—";
    }

    const policyEvidenceV26 = buildPolicyEvidenceBundle({
      datasetFingerprint: plan?.datasetFingerprint || null,
      proposal: lastPolicyProposalV25,
      ledger: readPolicyLedgerV25(plan?.datasetFingerprint || null),
      rows: policyRowsV25,
      exportedAt: new Date().toISOString()
    });
    if (feedback.v26Manifest) feedback.v26Manifest.textContent = policyEvidenceV26.manifestFingerprint || "—";
    if (feedback.v26Verification) feedback.v26Verification.textContent =
      policyEvidenceV26.verification?.reason || policyEvidenceV26.reason || "—";
    if (feedback.v26Status) {
      feedback.v26Status.textContent = policyEvidenceV26.verification?.reason || policyEvidenceV26.reason || "—";
      feedback.v26Status.dataset.state = policyEvidenceV26.verification?.valid ? "ok" : "error";
    }

    if (feedback.v27Key) {
      feedback.v27Key.textContent = policyEvidenceSignerV27?.keyFingerprint || "NOT GENERATED";
    }
    if (feedback.v27Status) {
      feedback.v27Status.textContent = policyEvidenceSignerV27
        ? "SIGNER READY · " + policyEvidenceSignerV27.keyFingerprint
        : "NO SIGNER";
      feedback.v27Status.dataset.state = policyEvidenceSignerV27 ? "ok" : "controlled";
    }

    if (feedback.v28Registry) {
      const trustState = awaitableTrustRegistrySummary(policyTrustRegistryV28);
      feedback.v28Registry.textContent = trustState;
    }
    if (feedback.v28Key && lastSignedEvidenceV27?.signature?.keyFingerprint) {
      feedback.v28Key.value = lastSignedEvidenceV27.signature.keyFingerprint;
    }
    if (feedback.v28State) {
      const selectedKey = feedback.v28Key?.value || lastSignedEvidenceV27?.signature?.keyFingerprint || "";
      const trustKey = selectedKey && selectedKey.startsWith("K28-")
        ? selectedKey
        : "";
      const currentSigner = trustKey
        ? resolveTrustedSigner(policyTrustRegistryV28, trustKey, new Date().toISOString())
        : null;
      feedback.v28State.textContent = currentSigner?.state || (trustKey ? "NOT TRUSTED" : "UNKNOWN");
    }

    lastCalibrationReportV19 = buildCalibrationV19Report(
      forecast?.rows || [],
      feedbackOutcomes,
      plan?.datasetFingerprint || null
    );

    if (feedback.total) feedback.total.textContent = String(analysis.summary.total);
    if (feedback.positiveRate) feedback.positiveRate.textContent = Math.round(analysis.summary.positiveRate * 100) + "%";
    if (feedback.winRate) feedback.winRate.textContent = Math.round(analysis.summary.winRate * 100) + "%";
    if (feedback.variance) feedback.variance.textContent = formatMoneyLocal(analysis.summary.valueVariance);
    if (feedback.calibration) {
      feedback.calibration.textContent = analysis.calibration.calibrationError === null
        ? "—"
        : (analysis.calibration.calibrationError > 0 ? "+" : "") +
          Math.round(analysis.calibration.calibrationError * 100) + "pp";
    }
    if (feedback.sla) {
      feedback.sla.textContent = analysis.summary.slaAdherence === null
        ? "—"
        : Math.round(analysis.summary.slaAdherence * 100) + "%";
    }
    if (feedback.effectiveness) {
      feedback.effectiveness.replaceChildren();
      if (!analysis.effectiveness.length) {
        const empty = document.createElement("div");
        empty.className = "feedback-empty";
        empty.textContent = "Registra un outcome para medir qué acciones están funcionando.";
        feedback.effectiveness.appendChild(empty);
      } else {
        analysis.effectiveness.slice(0, 5).forEach((item) => {
          const row = document.createElement("div");
          row.className = "feedback-effectiveness-row";
          const label = document.createElement("strong");
          label.textContent = item.action;
          const meta = document.createElement("small");
          meta.textContent = Math.round(item.positiveRate * 100) + "% positive · " +
            Math.round(item.winRate * 100) + "% win · Δ " + formatMoneyLocal(item.valueVariance);
          row.append(label, meta);
          feedback.effectiveness.appendChild(row);
        });
      }
    }
  };


  const decisionTrace = {
    state: qs("#traceState"),
    runId: qs("#traceRunId"),
    empty: qs("#decisionTraceEmpty"),
    content: qs("#decisionTraceContent"),
    inputs: qs("#traceInputs"),
    decision: qs("#traceDecision"),
    commercial: qs("#traceCommercial"),
    risk: qs("#traceRisk"),
    proposal: qs("#traceProposal"),
    approval: qs("#traceApproval"),
    execution: qs("#traceExecution")
  };
  const impact = qs("#impactList");
  const impactMeta = qs("#impactMeta");
  const impactMetrics = {
    changed: qs("#impactChanged"), promoted: qs("#impactPromoted"),
    demoted: qs("#impactDemoted"), blocked: qs("#impactBlocked")
  };
  const bars = {
    qualified: qs("#barQualified"), nurture: qs("#barNurture"),
    new: qs("#barNew"), blocked: qs("#barBlocked")
  };

  const scenarios = Object.freeze({
    balanced: { fit: 35, intent: 30, engagement: 20, urgency: 15 },
    growth: { fit: 25, intent: 40, engagement: 15, urgency: 20 },
    retention: { fit: 30, intent: 15, engagement: 40, urgency: 15 },
    speed: { fit: 20, intent: 25, engagement: 10, urgency: 45 }
  });

  const SETTINGS_KEY = "revops-studio:control-room:v7";
  const HISTORY_KEY = "revops-studio:run-history:v8";
  let evaluated = [];
  let approved = false;
  let dataSource = "demo";
  let activeScenario = "balanced";
  let sourceRecords = demoSeed;
  let lastSnapshot = null;
  let lastWorkflowPlan = null;
  let lastExecutionLedger = null;
  let lastOutcomeLedger = null;
  let lastOutcomeRunId = null;
  let lastFeedbackAnalysis = null;
  let activeTableStage = "all";
  let guidedStep = 0;
  let feedbackOutcomes = [];
  let policyEvidenceSignerV27 = null;
  let policyTrustRegistryV28 = readPolicyTrustRegistryV28();
  let trustRootKeyPairV29 = null;
  let signedTrustRootSnapshotV29 = readTrustRootSnapshotV29();
  let trustFabricKeysV30 = [];
  let trustFabricV30 = null;
  let signedTrustFabricCheckpointV30 = readTrustFabricCheckpointV30();
  let transparencyLogV31 = readTransparencyLogV31();
  let transparencyWitnessV31 = null;
  let lastDecisionCertificateV32 = null;
  let lastSignedEvidenceV27 = null;
  let lastCalibrationReportV19 = null;
  let lastAdaptiveCalibrationReportV20 = null;
  let lastCalibrationCapturedAtV20 = null;
  let lastPolicyProposalV25 = null;

  const readStored = () => {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null"); }
    catch { return null; }
  };

  const writeStored = (config) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(config));
    } catch {}
  };

  const readHistory = () => {
    try {
      const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(value) ? value.slice(0, 8) : [];
    } catch { return []; }
  };

  const writeHistory = (entries) => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 8))); } catch {}
  };

  let history = readHistory();

  const saveHistoryEntry = (snapshot, summary) => {
    const entry = {
      runId: snapshot.runId,
      createdAt: snapshot.createdAt,
      source: snapshot.source,
      scenario: snapshot.scenario,
      weights: Object.fromEntries(
        Object.entries(snapshot.weights).map(([key, value]) => [key, Math.round(value * 100)])
      ),
      weightMode: "percent",
      thresholds: snapshot.thresholds,
      forecast: snapshot.forecast,
      total: summary.total,
      averageScore: summary.averageScore,
      qualificationRate: summary.qualificationRate,
      blocked: summary.qualityIssues
    };
    history = [entry, ...history.filter((item) => item.runId !== entry.runId)].slice(0, 8);
    writeHistory(history);
  };

  const renderHistory = () => {
    if (!runHistory) return;
    runHistory.replaceChildren();
    if (!history.length) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = "Todavía no hay ejecuciones guardadas en este navegador.";
      runHistory.appendChild(empty);
      return;
    }

    history.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "history-row";
      button.dataset.runId = entry.runId;

      const main = document.createElement("span");
      main.className = "history-main";
      const id = document.createElement("strong");
      id.textContent = entry.runId;
      const meta = document.createElement("small");
      meta.textContent = new Date(entry.createdAt).toLocaleString("es-ES", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
      }) + " · " + entry.scenario + " · " + entry.source;
      main.append(id, meta);

      const stats = document.createElement("span");
      stats.className = "history-stats";
      stats.textContent = entry.averageScore + " avg · " +
        Math.round(entry.qualificationRate * 100) + "% Q · " + entry.blocked + " blocked";

      button.append(main, stats);
      button.addEventListener("click", () => {
        applyConfig(entry);
        addAudit(auditEvent("HISTORY_LOAD", { id: entry.runId }, "configuration restored"));
        persistAndRender(false);
        status.dataset.state = "ok";
        status.textContent = "Configuración restaurada desde " + entry.runId + ". Los datos nunca se guardan en el historial.";
      });
      runHistory.appendChild(button);
    });
  };

  const getWeights = () =>
    Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, Number(input?.value) || 0]));

  const getThresholds = () =>
    normaliseThresholds({
      qualified: Number(thresholds.qualified?.value),
      nurture: Number(thresholds.nurture?.value)
    });

  const setThresholds = (next) => {
    let qualified = Math.round(Number(next.qualified) || 75);
    let nurture = Math.round(Number(next.nurture) || 50);
    qualified = Math.max(2, Math.min(100, qualified));
    nurture = Math.max(1, Math.min(99, nurture));
    if (qualified <= nurture) {
      if (next.changed === "qualified") nurture = Math.max(1, qualified - 1);
      else qualified = Math.min(100, nurture + 1);
    }
    thresholds.qualified.value = String(qualified);
    thresholds.nurture.value = String(nurture);
  };

  const renderWeights = () => {
    const weights = getWeights();
    const sum = Object.values(weights).reduce((a, b) => a + b, 0) || 100;
    Object.entries(values).forEach(([key, output]) => {
      if (output) output.textContent = Math.round(weights[key] / sum * 100) + "%";
    });
    if (totalWeight) totalWeight.textContent = Math.round(sum) + "%";
    const currentThresholds = getThresholds();
    if (thresholdValues.qualified) thresholdValues.qualified.textContent = String(currentThresholds.qualified);
    if (thresholdValues.nurture) thresholdValues.nurture.textContent = String(currentThresholds.nurture);
  };

  const escapeConfig = (config) => {
    const json = JSON.stringify(config);
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  };

  const decodeConfig = (encoded) => {
    try {
      const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((encoded.length + 3) % 4);
      const binary = atob(normalized);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch { return null; }
  };

  const getForecastConfig = () => {
    const base = {
      qualified: Number(forecast.probabilities.qualified?.value) / 100,
      nurture: Number(forecast.probabilities.nurture?.value) / 100,
      new: Number(forecast.probabilities.new?.value) / 100,
      downside: Number(forecast.probabilities.downside?.value) / 100,
      upside: Number(forecast.probabilities.upside?.value) / 100
    };
    const fingerprint =
      lastWorkflowPlan?.datasetFingerprint ||
      lastSnapshot?.datasetFingerprint ||
      null;
    return applyPolicyToAssumptions(base, activePolicy(readPolicyLedgerV25(fingerprint), fingerprint));
  };

  const currentConfig = () => ({
    weights: getWeights(),
    weightMode: "percent",
    thresholds: getThresholds(),
    forecast: getForecastConfig(),
    scenario: activeScenario
  });

  const updateShareUrl = () => {
    const encoded = escapeConfig(currentConfig());
    const url = new URL(window.location.href);
    url.hash = "config=" + encoded;
    if (shareConfig) shareConfig.value = url.toString();
    return url.toString();
  };

  const applyConfig = (config = {}) => {
    const weightSet = config.weights || DEFAULT_WEIGHTS;
    const values = Object.values(weightSet).map(Number).filter(Number.isFinite);
    const legacyNormalised = !config.weightMode && values.length === 4 && values.reduce((sum, value) => sum + value, 0) <= 1.01;
    Object.keys(inputs).forEach((key) => {
      if (!inputs[key]) return;
      const value = Number(weightSet[key]);
      if (!Number.isFinite(value)) {
        inputs[key].value = String(Math.round(DEFAULT_WEIGHTS[key] * 100));
        return;
      }
      inputs[key].value = String(Math.round(
        config.weightMode === "normalized" || legacyNormalised ? value * 100 : value
      ));
    });
    setThresholds({ ...(config.thresholds || {}), changed: "qualified" });
    const forecastSet = config.forecast || {};
    Object.keys(forecast.probabilities).forEach((key) => {
      const input = forecast.probabilities[key];
      if (!input) return;
      const value = Number(forecastSet[key]);
      if (Number.isFinite(value)) {
        input.value = String(Math.round(value <= 1 ? value * 100 : value));
      }
    });
    if (config.scenario && scenarios[config.scenario]) activeScenario = config.scenario;
    qsa("[data-scenario]").forEach((item) => item.classList.toggle("is-active", item.dataset.scenario === activeScenario));
  };

  const addAudit = (entry) => {
    if (!audit) return;
    const line = document.createElement("div");
    line.className = "audit-line";
    line.textContent = entry.at.slice(11, 19) + " · " + entry.action + " · " + entry.leadId + " · " + entry.detail;
    audit.prepend(line);
    while (audit.children.length > 12) audit.lastElementChild.remove();
  };

  const renderImpact = () => {
    const baseline = evaluateBatch(sourceRecords, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS);
    const diff = compareEvaluations(baseline, evaluated);
    if (impactMeta) {
      impactMeta.textContent = diff.changed + " changes · Δ avg " + (diff.averageScoreDelta > 0 ? "+" : "") + diff.averageScoreDelta;
    }
    Object.entries(impactMetrics).forEach(([key, output]) => {
      if (output) output.textContent = String(diff[key] || 0);
    });
    if (!impact) return;
    impact.replaceChildren();
    if (!diff.changes.length) {
      const empty = document.createElement("div");
      empty.className = "impact-empty";
      empty.textContent = "Sin cambios frente al modelo base.";
      impact.appendChild(empty);
      return;
    }
    diff.changes.slice(0, 8).forEach((item) => {
      const row = document.createElement("div");
      row.className = "impact-row";
      const account = document.createElement("strong");
      account.textContent = item.account;
      const stage = document.createElement("span");
      stage.textContent = item.fromStage + " → " + item.toStage;
      const delta = document.createElement("b");
      delta.textContent = item.scoreDelta === null ? item.kind : (item.scoreDelta > 0 ? "+" : "") + item.scoreDelta;
      row.append(account, stage, delta);
      impact.appendChild(row);
    });
  };

  const renderMatrix = () => {
    if (!scenarioMatrix) return;
    const summaries = evaluateScenarios(sourceRecords, scenarios, getThresholds());
    const active = summaries[activeScenario];
    if (scenarioMatrixMeta) {
      scenarioMatrixMeta.textContent = "Base: " + activeScenario.toUpperCase() + " · " + active.total + " records";
    }
    scenarioMatrix.replaceChildren();
    Object.entries(summaries).forEach(([name, summary]) => {
      const row = document.createElement("div");
      row.className = "scenario-matrix-row" + (name === activeScenario ? " is-active" : "");
      const label = document.createElement("strong");
      label.textContent = name;
      const q = document.createElement("span");
      q.textContent = (summary.byStage.qualified || 0) + " Q";
      const n = document.createElement("span");
      n.textContent = (summary.byStage.nurture || 0) + " N";
      const b = document.createElement("span");
      b.textContent = (summary.byStage.blocked || 0) + " B";
      const avg = document.createElement("b");
      avg.textContent = summary.averageScore + " avg";
      row.append(label, q, n, b, avg);
      scenarioMatrix.appendChild(row);
    });
  };

  const renderQueue = () => {
    const builtQueue = buildActionQueue(evaluated);
    const term = String(queueSearch?.value || "").trim().toLowerCase();
    const visible = builtQueue.filter((item) => !term || [item.account, item.leadId, item.stage, item.priority, item.lane, item.action].some((value) => String(value).toLowerCase().includes(term)));
    const qSummary = summariseQueue(builtQueue);
    if (queueMeta) queueMeta.textContent = qSummary.total + " actions · " + qSummary.urgent + " urgent";
    if (queueSummary) queueSummary.textContent =
      "Critical " + (qSummary.byPriority.critical || 0) +
      " · High " + (qSummary.byPriority.high || 0) +
      " · Medium " + (qSummary.byPriority.medium || 0) +
      " · Low " + (qSummary.byPriority.low || 0);
    if (!queue) return;
    queue.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "queue-empty";
      empty.textContent = term ? "Sin coincidencias en la cola." : "Ejecuta el modelo para construir una cola operativa.";
      queue.appendChild(empty);
      return;
    }
    visible.slice(0, 12).forEach((item, index) => {
      const article = document.createElement("article");
      article.className = "queue-item";
      const top = document.createElement("div");
      top.className = "queue-top";
      const rank = document.createElement("span");
      rank.className = "queue-rank";
      rank.textContent = String(index + 1).padStart(2, "0");
      const title = document.createElement("strong");
      title.textContent = item.account + " · " + item.leadId;
      const priority = document.createElement("span");
      priority.className = "queue-priority";
      priority.dataset.priority = item.priority;
      priority.textContent = item.priority.toUpperCase();
      top.append(rank, title, priority);
      const meta = document.createElement("div");
      meta.className = "queue-meta";
      meta.textContent = item.action + " · " + item.lane +
        " · SLA " + item.slaHours + "h · " + item.owner +
        (item.stale ? " · STALE" : "");
      const why = document.createElement("div");
      why.className = "queue-reason";
      why.textContent = item.reason;
      article.append(top, meta, why);
      queue.appendChild(article);
    });
  };

  const render = () => {
    const summary = summarisePipeline(evaluated);
    const commerce = commercialMetrics(evaluated);
    const formatMoney = (value) => new Intl.NumberFormat("es-ES", {
      style: "currency", currency: "EUR", maximumFractionDigits: 0
    }).format(value);

    metrics.total.textContent = String(summary.total);
    metrics.qualified.textContent = String(summary.byStage.qualified || 0);
    metrics.nurture.textContent = String(summary.byStage.nurture || 0);
    metrics.avg.textContent = String(summary.averageScore);
    metrics.quality.textContent = String(summary.qualityIssues);
    metrics.rate.textContent = Math.round(summary.qualificationRate * 100) + "%";

    if (commercial.pipeline) commercial.pipeline.textContent = formatMoney(commerce.pipelineValue);
    if (commercial.weighted) commercial.weighted.textContent = formatMoney(commerce.weightedPipeline);
    if (commercial.qualified) commercial.qualified.textContent = formatMoney(commerce.qualifiedValue);
    if (commercial.stale) commercial.stale.textContent =
      commerce.staleRecords + " · " + Math.round(commerce.staleRate * 100) + "%";
    if (commercial.coverage) {
      const totalOptional = evaluated.length * 6;
      const presentOptional = evaluated.reduce((sum, lead) =>
        sum + ["value", "owner", "segment", "source", "cohort", "lastTouchDays"].filter((key) => {
          const value = lead[key];
          const numericField = key === "value" || key === "lastTouchDays";
          return numericField
            ? Number.isFinite(Number(value))
            : String(value ?? "").trim() !== "";
        }).length, 0
      );
      commercial.coverage.textContent = totalOptional
        ? Math.round(presentOptional / totalOptional * 100) + "%"
        : "0%";
    }

    const renderMap = (target, map, suffix = "") => {
      if (!target) return;
      target.replaceChildren();
      Object.entries(map).sort((a,b) => b[1] - a[1]).forEach(([key, value]) => {
        const row = document.createElement("div");
        row.className = "breakdown-row";
        const label = document.createElement("span");
        label.textContent = key;
        const amount = document.createElement("b");
        amount.textContent = String(value) + suffix;
        row.append(label, amount);
        target.appendChild(row);
      });
    };
    renderMap(commercial.segments, commerce.segments);
    renderMap(commercial.owners, commerce.owners);

    const forecastAssumptions = getForecastConfig();
    const analysis = buildRunAnalysis(evaluated, forecastAssumptions);
    const forecastResult = analysis.forecast;
    const scenarioResult = analysis.scenarios;
    const intelligenceResult = analysis.intelligence;
    const executiveResult = analysis.executive;
    const scenarioMoney = (name) => formatMoney(scenarioResult[name]?.expectedValue || 0);

    if (forecast.downside) forecast.downside.textContent = scenarioMoney("downside");
    if (forecast.base) forecast.base.textContent = scenarioMoney("base");
    if (forecast.upside) forecast.upside.textContent = scenarioMoney("upside");
    if (forecast.coverage) forecast.coverage.textContent = Math.round(forecastResult.expectedCoverage * 100) + "%";
    if (forecast.spread) forecast.spread.textContent =
      formatMoney(Math.max(0, (scenarioResult.upside?.expectedValue || 0) - (scenarioResult.downside?.expectedValue || 0)));
    if (forecast.concentration) forecast.concentration.textContent = Math.round(forecastResult.topAccountShare * 100) + "%";

    Object.entries(forecast.values).forEach(([key, output]) => {
      const input = forecast.probabilities[key];
      if (output && input) output.textContent = String(Math.round(Number(input.value))) + (key.includes("Mult") ? "%" : "%");
    });

    if (forecast.rows) {
       forecast.rows.replaceChildren();
       Object.entries(forecastResult.bySegment)
         .sort((a, b) => b[1].expectedValue - a[1].expectedValue)
         .forEach(([segment, item]) => {
           const row = document.createElement("div");
           row.className = "forecast-segment-row";
           const label = document.createElement("span");
           label.textContent = segment;
           const value = document.createElement("b");
           value.textContent = formatMoney(item.expectedValue);
           const meta = document.createElement("small");
           meta.textContent = item.count + " records · " + formatMoney(item.value) + " pipeline";
           row.append(label, value, meta);
           forecast.rows.appendChild(row);
         });
     }

     const intelSignalLabels = { controlled: "CONTROLLED", attention: "ATTENTION", critical: "CRITICAL" };
     if (intelligence.signal) {
       intelligence.signal.textContent = intelSignalLabels[intelligenceResult.signal] || "UNKNOWN";
       intelligence.signal.dataset.state = intelligenceResult.signal;
     }
     if (intelligence.health) intelligence.health.textContent =
       intelligenceResult.health.average + " · " +
       intelligenceResult.health.healthy + " healthy · " +
       (intelligenceResult.health.risk + intelligenceResult.health.critical) + " risk";
     if (intelligence.risk) intelligence.risk.textContent =
       intelligenceResult.rules.critical + " critical · " + intelligenceResult.rules.high + " high";
     if (intelligence.leakage) intelligence.leakage.textContent = formatMoney(intelligenceResult.leakage.atRiskValue);
     if (intelligence.anomalies) intelligence.anomalies.textContent =
       intelligenceResult.anomalies.total + " · " + intelligenceResult.anomalies.high + " high";

     const renderIntelCards = (target, items, emptyText) => {
       if (!target) return;
       target.replaceChildren();
       if (!items.length) {
         const empty = document.createElement("div");
         empty.className = "intel-empty";
         empty.textContent = emptyText;
         target.appendChild(empty);
         return;
       }
       items.slice(0, 6).forEach((item) => {
         const row = document.createElement("article");
         row.className = "intel-item";
         const title = document.createElement("strong");
         title.textContent = item.title;
         const detail = document.createElement("small");
         detail.textContent = item.detail + (item.value ? " · " + formatMoney(item.value) : "");
         row.append(title, detail);
         target.appendChild(row);
       });
     };

     renderIntelCards(intelligence.priorities, intelligenceResult.priorities, "No hay riesgos críticos en este run.");
     renderIntelCards(intelligence.opportunities, intelligenceResult.opportunities, "No hay oportunidades destacadas.");

     const renderIntelMap = (target, items, labelBuilder) => {
       if (!target) return;
       target.replaceChildren();
       items.slice(0, 6).forEach((item) => {
         const row = document.createElement("div");
         row.className = "intel-row";
         const label = document.createElement("span");
         label.textContent = labelBuilder(item);
         const value = document.createElement("b");
         value.textContent = formatMoney(item.expectedValue) + " · " + Math.round(item.qualifiedRate * 100) + "% Q";
         row.append(label, value);
         target.appendChild(row);
       });
     };
     renderIntelMap(intelligence.segments, Object.values(intelligenceResult.segments), (item) => item.segment);
     renderIntelMap(intelligence.cohorts, intelligenceResult.cohorts, (item) => item.cohort);

     if (executiveReadout.signal) {
       executiveReadout.signal.textContent = executiveResult.signal.toUpperCase();
       executiveReadout.signal.dataset.state = executiveResult.signal;
     }
     if (executiveReadout.headline) executiveReadout.headline.textContent = executiveResult.headline;
     if (executiveReadout.meta) executiveReadout.meta.textContent =
       executiveResult.summary.qualified + " qualified · " +
       executiveResult.summary.blocked + " blocked · " +
       formatMoney(executiveResult.summary.pipelineValue) + " active pipeline";
     if (executiveReadout.owner) executiveReadout.owner.textContent = executiveResult.topOwner
       ? executiveResult.topOwner.owner + " · " + formatMoney(executiveResult.topOwner.expectedValue) + " expected"
       : "No owner concentration";
     if (executiveReadout.segment) executiveReadout.segment.textContent = executiveResult.topSegment
       ? executiveResult.topSegment.segment + " · " + formatMoney(executiveResult.topSegment.expectedValue) + " expected"
       : "No segment concentration";

     const renderBriefList = (target, items) => {
       if (!target) return;
       target.replaceChildren();
       items.forEach((item) => {
         const li = document.createElement("li");
         li.textContent = item;
         target.appendChild(li);
       });
     };
     renderBriefList(executiveReadout.facts, executiveResult.keyFacts);
     renderBriefList(executiveReadout.actions, executiveResult.actions);
     if (executiveReadout.text) {
       executiveReadout.text.value =
         executiveResult.headline + "\n\n" +
         executiveResult.keyFacts.map((item) => "• " + item).join("\n") + "\n\n" +
         "Recommended actions\n" +
         executiveResult.actions.map((item) => "• " + item).join("\n");
     }

     if (ownerMatrix) {
       ownerMatrix.replaceChildren();
       if (!analysis.owners.length) {
         const empty = document.createElement("div");
         empty.className = "owner-matrix-empty";
         empty.textContent = "No hay portfolios activos en este run.";
         ownerMatrix.appendChild(empty);
       } else {
         analysis.owners.slice(0, 10).forEach((owner) => {
           const row = document.createElement("div");
           row.className = "owner-matrix-row";
           const name = document.createElement("strong");
           name.textContent = owner.owner;
           const pipeline = document.createElement("span");
           pipeline.textContent = formatMoney(owner.pipelineValue) + " pipeline";
           const expected = document.createElement("b");
           expected.textContent = formatMoney(owner.expectedValue) + " expected";
           const rates = document.createElement("small");
           rates.textContent =
             Math.round(owner.qualifiedRate * 100) + "% Q · " +
             Math.round(owner.staleRate * 100) + "% stale · " +
             owner.riskFindings + " high/critical";
           row.append(name, pipeline, expected, rates);
           ownerMatrix.appendChild(row);
         });
       }
     }


     if (workflowControl.plan) {
       const workflowAssumptions = forecastAssumptions;
       lastWorkflowPlan = buildOperationalPlan(
         evaluated,
         workflowAssumptions,
         {},
         {
           runId: lastSnapshot?.runId || null,
           now: new Date().toISOString(),
           weights: getWeights(),
           thresholds: getThresholds(),
           source: dataSource,
           scenario: activeScenario
         }
       );
       const plan = lastWorkflowPlan;
       if (!lastExecutionLedger || lastExecutionLedger.runId !== plan.runId) {
         const ledgerResult = buildExecutionLedger(plan, {
           source: dataSource,
           actor: "operator"
         });
         lastExecutionLedger = ledgerResult.accepted ? ledgerResult.ledger : null;
       }
       if (executionLedger.status && lastExecutionLedger) {
         const replay = replayExecutionLedger(lastExecutionLedger);
         executionLedger.status.textContent = replay.valid ? "LEDGER VALID" : "LEDGER REJECTED";
         executionLedger.status.dataset.state = replay.valid ? "controlled" : "error";
         executionLedger.meta.textContent =
           lastExecutionLedger.ledgerId + " · " + replay.eventCount + " events";
         executionLedger.sequence.textContent = String(lastExecutionLedger.sequence);
         executionLedger.head.textContent = lastExecutionLedger.headHash;
         executionLedger.approvals.textContent = String(replay.state?.counters?.approvals || 0);
         executionLedger.contracts.textContent = String(replay.state?.counters?.contracts || 0);
         executionLedger.simulations.textContent = String(replay.state?.counters?.simulations || 0);
         if (executionLedger.outcomes) executionLedger.outcomes.textContent = String(replay.state?.counters?.outcomes || 0);
         executionLedger.events?.replaceChildren(
           ...lastExecutionLedger.events.slice(-6).reverse().map((event) => {
             const row = document.createElement("div");
             row.className = "ledger-event";
             const type = document.createElement("strong");
             type.textContent = event.type;
             const meta = document.createElement("small");
             meta.textContent = "#" + event.sequence + " · " + (event.leadId || "RUN") + " · " + event.status;
             row.append(type, meta);
             return row;
           })
         );
       }
       const adapterReady = plan.externalExecution.enabled === false &&
         plan.externalExecution.mode === "SIMULATION_ONLY";
       if (workflowControl.status) {
         workflowControl.status.textContent = adapterReady ? "CONTROLLED" : "REVIEW";
         workflowControl.status.dataset.state = adapterReady ? "controlled" : "attention";
       }
       if (workflowControl.meta) workflowControl.meta.textContent =
         plan.summary.total + " actions · " + plan.summary.urgent + " urgent";
       if (workflowControl.ready) workflowControl.ready.textContent = String(plan.summary.ready);
       if (workflowControl.approval) workflowControl.approval.textContent = String(plan.summary.approvalPending);
       if (workflowControl.blocked) workflowControl.blocked.textContent = String(plan.summary.blocked);
       if (workflowControl.adapter) workflowControl.adapter.textContent =
         plan.externalExecution.adapter + " · " + plan.externalExecution.mode;
       if (workflowControl.fingerprint) workflowControl.fingerprint.textContent = plan.datasetFingerprint.toUpperCase();
       if (workflowControl.plan) {
         workflowControl.plan.replaceChildren();
         if (!plan.actions.length) {
           const empty = document.createElement("div");
           empty.className = "workflow-empty";
           empty.textContent = "No hay trabajo operativo en este run.";
           workflowControl.plan.appendChild(empty);
         } else {
           plan.actions.slice(0, 8).forEach((item) => {
             const row = document.createElement("div");
             row.className = "workflow-row";
             const main = document.createElement("span");
             main.className = "workflow-main";
             const title = document.createElement("strong");
             title.textContent = "#" + item.rank + " · " + item.account;
             const meta = document.createElement("small");
             meta.textContent = item.leadId + " · " + item.lane + " · SLA " + item.slaHours + "h";
             main.append(title, meta);
             const state = document.createElement("b");
             state.textContent = item.state.replaceAll("_", " ");
             row.append(main, state);
             workflowControl.plan.appendChild(row);
           });
         }
       }

       renderFeedback(plan, forecastResult);

       if (workflowImpact.proposed) {
         const impactResult = buildWorkflowImpact(evaluated, plan);
         workflowImpact.proposed.textContent = String(impactResult.summary.proposed);
         workflowImpact.applied.textContent = String(impactResult.summary.applied);
         workflowImpact.pending.textContent = String(impactResult.summary.pendingApproval);
         workflowImpact.qualificationDelta.textContent =
           (impactResult.qualificationDelta > 0 ? "+" : "") + impactResult.qualificationDelta;
         workflowImpact.stageDelta.textContent =
           "Q " + (impactResult.stageDelta.qualified > 0 ? "+" : "") + impactResult.stageDelta.qualified +
           " · N " + (impactResult.stageDelta.nurture > 0 ? "+" : "") + impactResult.stageDelta.nurture +
           " · New " + (impactResult.stageDelta.new > 0 ? "+" : "") + impactResult.stageDelta.new +
           " · Blocked " + (impactResult.stageDelta.blocked > 0 ? "+" : "") + impactResult.stageDelta.blocked;
       }
     }

     Object.entries(bars).forEach(([stage, bar]) => {
      if (bar) bar.style.width = (summary.total ? (summary.byStage[stage] || 0) / summary.total * 100 : 0) + "%";
    });
    if (shapeLabel) {
      shapeLabel.textContent = summary.total
        ? (summary.byStage.qualified || 0) + " qualified · " +
          (summary.byStage.nurture || 0) + " nurture · " +
          (summary.byStage.new || 0) + " new · " +
          (summary.byStage.blocked || 0) + " blocked"
        : "—";
    }

    renderImpact();
    renderMatrix();
    renderQueue();

    rows.replaceChildren();
    const visibleLeads = evaluated.filter((lead) => {
      const stageMatch = activeTableStage === "all" || lead.stage === activeTableStage;
      const staleMatch = !staleOnly?.checked || ((Number(lead.lastTouchDays) || 0) > 14);
      return stageMatch && staleMatch;
    });

    visibleLeads.forEach((lead) => {
      const tr = document.createElement("tr");
      tr.tabIndex = 0;
      tr.dataset.id = lead.id;
      const cells = [lead.id, lead.account, lead.score ?? "—", lead.stage, lead.nextAction];
      cells.forEach((value, index) => {
        const td = document.createElement("td");
        td.textContent = String(value);
        if (index === 3) td.dataset.state = lead.stage;
        tr.appendChild(td);
      });
      const inspect = () => {
        if (!detail) return;
        if (lead.score === null) {
          detail.innerHTML = "";
          const title = document.createElement("strong");
          title.textContent = lead.id + " · BLOCKED";
          const text = document.createElement("p");
          text.textContent = "Errores: " + lead.quality.errors.join(", ");
          detail.append(title, text);
          renderDecisionTrace(lead);
          return;
        }
        detail.innerHTML = "";
        const head = document.createElement("div");
        head.className = "inspection-head";
        const title = document.createElement("strong");
        title.textContent = lead.account + " · " + lead.id;
        const state = document.createElement("span");
        state.className = "inspection-state";
        state.dataset.state = lead.stage;
        state.textContent = lead.stage.toUpperCase();
        head.append(title, state);
        const body = document.createElement("div");
        body.className = "inspection-body";
        const p = document.createElement("p");
        p.textContent = "Score " + lead.score + " · " + lead.nextAction;
        const grid = document.createElement("div");
        grid.className = "contribution-grid";
        Object.entries(lead.breakdown).forEach(([key, value]) => {
          const cell = document.createElement("div");
          cell.className = "contribution";
          const label = document.createElement("span");
          label.textContent = key;
          const amount = document.createElement("b");
          amount.textContent = "+" + value;
          cell.append(label, amount);
          grid.appendChild(cell);
        });
        body.append(p, grid);
        detail.append(head, body);
        renderDecisionTrace(lead);
        qsa(".demo-table tbody tr").forEach((item) => item.classList.toggle("is-selected", item === tr));
      };
      tr.addEventListener("click", inspect);
      tr.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inspect(); }
      });
      rows.appendChild(tr);
    });
  };

  const renderTraceFacts = (target, facts) => {
    if (!target) return;
    target.replaceChildren();
    facts.forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "trace-fact";
      const key = document.createElement("span");
      key.textContent = label;
      const val = document.createElement("b");
      val.textContent = String(value);
      row.append(key, val);
      target.appendChild(row);
    });
  };

  const renderDecisionTrace = (lead) => {
    if (!decisionTrace.content || !decisionTrace.empty) return;
    const trace = buildDecisionTrace(
      lead,
      getForecastConfig(),
      {},
      { runId: lastSnapshot?.runId || null }
    );

    decisionTrace.empty.hidden = true;
    decisionTrace.content.hidden = false;
    if (decisionTrace.state) {
      decisionTrace.state.textContent = trace.decision.stage.toUpperCase();
      decisionTrace.state.dataset.state = trace.decision.stage;
    }
    if (decisionTrace.runId) decisionTrace.runId.textContent = trace.runId || "CURRENT RUN";

    renderTraceFacts(decisionTrace.inputs, [
      ["ID", trace.input.id || "—"],
      ["Account", trace.input.account],
      ["Fit", trace.input.signals.fit ?? "—"],
      ["Intent", trace.input.signals.intent ?? "—"],
      ["Engagement", trace.input.signals.engagement ?? "—"],
      ["Urgency", trace.input.signals.urgency ?? "—"],
      ["Data quality", trace.input.quality?.valid ? "VALID" : "BLOCKED"]
    ]);

    const contributions = Object.entries(trace.decision.breakdown || {})
      .map(([key, value]) => [key, "+" + value]);
    renderTraceFacts(decisionTrace.decision, [
      ["Score", trace.decision.score ?? "—"],
      ["Stage", trace.decision.stage],
      ...contributions,
      ["Next action", trace.decision.nextAction]
    ]);

    renderTraceFacts(decisionTrace.commercial, [
      ["Value", trace.commercial.value === null ? "—" : formatEuro(trace.commercial.value)],
      ["Owner", trace.commercial.owner],
      ["Segment", trace.commercial.segment],
      ["Source", trace.commercial.source || "—"],
      ["Last touch", trace.commercial.lastTouchDays === null ? "—" : trace.commercial.lastTouchDays + "d"],
      ["Forecast", formatEuro(trace.commercial.expectedValue) + " · " + Math.round(trace.commercial.probability * 100) + "%"]
    ]);

    if (decisionTrace.risk) {
      decisionTrace.risk.replaceChildren();
      const health = document.createElement("div");
      health.className = "trace-status";
      health.textContent = "Health " + (trace.health.score ?? "—") + " · " + String(trace.health.status).toUpperCase() + " · confidence " + trace.health.confidence;
      decisionTrace.risk.appendChild(health);
      if (!trace.risks.length) {
        const empty = document.createElement("div");
        empty.className = "trace-empty";
        empty.textContent = "No high-severity business rule found.";
        decisionTrace.risk.appendChild(empty);
      } else {
        trace.risks.slice(0, 5).forEach((risk) => {
          const item = document.createElement("div");
          item.className = "trace-risk";
          const title = document.createElement("strong");
          title.textContent = risk.code + " · " + risk.severity.toUpperCase();
          const detail = document.createElement("small");
          detail.textContent = risk.message;
          item.append(title, detail);
          decisionTrace.risk.appendChild(item);
        });
      }
    }

    renderTraceFacts(decisionTrace.proposal, [
      ["Action", trace.proposal.action],
      ["Lane", trace.proposal.lane],
      ["Priority", trace.proposal.priority],
      ["SLA", trace.proposal.slaHours + "h"],
      ["Transition", trace.proposal.to ? trace.proposal.from + " → " + trace.proposal.to : "No stage transition"]
    ]);
    renderTraceFacts(decisionTrace.approval, [
      ["Required", trace.approval.required ? "YES" : "NO"],
      ["Status", trace.approval.status.toUpperCase()],
      ["Reason", trace.approval.reason]
    ]);
    renderTraceFacts(decisionTrace.execution, [
      ["State", trace.execution.state],
      ["Mode", trace.execution.mode],
      ["Boundary", "Outside system: NOT CALLED"]
    ]);
  };

  const guidedSteps = [
    {
      title: "Start with the baseline",
      copy: "Primero observa valor, stages y calidad. Todavía no cambias ninguna regla.",
      target: "commercial-title",
      action: () => {
        activeScenario = "balanced";
        Object.entries(scenarios.balanced).forEach(([key, value]) => { if (inputs[key]) inputs[key].value = String(value); });
        qsa("[data-scenario]").forEach((item) => item.classList.toggle("is-active", item.dataset.scenario === "balanced"));
        persistAndRender(false);
      }
    },
    {
      title: "Change the decision model",
      copy: "Growth cambia prioridades. El sistema vuelve a puntuar y expone el impacto, en lugar de ocultarlo.",
      target: "scenario-title",
      action: () => {
        activeScenario = "growth";
        Object.entries(scenarios.growth).forEach(([key, value]) => { if (inputs[key]) inputs[key].value = String(value); });
        qsa("[data-scenario]").forEach((item) => item.classList.toggle("is-active", item.dataset.scenario === "growth"));
        addAudit(auditEvent("GUIDED_SCENARIO", { id: "growth" }, "guided proof applied"));
        persistAndRender(false);
      }
    },
    {
      title: "Stress the forecast",
      copy: "Forecast y qualification siguen separados. Aquí tensamos upside/downside para ver exposición.",
      target: "forecast-title",
      action: () => {
        if (forecast.probabilities.downside) forecast.probabilities.downside.value = "60";
        if (forecast.probabilities.upside) forecast.probabilities.upside.value = "125";
        writeStored(currentConfig());
        updateShareUrl();
        render();
        addAudit(auditEvent("GUIDED_FORECAST", { id: "forecast" }, "forecast stress applied"));
      }
    },
    {
      title: "Read the executive decision",
      copy: "La última capa condensa health, riesgos, leakage, concentración y oportunidades para una revisión ejecutiva.",
      target: "executive-readout-title",
      action: () => render()
    }
  ];

  const renderGuided = () => {
    const step = guidedSteps[guidedStep];
    if (!step) return;
    if (guided.progress) guided.progress.textContent = String(guidedStep + 1).padStart(2, "0") + " / " + String(guidedSteps.length).padStart(2, "0");
    if (guided.title) guided.title.textContent = step.title;
    if (guided.copy) guided.copy.textContent = step.copy;
    guided.steps.forEach((item) => item.classList.toggle("is-active", Number(item.dataset.guidedStep) === guidedStep));
    if (guided.next) guided.next.textContent = guidedStep === guidedSteps.length - 1 ? "Replay proof ↻" : "Siguiente →";
  };

  const goGuided = (index) => {
    guidedStep = Math.max(0, Math.min(guidedSteps.length - 1, index));
    guidedSteps[guidedStep].action();
    qs("#" + guidedSteps[guidedStep].target)?.scrollIntoView({ behavior: "smooth", block: "center" });
    renderGuided();
  };

  const persistAndRender = (recordHistory = true) => {
    const config = currentConfig();
    writeStored(config);
    updateShareUrl();
    renderWeights();
    const now = new Date();
    const time = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    evaluated = evaluateBatch(sourceRecords, getWeights(), getThresholds());
    lastSnapshot = createRunSnapshot({
      records: sourceRecords,
      weights: getWeights(),
      thresholds: getThresholds(),
      forecast: getForecastConfig(),
      source: dataSource,
      scenario: activeScenario
    });
    lastCalibrationCapturedAtV20 = now.toISOString();
    if (datasetLabel) datasetLabel.textContent =
      (dataSource === "demo" ? "Demo dataset" : "CSV local") + " · " + evaluated.length + " records";
    if (runId) runId.textContent = lastSnapshot.runId;
    const lastRun = qs("#lastRun");
    if (lastRun) lastRun.textContent = "Última ejecución " + time + " · " + lastSnapshot.runId;
    status.dataset.state = "ok";
    status.textContent = "Evaluado en el navegador · sin llamadas de CRM/API · configuración guardable.";
    evaluated.forEach((lead) => addAudit(auditEvent("EVALUATE", lead, lead.stage + " / " + (lead.score ?? "n/a"))));
    const summary = summarisePipeline(evaluated);
    if (recordHistory) {
      saveHistoryEntry(lastSnapshot, summary);
      renderHistory();
    }
    render();
  };

  const runWithAudit = () => {
    addAudit(auditEvent("RUN", { id: "MODEL" }, "manual execution"));
    persistAndRender();
  };

  if (feedback.policyActor) feedback.policyActor.value = readPolicyActorV25();

  feedback.v25Verify?.addEventListener("click", () => {
    const fingerprint = lastWorkflowPlan?.datasetFingerprint || null;
    const ledger = readPolicyLedgerV25(fingerprint);
    const datasetRows = buildObservedCalibrationRows(
      buildRunAnalysis(evaluated, getForecastConfig()).forecast?.rows || [],
      feedbackOutcomes
    );
    const ledgerResult = replayPolicyLedger(ledger, { datasetFingerprint: fingerprint });
    const activeResult = ledgerResult.active
      ? verifyActivePolicy(ledgerResult.active, {
          rows: datasetRows,
          datasetFingerprint: fingerprint
        })
      : { valid: false, reason: "NO_ACTIVE_POLICY" };

    const verified = ledgerResult.valid && (!ledgerResult.active || activeResult.valid);
    if (feedback.v25Reason) {
      feedback.v25Reason.textContent = ledgerResult.reason + " · " + activeResult.reason;
    }
    if (feedback.v25Ledger) feedback.v25Ledger.textContent = ledgerResult.reason;
    if (feedback.v25ActiveIntegrity) feedback.v25ActiveIntegrity.textContent = activeResult.reason;
    status.dataset.state = verified ? "ok" : "error";
    status.textContent = verified
      ? "Policy lineage replay verificado contra el ledger y la evidencia actual."
      : "Policy lineage rechazado: la evidencia o la cadena histórica no coincide.";
    addAudit(auditEvent(
      verified ? "POLICY_V25_REPLAY_OK" : "POLICY_V25_REPLAY_REJECTED",
      { id: fingerprint || "POLICY" },
      ledgerResult.reason + " · " + activeResult.reason
    ));
  });

  feedback.policyActor?.addEventListener("change", () => {
    const actor = normaliseActor(feedback.policyActor.value);
    if (actor) {
      feedback.policyActor.value = actor;
      writePolicyActorV25(actor);
    }
    render();
  });

  feedback.v26Export?.addEventListener("click", () => {
    const fingerprint = lastWorkflowPlan?.datasetFingerprint || null;
    const bundle = buildPolicyEvidenceBundle({
      datasetFingerprint: fingerprint,
      proposal: lastPolicyProposalV25,
      ledger: readPolicyLedgerV25(fingerprint),
      rows: buildObservedCalibrationRows(
        buildRunAnalysis(evaluated, getForecastConfig()).forecast?.rows || [],
        feedbackOutcomes
      ),
      exportedAt: new Date().toISOString()
    });
    if (!bundle.valid) {
      if (feedback.v26Status) {
        feedback.v26Status.textContent = bundle.reason;
        feedback.v26Status.dataset.state = "error";
      }
      return;
    }
    const json = serialisePolicyEvidenceBundle(bundle);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "revops-policy-evidence-v26-" + (fingerprint || "unknown") + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    if (feedback.v26Status) {
      feedback.v26Status.textContent = "EXPORTED · " + bundle.manifestFingerprint;
      feedback.v26Status.dataset.state = "ok";
    }
    addAudit(auditEvent(
      "POLICY_V26_EVIDENCE_EXPORTED",
      { id: fingerprint || "POLICY" },
      bundle.manifestFingerprint
    ));
  });

  feedback.v26Import?.addEventListener("change", async () => {
    const file = feedback.v26Import.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const bundle = JSON.parse(raw);
      const currentFingerprint = lastWorkflowPlan?.datasetFingerprint || null;
      const currentRows = currentFingerprint && bundle.datasetFingerprint === currentFingerprint
        ? buildObservedCalibrationRows(
            buildRunAnalysis(evaluated, getForecastConfig()).forecast?.rows || [],
            feedbackOutcomes
          )
        : null;
      const result = verifyPolicyEvidenceBundle(bundle, {
        rows: currentRows,
        datasetFingerprint: bundle.datasetFingerprint || null
      });
      if (feedback.v26Status) {
        feedback.v26Status.textContent = result.reason;
        feedback.v26Status.dataset.state = result.valid ? "ok" : "error";
      }
      addAudit(auditEvent(
        result.valid ? "POLICY_V26_EVIDENCE_VERIFIED" : "POLICY_V26_EVIDENCE_REJECTED",
        { id: bundle.datasetFingerprint || "POLICY" },
        result.reason
      ));
    } catch (error) {
      if (feedback.v26Status) {
        feedback.v26Status.textContent = "EVIDENCE_PARSE_ERROR · " + error.message;
        feedback.v26Status.dataset.state = "error";
      }
      addAudit(auditEvent("POLICY_V26_EVIDENCE_REJECTED", { id: "POLICY" }, "invalid JSON"));
    }
  });

  feedback.v27Generate?.addEventListener("click", async () => {
    try {
      policyEvidenceSignerV27 = await generatePolicyEvidenceKeyPair();
      if (feedback.v27Key) feedback.v27Key.textContent = policyEvidenceSignerV27.keyFingerprint;
      if (feedback.v27Status) {
        feedback.v27Status.textContent = "SIGNER READY · private key kept in memory only";
        feedback.v27Status.dataset.state = "ok";
      }
      addAudit(auditEvent(
        "POLICY_V27_SIGNER_GENERATED",
        { id: policyEvidenceSignerV27.keyFingerprint },
        "ECDSA P-256"
      ));
    } catch (error) {
      if (feedback.v27Status) {
        feedback.v27Status.textContent = "SIGNER_ERROR · " + error.message;
        feedback.v27Status.dataset.state = "error";
      }
    }
  });

  feedback.v27Sign?.addEventListener("click", async () => {
    if (!policyEvidenceSignerV27?.privateKey) {
      if (feedback.v27Status) {
        feedback.v27Status.textContent = "PRIVATE_SIGNER_REQUIRED · generate a signer first";
        feedback.v27Status.dataset.state = "error";
      }
      return;
    }
    const fingerprint = lastWorkflowPlan?.datasetFingerprint || null;
    const rows = buildObservedCalibrationRows(
      buildRunAnalysis(evaluated, getForecastConfig()).forecast?.rows || [],
      feedbackOutcomes
    );
    const bundle = buildPolicyEvidenceBundle({
      datasetFingerprint: fingerprint,
      proposal: lastPolicyProposalV25,
      ledger: readPolicyLedgerV25(fingerprint),
      rows,
      exportedAt: new Date().toISOString()
    });
    if (!bundle.valid) {
      if (feedback.v27Status) {
        feedback.v27Status.textContent = bundle.reason;
        feedback.v27Status.dataset.state = "error";
      }
      return;
    }
    try {
      const signed = await signPolicyEvidenceBundle(bundle, {
        privateKey: policyEvidenceSignerV27.privateKey,
        publicKeyJwk: policyEvidenceSignerV27.publicKeyJwk
      });
      if (!signed.valid) {
        if (feedback.v27Status) {
          feedback.v27Status.textContent = signed.reason;
          feedback.v27Status.dataset.state = "error";
        }
        return;
      }
      const json = serialiseSignedPolicyEvidenceBundle(signed.bundle);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "revops-policy-signed-v27-" + (fingerprint || "unknown") + ".json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      lastSignedEvidenceV27 = signed.bundle;
      if (feedback.v27Status) {
        feedback.v27Status.textContent = "SIGNED · " + signed.keyFingerprint;
        feedback.v27Status.dataset.state = "ok";
      }
      addAudit(auditEvent(
        "POLICY_V27_EVIDENCE_SIGNED",
        { id: fingerprint || "POLICY" },
        signed.keyFingerprint
      ));
    } catch (error) {
      if (feedback.v27Status) {
        feedback.v27Status.textContent = "SIGN_ERROR · " + error.message;
        feedback.v27Status.dataset.state = "error";
      }
    }
  });

  feedback.v27Import?.addEventListener("change", async () => {
    const file = feedback.v27Import.files?.[0];
    if (!file) return;
    try {
      const bundle = JSON.parse(await file.text());
      const currentFingerprint = lastWorkflowPlan?.datasetFingerprint || null;
      const currentRows = currentFingerprint && bundle.datasetFingerprint === currentFingerprint
        ? buildObservedCalibrationRows(
            buildRunAnalysis(evaluated, getForecastConfig()).forecast?.rows || [],
            feedbackOutcomes
          )
        : null;
      const result = await verifyPolicyEvidenceSignature(bundle, {
        expectedKeyFingerprint: policyEvidenceSignerV27?.keyFingerprint || null,
        datasetFingerprint: bundle.datasetFingerprint || null,
        rows: currentRows
      });
      if (feedback.v27Status) {
        const qualifier = policyEvidenceSignerV27 ? " · PINNED KEY" : " · UNPINNED KEY";
        feedback.v27Status.textContent = result.reason + qualifier;
        feedback.v27Status.dataset.state = result.valid ? "ok" : "error";
      }
      if (result.valid) {
        lastSignedEvidenceV27 = bundle;
        if (feedback.v28Key) {
          feedback.v28Key.value = await buildTrustedSignerFingerprint(bundle.signature?.publicKeyJwk);
        }
      }
      addAudit(auditEvent(
        result.valid ? "POLICY_V27_SIGNATURE_VERIFIED" : "POLICY_V27_SIGNATURE_REJECTED",
        { id: bundle.datasetFingerprint || "POLICY" },
        result.reason
      ));
    } catch (error) {
      if (feedback.v27Status) {
        feedback.v27Status.textContent = "SIGNATURE_PARSE_ERROR · " + error.message;
        feedback.v27Status.dataset.state = "error";
      }
      addAudit(auditEvent("POLICY_V27_SIGNATURE_REJECTED", { id: "POLICY" }, "invalid JSON"));
    }
  });

  const setPolicyTrustStatusV28 = (message, ok = false) => {
    if (!feedback.v28Status) return;
    feedback.v28Status.textContent = message;
    feedback.v28Status.dataset.state = ok ? "ok" : "error";
  };

  const trustGovernanceV28 = () => ({
    actor: normaliseActor(feedback.policyActor?.value || ""),
    rationale: normaliseRationale(feedback.policyRationale?.value || ""),
    effectiveAt: new Date().toISOString()
  });

  feedback.v28Register?.addEventListener("click", async () => {
    const bundleKey = lastSignedEvidenceV27?.signature?.publicKeyJwk || null;
    if (!bundleKey) {
      setPolicyTrustStatusV28("SIGNED_EVIDENCE_REQUIRED");
      return;
    }
    const { actor, rationale, effectiveAt } = trustGovernanceV28();
    if (!actor) {
      setPolicyTrustStatusV28("TRUST_ACTOR_REQUIRED");
      return;
    }
    if (!rationale) {
      setPolicyTrustStatusV28("TRUST_RATIONALE_REQUIRED");
      return;
    }
    try {
      const result = await registerTrustedSigner(policyTrustRegistryV28, {
        publicKeyJwk: bundleKey,
        effectiveAt,
        actor,
        rationale,
        createdAt: effectiveAt
      });
      if (!result.accepted) {
        setPolicyTrustStatusV28(result.reason);
        return;
      }
      policyTrustRegistryV28 = result.registry;
      writePolicyTrustRegistryV28(policyTrustRegistryV28);
      const verification = await verifyTrustRegistry(policyTrustRegistryV28);
      if (feedback.v28State) feedback.v28State.textContent = "ACTIVE";
      setPolicyTrustStatusV28(
        verification.valid
          ? "REGISTERED · " + result.event.keyFingerprint
          : "TRUST_REGISTRY_INVALID",
        verification.valid
      );
      if (feedback.v28Key) feedback.v28Key.value = result.event.keyFingerprint;
      addAudit(auditEvent("POLICY_V28_SIGNER_REGISTERED", { id: result.event.keyFingerprint }, result.event.eventId));
    } catch (error) {
      setPolicyTrustStatusV28("TRUST_REGISTER_ERROR · " + error.message);
    }
  });

  feedback.v28Retire?.addEventListener("click", async () => {
    const keyFingerprint = normaliseActor(feedback.v28Key?.value || "");
    const { actor, rationale, effectiveAt } = trustGovernanceV28();
    if (!keyFingerprint) {
      setPolicyTrustStatusV28("TRUST_SIGNER_REQUIRED");
      return;
    }
    if (!actor) {
      setPolicyTrustStatusV28("TRUST_ACTOR_REQUIRED");
      return;
    }
    if (!rationale) {
      setPolicyTrustStatusV28("TRUST_RATIONALE_REQUIRED");
      return;
    }
    try {
      const result = await retireTrustedSigner(policyTrustRegistryV28, {
        keyFingerprint,
        effectiveAt,
        actor,
        rationale,
        createdAt: effectiveAt
      });
      if (!result.accepted) {
        setPolicyTrustStatusV28(result.reason);
        return;
      }
      policyTrustRegistryV28 = result.registry;
      writePolicyTrustRegistryV28(policyTrustRegistryV28);
      if (feedback.v28State) feedback.v28State.textContent = "RETIRED";
      setPolicyTrustStatusV28("RETIRED · " + keyFingerprint, true);
      addAudit(auditEvent("POLICY_V28_SIGNER_RETIRED", { id: keyFingerprint }, result.event.eventId));
    } catch (error) {
      setPolicyTrustStatusV28("TRUST_RETIRE_ERROR · " + error.message);
    }
  });

  feedback.v28Revoke?.addEventListener("click", async () => {
    const keyFingerprint = normaliseActor(feedback.v28Key?.value || "");
    const { actor, rationale, effectiveAt } = trustGovernanceV28();
    if (!keyFingerprint) {
      setPolicyTrustStatusV28("TRUST_SIGNER_REQUIRED");
      return;
    }
    if (!actor) {
      setPolicyTrustStatusV28("TRUST_ACTOR_REQUIRED");
      return;
    }
    if (!rationale) {
      setPolicyTrustStatusV28("TRUST_RATIONALE_REQUIRED");
      return;
    }
    try {
      const result = await revokeTrustedSigner(policyTrustRegistryV28, {
        keyFingerprint,
        effectiveAt,
        actor,
        rationale,
        createdAt: effectiveAt
      });
      if (!result.accepted) {
        setPolicyTrustStatusV28(result.reason);
        return;
      }
      policyTrustRegistryV28 = result.registry;
      writePolicyTrustRegistryV28(policyTrustRegistryV28);
      if (feedback.v28State) feedback.v28State.textContent = "REVOKED";
      setPolicyTrustStatusV28("REVOKED · " + keyFingerprint, true);
      addAudit(auditEvent("POLICY_V28_SIGNER_REVOKED", { id: keyFingerprint }, result.event.eventId));
    } catch (error) {
      setPolicyTrustStatusV28("TRUST_REVOKE_ERROR · " + error.message);
    }
  });

  feedback.v28Rotate?.addEventListener("click", async () => {
    const previousKeyFingerprint = normaliseActor(feedback.v28Key?.value || "");
    const raw = feedback.v28NewJwk?.value?.trim() || "";
    const { actor, rationale, effectiveAt } = trustGovernanceV28();
    if (!previousKeyFingerprint) {
      setPolicyTrustStatusV28("TRUST_SIGNER_REQUIRED");
      return;
    }
    if (!raw) {
      setPolicyTrustStatusV28("NEW_PUBLIC_KEY_REQUIRED");
      return;
    }
    if (!actor) {
      setPolicyTrustStatusV28("TRUST_ACTOR_REQUIRED");
      return;
    }
    if (!rationale) {
      setPolicyTrustStatusV28("TRUST_RATIONALE_REQUIRED");
      return;
    }
    try {
      const result = await rotateTrustedSigner(policyTrustRegistryV28, {
        previousKeyFingerprint,
        newPublicKeyJwk: JSON.parse(raw),
        effectiveAt,
        actor,
        rationale,
        createdAt: effectiveAt
      });
      if (!result.accepted) {
        setPolicyTrustStatusV28(result.reason);
        return;
      }
      policyTrustRegistryV28 = result.registry;
      writePolicyTrustRegistryV28(policyTrustRegistryV28);
      const verification = await verifyTrustRegistry(policyTrustRegistryV28);
      if (feedback.v28State) feedback.v28State.textContent = verification.valid ? "ACTIVE" : "INVALID";
      setPolicyTrustStatusV28(
        verification.valid ? "ROTATED · " + result.event.keyFingerprint : "TRUST_REGISTRY_INVALID",
        verification.valid
      );
      if (feedback.v28Key) feedback.v28Key.value = result.event.keyFingerprint;
      addAudit(auditEvent("POLICY_V28_SIGNER_ROTATED", { id: result.event.keyFingerprint }, result.event.eventId));
    } catch (error) {
      setPolicyTrustStatusV28("TRUST_ROTATE_ERROR · " + error.message);
    }
  });

  feedback.v28Verify?.addEventListener("click", async () => {
    if (!lastSignedEvidenceV27) {
      setPolicyTrustStatusV28("SIGNED_EVIDENCE_REQUIRED");
      return;
    }
    try {
      const currentFingerprint = lastWorkflowPlan?.datasetFingerprint || null;
      const currentRows = currentFingerprint && lastSignedEvidenceV27.datasetFingerprint === currentFingerprint
        ? buildObservedCalibrationRows(
            buildRunAnalysis(evaluated, getForecastConfig()).forecast?.rows || [],
            feedbackOutcomes
          )
        : null;
      const result = await verifyTrustedPolicyEvidence(lastSignedEvidenceV27, {
        registry: policyTrustRegistryV28,
        rows: currentRows
      });
      setPolicyTrustStatusV28(
        result.reason + (result.keyFingerprint ? " · " + result.keyFingerprint : ""),
        result.valid
      );
      if (result.valid && feedback.v28Registry) {
        feedback.v28Registry.textContent =
          (result.signerStateNow || "TRUSTED") + " · " +
          (result.registryHeadFingerprint || policyTrustRegistryV28.headFingerprint);
      }
      if (feedback.v28State) {
        feedback.v28State.textContent = result.signerStateNow || (result.valid ? "TRUSTED" : "REJECTED");
      }
      addAudit(auditEvent(
        result.valid ? "POLICY_V28_TRUST_VERIFIED" : "POLICY_V28_TRUST_REJECTED",
        { id: result.keyFingerprint || "POLICY" },
        result.reason
      ));
    } catch (error) {
      setPolicyTrustStatusV28("TRUST_VERIFY_ERROR · " + error.message);
    }
  });

  feedback.v28EvidenceImport?.addEventListener("change", async () => {
    const file = feedback.v28EvidenceImport.files?.[0];
    if (!file) return;
    try {
      lastSignedEvidenceV27 = JSON.parse(await file.text());
      if (feedback.v28Key) feedback.v28Key.value = lastSignedEvidenceV27.signature?.keyFingerprint || "";
      feedback.v28Verify?.click();
    } catch (error) {
      lastSignedEvidenceV27 = null;
      setPolicyTrustStatusV28("SIGNED_EVIDENCE_PARSE_ERROR · " + error.message);
    }
  });

  feedback.v28Export?.addEventListener("click", async () => {
    try {
      const result = await exportTrustRegistry(policyTrustRegistryV28);
      if (!result.valid) {
        setPolicyTrustStatusV28(result.reason);
        return;
      }
      const blob = new Blob([result.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "revops-policy-trust-registry-v28.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setPolicyTrustStatusV28("EXPORTED · " + result.headFingerprint, true);
    } catch (error) {
      setPolicyTrustStatusV28("TRUST_EXPORT_ERROR · " + error.message);
    }
  });

  feedback.v28Import?.addEventListener("change", async () => {
    const file = feedback.v28Import.files?.[0];
    if (!file) return;
    try {
      const imported = await importTrustRegistry(await file.text());
      if (!imported.valid) {
        setPolicyTrustStatusV28(imported.reason);
        return;
      }
      policyTrustRegistryV28 = imported.registry;
      writePolicyTrustRegistryV28(policyTrustRegistryV28);
      if (feedback.v28State) feedback.v28State.textContent = "IMPORTED";
      setPolicyTrustStatusV28("IMPORTED · " + policyTrustRegistryV28.headFingerprint, true);
      if (feedback.v28Registry) {
        feedback.v28Registry.textContent =
          policyTrustRegistryV28.headFingerprint + " · " +
          policyTrustRegistryV28.events.length + " events";
      }
    } catch (error) {
      setPolicyTrustStatusV28("TRUST_IMPORT_ERROR · " + error.message);
    }
  });

  const setTrustRootStatusV29 = (message, ok = false) => {
    if (!feedback.v29Status) return;
    feedback.v29Status.textContent = message;
    feedback.v29Status.dataset.state = ok ? "ok" : "error";
  };

  const renderTrustRootV29 = () => {
    if (feedback.v29Root) {
      feedback.v29Root.textContent =
        trustRootKeyPairV29?.rootKeyFingerprint ||
        signedTrustRootSnapshotV29?.rootKeyFingerprint ||
        "NOT INITIALISED";
    }
    if (feedback.v29RegistryHead) {
      feedback.v29RegistryHead.textContent =
        signedTrustRootSnapshotV29?.trustRegistryHeadFingerprint ||
        policyTrustRegistryV28?.headFingerprint ||
        "T28-EMPTY";
    }
  };

  feedback.v29Generate?.addEventListener("click", async () => {
    try {
      trustRootKeyPairV29 = await generateTrustRootKeyPair();
      if (feedback.v29Pin) feedback.v29Pin.value = trustRootKeyPairV29.rootKeyFingerprint;
      renderTrustRootV29();
      setTrustRootStatusV29(
        "ROOT_GENERATED · " + trustRootKeyPairV29.rootKeyFingerprint + " · private key memory-only",
        true
      );
      addAudit(auditEvent("POLICY_V29_ROOT_GENERATED", { id: trustRootKeyPairV29.rootKeyFingerprint }, TRUST_ROOT_VERSION));
    } catch (error) {
      setTrustRootStatusV29("ROOT_GENERATE_ERROR · " + error.message);
    }
  });

  feedback.v29Sign?.addEventListener("click", async () => {
    if (!trustRootKeyPairV29) {
      setTrustRootStatusV29("ROOT_KEY_REQUIRED");
      return;
    }
    try {
      const result = await signTrustRegistrySnapshot(policyTrustRegistryV28, {
        privateKey: trustRootKeyPairV29.privateKey,
        publicKeyJwk: trustRootKeyPairV29.publicKeyJwk
      });
      if (!result.valid) {
        setTrustRootStatusV29(result.reason);
        return;
      }
      signedTrustRootSnapshotV29 = result.snapshot;
      writeTrustRootSnapshotV29(signedTrustRootSnapshotV29);
      renderTrustRootV29();
      setTrustRootStatusV29(
        "ROOT_SIGNED · " + signedTrustRootSnapshotV29.trustRegistryHeadFingerprint,
        true
      );
      addAudit(auditEvent("POLICY_V29_ROOT_SNAPSHOT_SIGNED", {
        id: signedTrustRootSnapshotV29.rootKeyFingerprint
      }, signedTrustRootSnapshotV29.trustRegistryHeadFingerprint));
    } catch (error) {
      setTrustRootStatusV29("ROOT_SIGN_ERROR · " + error.message);
    }
  });

  feedback.v29VerifyRegistry?.addEventListener("click", async () => {
    if (!signedTrustRootSnapshotV29) {
      setTrustRootStatusV29("ROOT_SNAPSHOT_REQUIRED");
      return;
    }
    try {
      const pin = feedback.v29Pin?.value?.trim() || null;
      const result = await verifySignedTrustRegistrySnapshot(signedTrustRootSnapshotV29, {
        expectedRootKeyFingerprint: pin
      });
      const mode = pin ? "PINNED" : "INTERNAL";
      setTrustRootStatusV29(
        result.valid
          ? "ROOT_VERIFIED_" + mode + " · " + result.rootKeyFingerprint
          : result.reason,
        result.valid
      );
      if (result.valid) renderTrustRootV29();
      addAudit(auditEvent(
        result.valid ? "POLICY_V29_ROOT_VERIFIED" : "POLICY_V29_ROOT_REJECTED",
        { id: result.rootKeyFingerprint || "ROOT" },
        result.reason
      ));
    } catch (error) {
      setTrustRootStatusV29("ROOT_VERIFY_ERROR · " + error.message);
    }
  });

  feedback.v29VerifyEvidence?.addEventListener("click", async () => {
    if (!signedTrustRootSnapshotV29) {
      setTrustRootStatusV29("ROOT_SNAPSHOT_REQUIRED");
      return;
    }
    if (!lastSignedEvidenceV27) {
      setTrustRootStatusV29("SIGNED_EVIDENCE_REQUIRED");
      return;
    }
    try {
      const currentFingerprint = lastWorkflowPlan?.datasetFingerprint || null;
      const currentRows = currentFingerprint && lastSignedEvidenceV27.datasetFingerprint === currentFingerprint
        ? buildObservedCalibrationRows(
            buildRunAnalysis(evaluated, getForecastConfig()).forecast?.rows || [],
            feedbackOutcomes
          )
        : null;
      const pin = feedback.v29Pin?.value?.trim() || null;
      const result = await verifyTrustedPolicyEvidenceViaRoot(lastSignedEvidenceV27, {
        signedRegistrySnapshot: signedTrustRootSnapshotV29,
        expectedRootKeyFingerprint: pin,
        rows: currentRows
      });
      setTrustRootStatusV29(
        result.valid
          ? "ROOT_ANCHORED · " + result.signerKeyFingerprint
          : result.reason,
        result.valid
      );
      addAudit(auditEvent(
        result.valid ? "POLICY_V29_EVIDENCE_ROOT_ANCHORED" : "POLICY_V29_EVIDENCE_ROOT_REJECTED",
        { id: result.signerKeyFingerprint || "POLICY" },
        result.reason
      ));
    } catch (error) {
      setTrustRootStatusV29("ROOT_EVIDENCE_VERIFY_ERROR · " + error.message);
    }
  });

  feedback.v29Export?.addEventListener("click", async () => {
    if (!signedTrustRootSnapshotV29) {
      setTrustRootStatusV29("ROOT_SNAPSHOT_REQUIRED");
      return;
    }
    try {
      const result = await exportSignedTrustRegistrySnapshot(signedTrustRootSnapshotV29);
      if (!result.valid) {
        setTrustRootStatusV29(result.reason);
        return;
      }
      const blob = new Blob([result.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "revops-policy-trust-root-v29.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setTrustRootStatusV29("EXPORTED · " + result.rootKeyFingerprint, true);
    } catch (error) {
      setTrustRootStatusV29("ROOT_EXPORT_ERROR · " + error.message);
    }
  });

  feedback.v29Import?.addEventListener("change", async () => {
    const file = feedback.v29Import.files?.[0];
    if (!file) return;
    try {
      const imported = await importSignedTrustRegistrySnapshot(await file.text());
      if (!imported.valid) {
        setTrustRootStatusV29(imported.reason);
        return;
      }
      signedTrustRootSnapshotV29 = imported.snapshot;
      writeTrustRootSnapshotV29(signedTrustRootSnapshotV29);
      if (feedback.v29Pin && !feedback.v29Pin.value.trim()) {
        feedback.v29Pin.value = signedTrustRootSnapshotV29.rootKeyFingerprint;
      }
      renderTrustRootV29();
      setTrustRootStatusV29(
        "IMPORTED · " + signedTrustRootSnapshotV29.rootKeyFingerprint,
        true
      );
    } catch (error) {
      setTrustRootStatusV29("ROOT_IMPORT_ERROR · " + error.message);
    }
  });

  renderTrustRootV29();

  const setTrustFabricStatusV30 = (message, ok = false) => {
    if (!feedback.v30Status) return;
    feedback.v30Status.textContent = message;
    feedback.v30Status.dataset.state = ok ? "ok" : "error";
  };

  const renderTrustFabricV30 = () => {
    const roots = trustFabricV30?.roots || signedTrustFabricCheckpointV30?.fabric?.roots || [];
    const threshold = trustFabricV30?.threshold ?? signedTrustFabricCheckpointV30?.fabric?.threshold ?? null;
    const verified = signedTrustFabricCheckpointV30?.signatures?.length || 0;
    if (feedback.v30Roots) {
      feedback.v30Roots.textContent = roots.length
        ? roots.map((root) => root.rootFingerprint).join(" · ")
        : "NOT INITIALISED";
    }
    if (feedback.v30Threshold && threshold !== null) {
      feedback.v30Threshold.value = String(threshold);
    }
    if (feedback.v30Head) {
      feedback.v30Head.textContent =
        signedTrustFabricCheckpointV30?.registryHeadFingerprint || policyTrustRegistryV28?.headFingerprint || "T28-EMPTY";
    }
    if (feedback.v30Quorum) {
      feedback.v30Quorum.textContent = threshold !== null
        ? (verified + " / " + threshold)
        : "0 / 0";
    }
  };

  feedback.v30Generate?.addEventListener("click", async () => {
    try {
      const count = 3;
      trustFabricKeysV30 = await generateTrustFabricKeySet(count);
      const fabricResult = await createTrustFabric({
        rootPublicKeys: trustFabricKeysV30.map((key) => key.publicKeyJwk),
        threshold: Math.min(2, count)
      });
      if (!fabricResult.valid) {
        setTrustFabricStatusV30(fabricResult.reason);
        return;
      }
      trustFabricV30 = fabricResult;
      if (feedback.v30Pins) {
        feedback.v30Pins.value = trustFabricV30.roots.map((root) => root.rootFingerprint).join("\n");
      }
      renderTrustFabricV30();
      setTrustFabricStatusV30(
        "FABRIC_GENERATED · " + trustFabricV30.fabricFingerprint + " · 2-of-3",
        true
      );
      addAudit(auditEvent("POLICY_V30_FABRIC_GENERATED", { id: trustFabricV30.fabricFingerprint }, TRUST_FABRIC_VERSION));
    } catch (error) {
      setTrustFabricStatusV30("FABRIC_GENERATE_ERROR · " + error.message);
    }
  });

  feedback.v30Sign?.addEventListener("click", async () => {
    if (!trustFabricV30 || trustFabricKeysV30.length < trustFabricV30.threshold) {
      setTrustFabricStatusV30("FABRIC_KEYS_REQUIRED");
      return;
    }
    const actor = normaliseActor(feedback.policyActor?.value || "");
    const rationale = normaliseRationale(feedback.policyRationale?.value || "");
    if (!actor) {
      setTrustFabricStatusV30("TRUST_ACTOR_REQUIRED");
      return;
    }
    if (!rationale) {
      setTrustFabricStatusV30("TRUST_RATIONALE_REQUIRED");
      return;
    }
    try {
      const result = await signTrustFabricCheckpoint(policyTrustRegistryV28, {
        fabric: trustFabricV30,
        rootSigners: trustFabricKeysV30,
        actor,
        rationale,
        signedAt: new Date().toISOString()
      });
      if (!result.valid) {
        setTrustFabricStatusV30(result.reason);
        return;
      }
      signedTrustFabricCheckpointV30 = result.snapshot;
      writeTrustFabricCheckpointV30(signedTrustFabricCheckpointV30);
      renderTrustFabricV30();
      setTrustFabricStatusV30(
        "CHECKPOINT_SIGNED · " + result.snapshot.checkpointFingerprint + " · quorum " +
        result.snapshot.signatures.length + "/" + trustFabricV30.threshold,
        true
      );
      addAudit(auditEvent("POLICY_V30_FABRIC_CHECKPOINT_SIGNED", {
        id: result.snapshot.checkpointFingerprint
      }, "quorum " + result.snapshot.signatures.length + "/" + trustFabricV30.threshold));
    } catch (error) {
      setTrustFabricStatusV30("FABRIC_SIGN_ERROR · " + error.message);
    }
  });

  feedback.v30Verify?.addEventListener("click", async () => {
    if (!signedTrustFabricCheckpointV30) {
      setTrustFabricStatusV30("FABRIC_CHECKPOINT_REQUIRED");
      return;
    }
    try {
      const pinValues = (feedback.v30Pins?.value || "")
        .split(/[,\s]+/)
        .map((value) => value.trim())
        .filter(Boolean);
      const threshold = Number(feedback.v30Threshold?.value);
      const result = await verifyTrustFabricCheckpoint(signedTrustFabricCheckpointV30, {
        expectedRootFingerprints: pinValues.length ? pinValues : null,
        expectedThreshold: Number.isInteger(threshold) && threshold > 0 ? threshold : null
      });
      renderTrustFabricV30();
      setTrustFabricStatusV30(
        result.valid
          ? "QUORUM_VERIFIED · " + result.quorum + "/" + result.threshold + " · " + result.registryHeadFingerprint
          : result.reason,
        result.valid
      );
      addAudit(auditEvent(
        result.valid ? "POLICY_V30_QUORUM_VERIFIED" : "POLICY_V30_QUORUM_REJECTED",
        { id: result.fabricFingerprint || "FABRIC" },
        result.reason
      ));
    } catch (error) {
      setTrustFabricStatusV30("FABRIC_VERIFY_ERROR · " + error.message);
    }
  });

  feedback.v30VerifyEvidence?.addEventListener("click", async () => {
    if (!signedTrustFabricCheckpointV30) {
      setTrustFabricStatusV30("FABRIC_CHECKPOINT_REQUIRED");
      return;
    }
    if (!lastSignedEvidenceV27) {
      setTrustFabricStatusV30("SIGNED_EVIDENCE_REQUIRED");
      return;
    }
    try {
      const currentFingerprint = lastWorkflowPlan?.datasetFingerprint || null;
      const currentRows = currentFingerprint && lastSignedEvidenceV27.datasetFingerprint === currentFingerprint
        ? buildObservedCalibrationRows(
            buildRunAnalysis(evaluated, getForecastConfig()).forecast?.rows || [],
            feedbackOutcomes
          )
        : null;
      const pinValues = (feedback.v30Pins?.value || "")
        .split(/[,\s]+/)
        .map((value) => value.trim())
        .filter(Boolean);
      const threshold = Number(feedback.v30Threshold?.value);
      const result = await verifyTrustedPolicyEvidenceViaFabric(lastSignedEvidenceV27, {
        checkpoint: signedTrustFabricCheckpointV30,
        expectedRootFingerprints: pinValues.length ? pinValues : null,
        expectedThreshold: Number.isInteger(threshold) && threshold > 0 ? threshold : null,
        rows: currentRows
      });
      let receipt = null;
      if (result.valid) {
        receipt = await buildTrustFabricVerificationReceipt(result);
      }
      setTrustFabricStatusV30(
        result.valid
          ? result.reason + " · receipt " + (receipt?.fingerprint || "READY")
          : result.reason,
        result.valid
      );
      addAudit(auditEvent(
        result.valid ? "POLICY_V30_EVIDENCE_QUORUM_VERIFIED" : "POLICY_V30_EVIDENCE_QUORUM_REJECTED",
        { id: result.signerKeyFingerprint || "POLICY" },
        result.reason
      ));
    } catch (error) {
      setTrustFabricStatusV30("FABRIC_EVIDENCE_VERIFY_ERROR · " + error.message);
    }
  });

  feedback.v30Export?.addEventListener("click", async () => {
    if (!signedTrustFabricCheckpointV30) {
      setTrustFabricStatusV30("FABRIC_CHECKPOINT_REQUIRED");
      return;
    }
    try {
      const result = await exportTrustFabricCheckpoint(signedTrustFabricCheckpointV30);
      if (!result.valid) {
        setTrustFabricStatusV30(result.reason);
        return;
      }
      const blob = new Blob([result.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "revops-policy-trust-fabric-v30.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setTrustFabricStatusV30("EXPORTED · " + result.checkpointFingerprint, true);
    } catch (error) {
      setTrustFabricStatusV30("FABRIC_EXPORT_ERROR · " + error.message);
    }
  });

  feedback.v30Import?.addEventListener("change", async () => {
    const file = feedback.v30Import.files?.[0];
    if (!file) return;
    try {
      const imported = await importTrustFabricCheckpoint(await file.text());
      if (!imported.valid) {
        setTrustFabricStatusV30(imported.reason);
        return;
      }
      signedTrustFabricCheckpointV30 = imported.snapshot;
      trustFabricV30 = signedTrustFabricCheckpointV30.fabric;
      trustFabricKeysV30 = [];
      writeTrustFabricCheckpointV30(signedTrustFabricCheckpointV30);
      if (feedback.v30Pins) {
        feedback.v30Pins.value = signedTrustFabricCheckpointV30.fabric.roots
          .map((root) => root.rootFingerprint).join("\n");
      }
      renderTrustFabricV30();
      setTrustFabricStatusV30(
        "IMPORTED · " + signedTrustFabricCheckpointV30.checkpointFingerprint,
        true
      );
    } catch (error) {
      setTrustFabricStatusV30("FABRIC_IMPORT_ERROR · " + error.message);
    }
  });

  renderTrustFabricV30();

  const setTransparencyStatusV31 = (message, ok = false) => {
    if (!feedback.v31Status) return;
    feedback.v31Status.textContent = message;
    feedback.v31Status.dataset.state = ok ? "ok" : "error";
  };

  const renderTransparencyV31 = () => {
    const entries = Array.isArray(transparencyLogV31?.entries) ? transparencyLogV31.entries : [];
    const witnesses = Array.isArray(transparencyLogV31?.witnesses) ? transparencyLogV31.witnesses : [];
    if (feedback.v31Entries) feedback.v31Entries.textContent = String(entries.length);
    if (feedback.v31Head) {
      feedback.v31Head.textContent = transparencyLogV31?.headEntryFingerprint || "TL31-EMPTY";
    }
    if (feedback.v31Witnesses) feedback.v31Witnesses.textContent = String(witnesses.length);
  };

  feedback.v31GenerateWitness?.addEventListener("click", async () => {
    try {
      transparencyWitnessV31 = await generateTransparencyWitnessKeyPair();
      setTransparencyStatusV31(
        "WITNESS_GENERATED · " + transparencyWitnessV31.witnessFingerprint + " · private key memory-only",
        true
      );
      addAudit(auditEvent(
        "POLICY_V31_WITNESS_GENERATED",
        { id: transparencyWitnessV31.witnessFingerprint },
        TRANSPARENCY_VERSION
      ));
    } catch (error) {
      setTransparencyStatusV31("WITNESS_GENERATE_ERROR · " + error.message);
    }
  });

  feedback.v31Anchor?.addEventListener("click", async () => {
    if (!signedTrustFabricCheckpointV30) {
      setTransparencyStatusV31("FABRIC_CHECKPOINT_REQUIRED");
      return;
    }
    try {
      const result = await appendTransparencyCheckpoint(
        transparencyLogV31,
        signedTrustFabricCheckpointV30,
        { observedAt: new Date().toISOString() }
      );
      if (!result.valid) {
        setTransparencyStatusV31(result.reason);
        return;
      }
      transparencyLogV31 = result.log;
      writeTransparencyLogV31(transparencyLogV31);
      renderTransparencyV31();
      setTransparencyStatusV31(
        "CHECKPOINT_ANCHORED · seq " + result.entry.sequence + " · " + result.entry.eventFingerprint,
        true
      );
      addAudit(auditEvent(
        "POLICY_V31_CHECKPOINT_ANCHORED",
        { id: result.entry.eventFingerprint },
        "sequence " + result.entry.sequence
      ));
    } catch (error) {
      setTransparencyStatusV31("TRANSPARENCY_ANCHOR_ERROR · " + error.message);
    }
  });

  feedback.v31Witness?.addEventListener("click", async () => {
    const entries = Array.isArray(transparencyLogV31?.entries) ? transparencyLogV31.entries : [];
    if (!entries.length) {
      setTransparencyStatusV31("TRANSPARENCY_ENTRY_REQUIRED");
      return;
    }
    if (!transparencyWitnessV31) {
      setTransparencyStatusV31("WITNESS_KEY_REQUIRED");
      return;
    }
    try {
      const latest = entries.at(-1);
      const result = await signTransparencyWitnessAttestation(latest, {
        privateKey: transparencyWitnessV31.privateKey,
        publicKeyJwk: transparencyWitnessV31.publicKeyJwk,
        witnessId: transparencyWitnessV31.witnessFingerprint,
        observedAt: new Date().toISOString()
      });
      if (!result.valid) {
        setTransparencyStatusV31(result.reason);
        return;
      }

      const witnesses = Array.isArray(transparencyLogV31.witnesses) ? transparencyLogV31.witnesses : [];
      const candidateLog = {
        ...transparencyLogV31,
        witnesses: [...witnesses, result.attestation]
      };
      const witnessVerification = await verifyTransparencyWitnessSet(
        candidateLog.witnesses,
        { entries: candidateLog.entries, minWitnesses: 1 }
      );
      if (!witnessVerification.valid) {
        setTransparencyStatusV31(witnessVerification.reason);
        return;
      }

      transparencyLogV31 = Object.freeze(candidateLog);
      writeTransparencyLogV31(transparencyLogV31);
      renderTransparencyV31();
      setTransparencyStatusV31(
        "WITNESS_ATTESTED · " + result.attestation.witnessFingerprint + " · seq " + latest.sequence,
        true
      );
      addAudit(auditEvent(
        "POLICY_V31_WITNESS_ATTESTED",
        { id: result.attestation.attestationFingerprint },
        "sequence " + latest.sequence
      ));
    } catch (error) {
      setTransparencyStatusV31("WITNESS_SIGN_ERROR · " + error.message);
    }
  });

  feedback.v31Verify?.addEventListener("click", async () => {
    try {
      const pin = String(feedback.v31HeadPin?.value || "").trim();
      const logResult = await verifyTransparencyLog(
        transparencyLogV31,
        { expectedHeadFingerprint: pin || null }
      );
      if (!logResult.valid) {
        setTransparencyStatusV31(logResult.reason);
        addAudit(auditEvent("POLICY_V31_TRANSPARENCY_REJECTED", { id: "LOG" }, logResult.reason));
        return;
      }

      const witnesses = Array.isArray(transparencyLogV31.witnesses) ? transparencyLogV31.witnesses : [];
      const required = Math.max(1, Number(feedback.v31MinWitnesses?.value) || 1);
      const witnessResult = witnesses.length
        ? await verifyTransparencyWitnessSet(witnesses, {
            entries: transparencyLogV31.entries,
            minWitnesses: required
          })
        : { valid: false, reason: "TRANSPARENCY_WITNESS_QUORUM_NOT_REACHED", witnesses: [], required };

      if (!witnessResult.valid) {
        setTransparencyStatusV31(
          "LOG_VERIFIED · HEAD " + logResult.headSequence + " · " + witnessResult.reason,
          false
        );
        return;
      }

      setTransparencyStatusV31(
        "TRANSPARENCY_VERIFIED · head " + logResult.headSequence +
        " · witnesses " + witnessResult.quorum,
        true
      );
      addAudit(auditEvent(
        "POLICY_V31_TRANSPARENCY_VERIFIED",
        { id: logResult.headEntryFingerprint },
        "witnesses " + witnessResult.quorum
      ));
    } catch (error) {
      setTransparencyStatusV31("TRANSPARENCY_VERIFY_ERROR · " + error.message);
    }
  });

  feedback.v31Export?.addEventListener("click", async () => {
    try {
      const result = await exportTransparencyLog(transparencyLogV31);
      if (!result.valid) {
        setTransparencyStatusV31(result.reason);
        return;
      }
      const blob = new Blob([result.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "revops-policy-transparency-v31.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setTransparencyStatusV31("EXPORTED · " + result.headEntryFingerprint, true);
    } catch (error) {
      setTransparencyStatusV31("TRANSPARENCY_EXPORT_ERROR · " + error.message);
    }
  });

  feedback.v31ExportReceipt?.addEventListener("click", async () => {
    try {
      const logResult = await verifyTransparencyLog(transparencyLogV31);
      if (!logResult.valid) {
        setTransparencyStatusV31(logResult.reason);
        return;
      }
      const witnesses = Array.isArray(transparencyLogV31.witnesses) ? transparencyLogV31.witnesses : [];
      const witnessResult = witnesses.length
        ? await verifyTransparencyWitnessSet(witnesses, {
            entries: transparencyLogV31.entries,
            minWitnesses: 1
          })
        : null;
      if (witnessResult && !witnessResult.valid) {
        setTransparencyStatusV31(witnessResult.reason);
        return;
      }
      const receipt = await buildTransparencyReceipt(logResult, witnessResult);
      if (!receipt.valid) {
        setTransparencyStatusV31(receipt.reason);
        return;
      }
      const blob = new Blob([JSON.stringify(receipt.receipt, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "revops-policy-transparency-receipt-v31.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setTransparencyStatusV31("RECEIPT_EXPORTED · " + receipt.fingerprint, true);
    } catch (error) {
      setTransparencyStatusV31("TRANSPARENCY_RECEIPT_ERROR · " + error.message);
    }
  });

  feedback.v31Import?.addEventListener("change", async () => {
    const file = feedback.v31Import.files?.[0];
    if (!file) return;
    try {
      const imported = await importTransparencyLog(await file.text());
      if (!imported.valid) {
        setTransparencyStatusV31(imported.reason);
        return;
      }
      transparencyLogV31 = imported.log;
      writeTransparencyLogV31(transparencyLogV31);
      renderTransparencyV31();
      setTransparencyStatusV31(
        "IMPORTED · head " + (transparencyLogV31.headEntryFingerprint || "EMPTY"),
        true
      );
      addAudit(auditEvent(
        "POLICY_V31_TRANSPARENCY_IMPORTED",
        { id: transparencyLogV31.headEntryFingerprint || "EMPTY" },
        "entries " + transparencyLogV31.entries.length
      ));
    } catch (error) {
      setTransparencyStatusV31("TRANSPARENCY_IMPORT_ERROR · " + error.message);
    }
  });

  renderTransparencyV31();

  const setDecisionCertificateStatusV32 = (message, ok = false) => {
    if (!feedback.v32Status) return;
    feedback.v32Status.textContent = message;
    feedback.v32Status.dataset.state = ok ? "ok" : "error";
  };

  const renderDecisionCertificateV32 = () => {
    const certificate = lastDecisionCertificateV32;
    if (feedback.v32CertificateId) {
      feedback.v32CertificateId.textContent =
        certificate?.certificateId || "DC32-EMPTY";
    }
    if (feedback.v32Head) {
      feedback.v32Head.textContent =
        certificate?.transparency?.headEntryFingerprint ||
        "TL31-EMPTY";
    }
    if (feedback.v32Quorum) {
      const quorum = certificate?.trust?.quorum;
      const threshold = certificate?.trust?.threshold;
      feedback.v32Quorum.textContent =
        quorum == null || threshold == null
          ? "—"
          : String(quorum) + "/" + String(threshold);
    }
  };

  feedback.v32Build?.addEventListener("click", async () => {
    const fingerprint =
      lastWorkflowPlan?.datasetFingerprint || null;

    if (!lastSignedEvidenceV27) {
      setDecisionCertificateStatusV32(
        "SIGNED_EVIDENCE_V27_REQUIRED"
      );
      return;
    }

    if (!signedTrustFabricCheckpointV30) {
      setDecisionCertificateStatusV32(
        "TRUST_FABRIC_CHECKPOINT_V30_REQUIRED"
      );
      return;
    }

    const entries =
      Array.isArray(transparencyLogV31?.entries)
        ? transparencyLogV31.entries
        : [];

    if (!entries.length) {
      setDecisionCertificateStatusV32(
        "TRANSPARENCY_LOG_V31_REQUIRED"
      );
      return;
    }

    if (
      fingerprint &&
      lastSignedEvidenceV27.datasetFingerprint !== fingerprint
    ) {
      setDecisionCertificateStatusV32(
        "DATASET_SCOPE_MISMATCH"
      );
      return;
    }

    try {
      const result =
        await buildDecisionCertificate({
          issuedAt:
            new Date().toISOString(),

          signedEvidenceBundle:
            lastSignedEvidenceV27,

          trustFabricCheckpoint:
            signedTrustFabricCheckpointV30,

          transparencyLog:
            transparencyLogV31,

          minWitnesses:
            Math.max(
              1,
              Number(
                feedback.v32MinWitnesses?.value
              ) || 1
            )
        });

      if (!result.valid) {
        setDecisionCertificateStatusV32(
          result.reason || result.status
        );
        return;
      }

      lastDecisionCertificateV32 =
        result.certificate;

      renderDecisionCertificateV32();

      setDecisionCertificateStatusV32(
        "CERTIFICATE_VALID · " +
        result.certificate.certificateFingerprint,
        true
      );

      addAudit(
        auditEvent(
          "POLICY_V32_CERTIFICATE_BUILT",
          {
            id:
              result.certificate.certificateId
          },
          result.certificate
            .certificateFingerprint
        )
      );

    } catch (error) {
      setDecisionCertificateStatusV32(
        "CERTIFICATE_BUILD_ERROR · " +
        error.message
      );
    }
  });

  feedback.v32Verify?.addEventListener("click", async () => {
    if (!lastDecisionCertificateV32) {
      setDecisionCertificateStatusV32(
        "CERTIFICATE_REQUIRED"
      );
      return;
    }

    const fingerprint =
      lastWorkflowPlan?.datasetFingerprint || null;

    const certificateDataset =
      lastDecisionCertificateV32
        ?.decision
        ?.datasetFingerprint || null;

    const currentRows =
      fingerprint &&
      fingerprint === certificateDataset
        ? buildObservedCalibrationRows(
            buildRunAnalysis(
              evaluated,
              getForecastConfig()
            ).forecast?.rows || [],
            feedbackOutcomes
          )
        : null;

    try {
      const result =
        await verifyDecisionCertificate(
          lastDecisionCertificateV32,
          {
            rows:
              currentRows,

            expectedHeadFingerprint:
              String(
                feedback.v32HeadPin?.value || ""
              ).trim() || null,

            minWitnesses:
              Math.max(
                1,
                Number(
                  feedback.v32MinWitnesses?.value
                ) || 1
              ),

            verificationAt:
              new Date().toISOString()
          }
        );

      setDecisionCertificateStatusV32(
        result.valid
          ? "CERTIFICATE_VALID · " +
            result.certificateFingerprint
          : result.status +
            " · " +
            (result.failures || [])
              .map(
                (item) =>
                  item.code
              )
              .join(" · "),
        result.valid
      );

      addAudit(
        auditEvent(
          result.valid
            ? "POLICY_V32_CERTIFICATE_VERIFIED"
            : "POLICY_V32_CERTIFICATE_REJECTED",
          {
            id:
              lastDecisionCertificateV32
                .certificateId
          },
          result.status
        )
      );

    } catch (error) {
      setDecisionCertificateStatusV32(
        "CERTIFICATE_VERIFY_ERROR · " +
        error.message
      );
    }
  });

  feedback.v32Export?.addEventListener("click", async () => {
    if (!lastDecisionCertificateV32) {
      setDecisionCertificateStatusV32(
        "CERTIFICATE_REQUIRED"
      );
      return;
    }

    try {
      const result =
        await exportDecisionCertificate(
          lastDecisionCertificateV32
        );

      if (!result.valid) {
        setDecisionCertificateStatusV32(
          result.reason
        );
        return;
      }

      const blob =
        new Blob(
          [result.json],
          {
            type:
              "application/json"
          }
        );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download =
        "revops-decision-certificate-v32-" +
        lastDecisionCertificateV32
          .certificateId +
        ".json";

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      setDecisionCertificateStatusV32(
        "EXPORTED · " +
        result.certificateFingerprint,
        true
      );

      addAudit(
        auditEvent(
          "POLICY_V32_CERTIFICATE_EXPORTED",
          {
            id:
              lastDecisionCertificateV32
                .certificateId
          },
          result.certificateFingerprint
        )
      );

    } catch (error) {
      setDecisionCertificateStatusV32(
        "CERTIFICATE_EXPORT_ERROR · " +
        error.message
      );
    }
  });

  feedback.v32Import?.addEventListener("change", async () => {
    const file =
      feedback.v32Import.files?.[0];

    if (!file) return;

    try {
      const imported =
        await importDecisionCertificate(
          await file.text()
        );

      if (!imported.valid) {
        setDecisionCertificateStatusV32(
          imported.reason
        );
        return;
      }

      lastDecisionCertificateV32 =
        imported.certificate;

      renderDecisionCertificateV32();

      setDecisionCertificateStatusV32(
        "IMPORTED · " +
        lastDecisionCertificateV32
          .certificateFingerprint,
        true
      );

      addAudit(
        auditEvent(
          "POLICY_V32_CERTIFICATE_IMPORTED",
          {
            id:
              lastDecisionCertificateV32
                .certificateId
          },
          lastDecisionCertificateV32
            .certificateFingerprint
        )
      );

    } catch (error) {
      setDecisionCertificateStatusV32(
        "CERTIFICATE_IMPORT_ERROR · " +
        error.message
      );
    }
  });

  renderDecisionCertificateV32();

  const adaptiveConfigV20 = readAdaptiveCalibrationConfigV20();
  if (feedback.v20WindowDays) feedback.v20WindowDays.value = String(adaptiveConfigV20.windowDays ?? 30);
  if (feedback.v20MinSamples) feedback.v20MinSamples.value = String(adaptiveConfigV20.minSamples ?? 8);
  if (feedback.v20MinGroupSamples) feedback.v20MinGroupSamples.value = String(adaptiveConfigV20.minGroupSamples ?? 5);

  const loaded = readStored();
  const hashConfig = window.location.hash.startsWith("#config=")
    ? decodeConfig(window.location.hash.slice(8))
    : null;
  applyConfig(hashConfig || loaded || {});

  const forecastInputs = Object.values(forecast.probabilities).filter(Boolean);
  forecastInputs.forEach((input) => input.addEventListener("input", () => {
    const max = input.id === "forecastUpsideMult" ? 200 : 150;
    input.value = String(Math.max(0, Math.min(max, Number(input.value) || 0)));
    writeStored(currentConfig());
    updateShareUrl();
    render();
  }));

  Object.values(inputs).forEach((input) => input?.addEventListener("input", () => {
    renderWeights();
    persistAndRender();
  }));
  Object.values(thresholds).forEach((input) => input?.addEventListener("input", (event) => {
    setThresholds({
      qualified: Number(thresholds.qualified.value),
      nurture: Number(thresholds.nurture.value),
      changed: event.target.id === "thresholdQualified" ? "qualified" : "nurture"
    });
    renderWeights();
    persistAndRender();
  }));

  qsa("[data-scenario]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!scenarios[button.dataset.scenario]) return;
      activeScenario = button.dataset.scenario;
      Object.entries(scenarios[activeScenario]).forEach(([key, value]) => { if (inputs[key]) inputs[key].value = String(value); });
      qsa("[data-scenario]").forEach((item) => item.classList.toggle("is-active", item === button));
      addAudit(auditEvent("SCENARIO", { id: activeScenario }, "preset applied"));
      persistAndRender();
    });
  });

  qs("#runDemo")?.addEventListener("click", runWithAudit);

  qs("#resetDemo")?.addEventListener("click", () => {
    Object.entries(DEFAULT_WEIGHTS).forEach(([key, value]) => { if (inputs[key]) inputs[key].value = String(Math.round(value * 100)); });
    setThresholds({ ...DEFAULT_THRESHOLDS, changed: "qualified" });
    const defaultForecast = { qualified:80, nurture:35, new:10, downside:75, upside:115 };
    Object.entries(defaultForecast).forEach(([key, value]) => {
      if (forecast.probabilities[key]) forecast.probabilities[key].value = String(value);
    });
    sourceRecords = demoSeed;
    window.__REVOPS_DATA__ = null;
    dataSource = "demo";
    activeScenario = "balanced";
    approved = false;
    qsa("[data-scenario]").forEach((item) => item.classList.toggle("is-active", item.dataset.scenario === activeScenario));
    audit?.replaceChildren();
    if (gate) gate.textContent = "Aprobar siguiente acción";
    if (status) status.textContent = "";
    if (shareConfig) shareConfig.value = "";
    renderWeights();
    runWithAudit();
  });

  guided.steps.forEach((step) => step.addEventListener("click", () => goGuided(Number(step.dataset.guidedStep) || 0)));
  guided.next?.addEventListener("click", () => goGuided(guidedStep === guidedSteps.length - 1 ? 0 : guidedStep + 1));

  executiveReadout.copyButton?.addEventListener("click", async () => {
    const value = executiveReadout.text?.value || "";
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      status.dataset.state = "ok";
      status.textContent = "Executive brief copiado al portapapeles.";
      addAudit(auditEvent("EXECUTIVE_COPY", { id: "BRIEF" }, "executive readout copied"));
    } catch {
      executiveReadout.text?.focus();
      executiveReadout.text?.select();
      status.dataset.state = "ok";
      status.textContent = "Executive brief seleccionado para copiar.";
    }
  });

  qs("#csvInput")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = parseCsv(await file.text());
      if (!imported.length) throw new Error("El CSV no contiene registros.");
      sourceRecords = imported;
      window.__REVOPS_DATA__ = imported;
      dataSource = "csv";
      approved = false;
      if (gate) gate.textContent = "Aprobar siguiente acción";
      addAudit(auditEvent("IMPORT", { id: "CSV" }, file.name + " · " + imported.length + " rows"));
      runWithAudit();
      status.dataset.state = "ok";
      status.textContent = "CSV procesado localmente: " + imported.length + " registros. Ningún dato ha salido del navegador.";
    } catch (error) {
      status.dataset.state = "error";
      status.textContent = "CSV rechazado: " + error.message;
      addAudit(auditEvent("IMPORT_REJECTED", { id: "CSV" }, error.message));
      event.target.value = "";
    }
  });

  queueSearch?.addEventListener("input", renderQueue);

  tableStageFilter?.addEventListener("change", () => {
    activeTableStage = tableStageFilter.value || "all";
    render();
  });

  staleOnly?.addEventListener("change", render);

  clearHistory?.addEventListener("click", () => {
    history = [];
    writeHistory(history);
    renderHistory();
    addAudit(auditEvent("HISTORY_CLEAR", { id: "HISTORY" }, "local run history cleared"));
    status.dataset.state = "ok";
    status.textContent = "Historial local borrado. No se han borrado datos del CSV porque nunca se guardaron.";
  });

  qs("#downloadCsvTemplate")?.addEventListener("click", () => {
    const header = "id,account,fit,intent,engagement,urgency,value,owner,segment,source,last_touch_days\n";
    const sample = "L-EXAMPLE,Example Account,80,70,60,50,25000,Ana,Enterprise,Inbound,5\n";
    const blob = new Blob([header + sample], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "revops-control-room-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    addAudit(auditEvent("TEMPLATE", { id: "CSV" }, "sample CSV generated locally"));
    status.dataset.state = "ok";
    status.textContent = "Plantilla CSV generada localmente.";
  });

  qs("#exportDemo")?.addEventListener("click", () => {
    const artifactBase = buildRunArtifact(
      evaluated,
      getForecastConfig(),
      {},
      {
        source: dataSource,
        scenario: activeScenario,
        weights: getWeights(),
        thresholds: getThresholds()
      }
    );
    const artifact = {
      ...artifactBase,
      contractVersion: "23.0",
      feedback: lastFeedbackAnalysis
        ? {
            outcomeFingerprint: lastFeedbackAnalysis.outcomeFingerprint,
            summary: lastFeedbackAnalysis.summary,
            effectiveness: lastFeedbackAnalysis.effectiveness,
            calibration: lastFeedbackAnalysis.calibration
          }
        : null,
      outcomes: feedbackOutcomes.map((outcome) => ({ ...outcome })),
      calibrationV19: lastCalibrationReportV19,
      calibrationV20: lastAdaptiveCalibrationReportV20
        ? {
            contractVersion: lastAdaptiveCalibrationReportV20.contractVersion,
            reportId: lastAdaptiveCalibrationReportV20.reportId,
            baselineEstablished: lastAdaptiveCalibrationReportV20.baselineEstablished,
            currentWindow: lastAdaptiveCalibrationReportV20.currentWindow,
            previousWindow: lastAdaptiveCalibrationReportV20.previousWindow,
            global: lastAdaptiveCalibrationReportV20.global,
            segments: lastAdaptiveCalibrationReportV20.segments,
            cohorts: lastAdaptiveCalibrationReportV20.cohorts,
            severity: lastAdaptiveCalibrationReportV20.severity,
            drift: lastAdaptiveCalibrationReportV20.drift,
            recommendations: lastAdaptiveCalibrationReportV20.recommendations,
            auditTrail: lastAdaptiveCalibrationReportV20.auditTrail,
            snapshotId: lastAdaptiveCalibrationReportV20.snapshotId
          }
        : null,
      policyV25: summarisePolicy({
        proposal: lastPolicyProposalV25,
        ledger: readPolicyLedgerV25(lastWorkflowPlan?.datasetFingerprint || null),
        datasetFingerprint: lastWorkflowPlan?.datasetFingerprint || null,
        rows: buildObservedCalibrationRows(
          buildRunAnalysis(evaluated, getForecastConfig()).forecast?.rows || [],
          feedbackOutcomes
        )
      })
    };
    const blob = new Blob([JSON.stringify(artifact, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "revops-v24-" + artifact.runId.toLowerCase() + ".json";
    anchor.click();
    URL.revokeObjectURL(url);
    addAudit(auditEvent("EXPORT", { id: artifact.runId }, "V25 run artifact + feedback generated without raw CSV records"));
    status.dataset.state = "ok";
    status.textContent = "Run artifact V25 generado: identidad, workflow y policy integrity, sin filas CSV.";
  });



  copyConfig?.addEventListener("click", async () => {
    const url = updateShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      status.dataset.state = "ok";
      status.textContent = "Configuración copiada. El enlace no contiene los registros del CSV.";
    } catch {
      if (shareConfig) {
        shareConfig.focus();
        shareConfig.select();
      }
      status.dataset.state = "ok";
      status.textContent = "Enlace listo para copiar. Solo contiene configuración, no datos.";
    }
    addAudit(auditEvent("SHARE", { id: "CONFIG" }, "configuration link generated"));
  });

  gate?.addEventListener("click", () => {
    const candidate = evaluated.find((lead) => lead.stage === "nurture");
    if (!candidate) {
      status.dataset.state = "error";
      status.textContent = "No hay un registro nurture para simular una aprobación sensible.";
      addAudit(auditEvent("GATE_REJECTED", { id: "MODEL" }, "no nurture transition candidate"));
      return;
    }

    const target = "qualified";
    const result = transition(candidate, target, true);
    if (!result.ok) {
      status.dataset.state = "error";
      status.textContent = "Transición rechazada por la política.";
      addAudit(auditEvent("GATE_REJECTED", candidate, result.reason));
      return;
    }

    const updated = result.lead;
    evaluated = evaluated.map((lead) => lead.id === updated.id ? { ...lead, ...updated, nextAction: nextAction(updated) } : lead);
    approved = false;
    gate.textContent = "Simular aprobación humana";
    status.dataset.state = "ok";
    status.textContent = candidate.id + " aprobado: " + candidate.stage + " → " + target + " (simulación, aprobación consumida).";
    addAudit(auditEvent("APPROVED", candidate, candidate.stage + " → " + target));
    addAudit(auditEvent("APPROVAL_CONSUMED", updated, "one-shot human gate"));
    render();
    if (lastExecutionLedger) {
      const approvalEvent = appendExecutionEvent(lastExecutionLedger, {
        type: "APPROVAL_GRANTED",
        runId: lastExecutionLedger.runId,
        leadId: updated.id,
        idempotencyKey: "APPROVAL-" + String(updated.id),
        actor: "operator",
        status: "APPROVED",
        payload: { from: candidate.stage, to: target }
      });
      if (approvalEvent.accepted) lastExecutionLedger = approvalEvent.ledger;
    }
    renderDecisionTrace(updated);
  });

  workflowControl.simulate?.addEventListener("click", () => {
    const plan = lastWorkflowPlan || buildOperationalPlan(
      evaluated,
      getForecastConfig(),
      {},
      { runId: lastSnapshot?.runId || null, now: new Date().toISOString() }
    );
    const candidate = evaluated.find((lead) => lead.stage === "new" || lead.stage === "nurture") || evaluated.find((lead) => lead.stage !== "blocked") || evaluated[0];
    if (!candidate) {
      status.dataset.state = "error";
      status.textContent = "No hay registros para simular el workflow.";
      return;
    }

    const trace = buildDecisionTrace(candidate, getForecastConfig(), {}, { runId: plan.runId });
    const envelope = createExecutionEnvelope(trace, {
      approvalStatus: trace.approval.required ? "pending" : "approved"
    });
    const contract = createIntegrationContract(envelope, {
      timeoutMs: 5000
    });
    const simulation = simulateIntegrationContract(contract, {});
    const event = createExecutionEvent(simulation, contract, { actor: "operator" });

    if (lastExecutionLedger) {
      const contractEvent = appendExecutionEvent(lastExecutionLedger, {
        type: "EXECUTION_CONTRACT_CREATED",
        runId: plan.runId,
        leadId: candidate.id,
        idempotencyKey: contract.idempotencyKey,
        actor: "operator",
        status: contract.canExecute ? "READY" : "SIMULATION_ONLY",
        payload: {
          envelopeId: contract.envelopeId,
          adapter: contract.adapter,
          dryRun: contract.dryRun
        }
      });
      if (contractEvent.accepted) lastExecutionLedger = contractEvent.ledger;

      const simulationEvent = appendExecutionEvent(lastExecutionLedger, event);
      if (simulationEvent.accepted) lastExecutionLedger = simulationEvent.ledger;
      const replay = replayExecutionLedger(lastExecutionLedger);
      executionLedger.status.textContent = replay.valid ? "LEDGER VALID" : "LEDGER REJECTED";
      executionLedger.status.dataset.state = replay.valid ? "controlled" : "error";
      executionLedger.meta.textContent = lastExecutionLedger.ledgerId + " · " + replay.eventCount + " events";
      executionLedger.sequence.textContent = String(lastExecutionLedger.sequence);
      executionLedger.head.textContent = lastExecutionLedger.headHash;
      executionLedger.approvals.textContent = String(replay.state?.counters?.approvals || 0);
      executionLedger.contracts.textContent = String(replay.state?.counters?.contracts || 0);
      executionLedger.simulations.textContent = String(replay.state?.counters?.simulations || 0);
      if (executionLedger.outcomes) executionLedger.outcomes.textContent = String(replay.state?.counters?.outcomes || 0);
      executionLedger.events?.replaceChildren(...lastExecutionLedger.events.slice(-6).reverse().map((item) => {
        const row = document.createElement("div");
        row.className = "ledger-event";
        const type = document.createElement("strong");
        type.textContent = item.type;
        const meta = document.createElement("small");
        meta.textContent = "#" + item.sequence + " · " + (item.leadId || "RUN") + " · " + item.status;
        row.append(type, meta);
        return row;
      }));
    }

    const legacy = simulateExecution(envelope);
    addAudit(auditEvent("WORKFLOW_SIMULATE", { id: candidate.id }, simulation.status + " · " + simulation.outcomeId + " · " + legacy.code));
    status.dataset.state = "ok";
    status.textContent = candidate.id + " pasó por trace → envelope → contract → simulation. External calls: 0.";
  });

  workflowControl.artifact?.addEventListener("click", () => {
    qs("#exportDemo")?.click();
  });

  [
    feedback.v20WindowDays,
    feedback.v20MinSamples,
    feedback.v20MinGroupSamples
  ].filter(Boolean).forEach((input) => {
    input.addEventListener("change", () => {
      const config = {
        windowDays: Number(feedback.v20WindowDays?.value),
        minSamples: Number(feedback.v20MinSamples?.value),
        minGroupSamples: Number(feedback.v20MinGroupSamples?.value)
      };
      writeAdaptiveCalibrationConfigV20(config);
      addAudit(auditEvent("CALIBRATION_V20_CONFIG", { id: "V20" }, JSON.stringify(config)));
      render();
    });
  });

  feedback.v20Reset?.addEventListener("click", () => {
    const fingerprint = lastWorkflowPlan?.datasetFingerprint || null;
    try {
      localStorage.removeItem(calibrationStorageKeyV20(fingerprint));
    } catch {}
    lastAdaptiveCalibrationReportV20 = null;
    addAudit(auditEvent(
      "CALIBRATION_V20_RESET",
      { id: "V20" },
      fingerprint ? "dataset history cleared" : "global calibration history cleared"
    ));
    render();
  });

  const decidePolicyV25 = (decision) => {
    if (!lastPolicyProposalV25 && decision !== "ROLLBACK") return;
    const fingerprint = lastWorkflowPlan?.datasetFingerprint || null;
    const actor = normaliseActor(feedback.policyActor?.value || "");
    const rationale = normaliseRationale(feedback.policyRationale?.value || "");
    if (feedback.v24Reason && !actor) feedback.v24Reason.textContent = "ACTOR_IDENTITY_REQUIRED";
    if (feedback.v24Reason && actor && !rationale) feedback.v24Reason.textContent = "MISSING_RATIONALE";
    if (actor) writePolicyActorV25(actor);
    const result = decidePolicy({
      ledger: readPolicyLedgerV25(fingerprint),
      proposal: lastPolicyProposalV25,
      decision,
      actor,
      datasetFingerprint: fingerprint,
      now: new Date().toISOString(),
      reason: rationale,
      rows: decision === "APPROVE"
        ? buildObservedCalibrationRows(
            buildRunAnalysis(evaluated, getForecastConfig()).forecast?.rows || [],
            feedbackOutcomes
          )
        : []
    });
    if (!result.accepted) {
      if (feedback.v24Reason) feedback.v24Reason.textContent = result.reason;
      addAudit(auditEvent("POLICY_V25_" + decision, { id: "V25" }, result.reason));
      return;
    }
    writePolicyLedgerV25(result.ledger, fingerprint);
    addAudit(auditEvent("POLICY_V25_" + decision, { id: "V25" }, result.reason));
    render();
  };

  feedback.v24Approve?.addEventListener("click", () => decidePolicyV25("APPROVE"));
  feedback.v24Reject?.addEventListener("click", () => decidePolicyV25("REJECT"));
  feedback.v24Rollback?.addEventListener("click", () => decidePolicyV25("ROLLBACK"));

  feedback.record?.addEventListener("click", () => {
    if (!lastWorkflowPlan || !lastOutcomeLedger) return;
    const candidate = evaluated.find((lead) => String(lead.id) === String(feedback.lead?.value));
    if (!candidate) {
      feedback.status.textContent = "Selecciona un registro válido.";
      feedback.status.dataset.state = "error";
      return;
    }

    const type = feedback.type?.value;
    const action = lastWorkflowPlan.actions.find((item) => String(item.leadId) === String(candidate.id));
    const forecast = buildRunAnalysis(evaluated, getForecastConfig()).forecast;
    const forecastRow = forecast.rows.find((row) => String(row.leadId) === String(candidate.id));

    try {
      const outcome = createOutcomeRecord({
        runId: lastWorkflowPlan.runId,
        leadId: candidate.id,
        actionId: action?.idempotencyKey || null,
        action: action?.action || candidate.nextAction,
        type,
        occurredAt: new Date().toISOString(),
        actor: "operator",
        source: dataSource === "csv" ? "csv" : "simulation",
        expectedProbability: forecastRow?.probability ?? null,
        expectedValue: forecastRow?.expectedValue ?? null,
        actualValue: feedback.actualValue?.value || null,
        actualRevenue: feedback.actualRevenue?.value || null,
        responseHours: feedback.responseHours?.value || null,
        slaHours: action?.slaHours ?? null
      });
      const result = appendOutcome(lastOutcomeLedger, outcome);
      if (!result.accepted) {
        feedback.status.textContent = result.reason;
        feedback.status.dataset.state = "error";
        return;
      }

      lastOutcomeLedger = result.ledger;
      feedbackOutcomes = [...feedbackOutcomes, outcome];

      if (lastExecutionLedger) {
        const eventResult = appendExecutionEvent(lastExecutionLedger, createOutcomeEvent(outcome));
        if (eventResult.accepted) lastExecutionLedger = eventResult.ledger;
      }

      feedback.status.textContent =
        outcome.type + " registrado para " + (candidate.account || candidate.id) +
        " · " + outcome.outcomeId + " · feedback local";
      feedback.status.dataset.state = "ok";
      addAudit(auditEvent("OUTCOME_RECORDED", candidate, outcome.type + " · " + outcome.outcomeId));
      const currentForecast = buildRunAnalysis(evaluated, getForecastConfig()).forecast;
      renderFeedback(lastWorkflowPlan, currentForecast);
    } catch (error) {
      feedback.status.textContent = error.message;
      feedback.status.dataset.state = "error";
    }
  });

  executionLedger.replay?.addEventListener("click", () => {
    if (!lastExecutionLedger) {
      status.dataset.state = "error";
      status.textContent = "No hay execution ledger disponible para verificar.";
      return;
    }
    const replay = replayExecutionLedger(lastExecutionLedger);
    executionLedger.status.textContent = replay.valid ? "LEDGER VALID" : "LEDGER REJECTED";
    executionLedger.status.dataset.state = replay.valid ? "controlled" : "error";
    executionLedger.meta.textContent =
      lastExecutionLedger.ledgerId + " · " + replay.eventCount + " events · " + replay.reason;
    status.dataset.state = replay.valid ? "ok" : "error";
    status.textContent = replay.valid
      ? "Ledger reproducido correctamente. La cadena de eventos coincide con su HEAD."
      : "Ledger rechazado: la cadena de evidencia no coincide.";
    addAudit(auditEvent(
      replay.valid ? "LEDGER_REPLAY_OK" : "LEDGER_REPLAY_REJECTED",
      { id: lastExecutionLedger.runId || "LEDGER" },
      replay.reason
    ));
  });

  workflowImpact.preview?.addEventListener("click", () => {
    if (!lastWorkflowPlan) return;
    const impactResult = buildWorkflowImpact(evaluated, lastWorkflowPlan);
    workflowImpact.proposed.textContent = String(impactResult.summary.proposed);
    workflowImpact.applied.textContent = String(impactResult.summary.applied);
    workflowImpact.pending.textContent = String(impactResult.summary.pendingApproval);
    workflowImpact.qualificationDelta.textContent =
      (impactResult.qualificationDelta > 0 ? "+" : "") + impactResult.qualificationDelta;
    workflowImpact.stageDelta.textContent =
      "Q " + (impactResult.stageDelta.qualified > 0 ? "+" : "") + impactResult.stageDelta.qualified +
      " · N " + (impactResult.stageDelta.nurture > 0 ? "+" : "") + impactResult.stageDelta.nurture +
      " · New " + (impactResult.stageDelta.new > 0 ? "+" : "") + impactResult.stageDelta.new +
      " · Blocked " + (impactResult.stageDelta.blocked > 0 ? "+" : "") + impactResult.stageDelta.blocked;
    status.dataset.state = "ok";
    status.textContent = impactResult.summary.applied +
      " acciones no sensibles proyectadas. Las acciones sensibles permanecen pendientes de aprobación.";
    addAudit(auditEvent("WORKFLOW_IMPACT_PREVIEW", { id: lastWorkflowPlan.runId }, "V18 impact preview"));
  });

  workflowControl.verifyReplay?.addEventListener("click", () => {
    const raw = workflowControl.replayInput?.value?.trim();
    if (!raw) {
      workflowControl.replayStatus.textContent = "Pega aquí un run artifact JSON.";
      workflowControl.replayStatus.dataset.state = "error";
      return;
    }
    try {
      const artifact = JSON.parse(raw);
      const result = verifyRunArtifact(artifact, evaluated);
      workflowControl.replayStatus.dataset.state = result.valid ? "ok" : "error";
      workflowControl.replayStatus.textContent = result.valid
        ? "MATCH · fingerprint y record count coinciden con el dataset actual."
        : "MISMATCH · el artifact no corresponde al dataset actual.";
      addAudit(auditEvent(result.valid ? "REPLAY_OK" : "REPLAY_REJECTED", { id: artifact.runId || "ARTIFACT" }, result.reason));
    } catch (error) {
      workflowControl.replayStatus.dataset.state = "error";
      workflowControl.replayStatus.textContent = "Artifact inválido: " + error.message;
      addAudit(auditEvent("REPLAY_REJECTED", { id: "ARTIFACT" }, "invalid JSON"));
    }
  });

  document.addEventListener("keydown", (event) => {
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (event.key.toLowerCase() === "r") runWithAudit();
    if (event.key === "/") { event.preventDefault(); queueSearch?.focus(); }
  });

  renderWeights();
  renderHistory();
  renderGuided();
  persistAndRender(true);
}

function initAdvancedWorkbench() {
  const panel = qs("#advancedWorkbench");
  if (!panel) return;
  const openForHash = () => {
    const fragment = window.location.hash.slice(1);
    if (!fragment || fragment.startsWith("config=")) return;
    let id = "";
    try { id = decodeURIComponent(fragment); } catch { return; }
    const target = document.getElementById(id);
    if (target && (target === panel || panel.contains(target))) panel.open = true;
  };
  window.addEventListener("hashchange", openForHash);
  openForHash();
}

// The V40 engine is loaded only by laboratorio.html.
initAdvancedWorkbench();
initMenu();
initReveal();
initNavState();
initFilters();
initCalculator();
initBriefForm();
initTracking();
initPlayground();
