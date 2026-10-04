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
  commercialMetrics
} from "./revops-engine.js";

const STORAGE_KEY = "revops-studio:brief:v2";
const ANALYTICS_EVENT = "Reservar";

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

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

function initCalculator() {
  const output = qs("#annualCost"), detail = qs("#annualDetail");
  if (!output || !detail) return;
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
}

const demoSeed = [
  { id:"L-001", account:"Northstar", fit:92, intent:88, engagement:80, urgency:74, value:42000, owner:"Ana", segment:"Enterprise", source:"Inbound", lastTouchDays:3 },
  { id:"L-002", account:"Atlas", fit:78, intent:61, engagement:56, urgency:52, value:18500, owner:"Luis", segment:"Mid-market", source:"Partner", lastTouchDays:8 },
  { id:"L-003", account:"Kite", fit:41, intent:30, engagement:46, urgency:35, value:7200, owner:"Marta", segment:"SMB", source:"Outbound", lastTouchDays:21 },
  { id:"L-004", account:"Nova", fit:86, intent:90, engagement:72, urgency:91, value:67000, owner:"Ana", segment:"Enterprise", source:"Inbound", lastTouchDays:1 },
  { id:"L-005", account:"Orbit", fit:67, intent:54, engagement:62, urgency:44, value:24000, owner:"Luis", segment:"Mid-market", source:"Event", lastTouchDays:16 },
  { id:"L-006", account:"Pine", fit:74, intent:49, engagement:67, urgency:28, value:31000, owner:"Marta", segment:"Enterprise", source:"Referral", lastTouchDays:11 },
  { id:"L-007", account:"Mica", fit:57, intent:79, engagement:61, urgency:72, value:12800, owner:"Ana", segment:"SMB", source:"Inbound", lastTouchDays:19 },
  { id:"L-008", account:"Echo", fit:28, intent:35, engagement:32, urgency:18, value:4900, owner:"Luis", segment:"SMB", source:"Outbound", lastTouchDays:31 }
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
  let activeTableStage = "all";

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

  const currentConfig = () => ({
    weights: getWeights(),
    weightMode: "percent",
    thresholds: getThresholds(),
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
      const totalOptional = evaluated.length * 4;
      const presentOptional = evaluated.reduce((sum, lead) =>
        sum + ["value", "owner", "segment", "source"].filter((key) => String(lead[key] ?? "").trim() !== "").length, 0
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
        qsa(".demo-table tbody tr").forEach((item) => item.classList.toggle("is-selected", item === tr));
      };
      tr.addEventListener("click", inspect);
      tr.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inspect(); }
      });
      rows.appendChild(tr);
    });
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
      source: dataSource,
      scenario: activeScenario
    });
    if (datasetLabel) datasetLabel.textContent =
      (dataSource === "demo" ? "Demo dataset" : "CSV local") + " · " + evaluated.length + " records";
    if (runId) runId.textContent = lastSnapshot.runId;
    const lastRun = qs("#lastRun");
    if (lastRun) lastRun.textContent = "Última ejecución " + time + " · " + lastSnapshot.runId;
    status.dataset.state = "ok";
    status.textContent = "Evaluado localmente · sin llamadas de red · configuración guardable.";
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

  const loaded = readStored();
  const hashConfig = window.location.hash.startsWith("#config=")
    ? decodeConfig(window.location.hash.slice(8))
    : null;
  applyConfig(hashConfig || loaded || {});

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
    const payload = {
      exportedAt: new Date().toISOString(),
      runId: lastSnapshot?.runId || null,
      source: dataSource,
      scenario: activeScenario,
      weights: getWeights(),
      thresholds: getThresholds(),
      pipeline: summarisePipeline(evaluated),
      commercial: commercialMetrics(evaluated),
      queue: buildActionQueue(evaluated),
      records: evaluated
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "revops-run-" + (lastSnapshot?.runId || "export").toLowerCase() + ".json";
    anchor.click();
    URL.revokeObjectURL(url);
    addAudit(auditEvent("EXPORT", { id: lastSnapshot?.runId || "RUN" }, "JSON artifact generated"));
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
    if (approved) {
      approved = false;
      gate.textContent = "Aprobar siguiente acción";
      status.dataset.state = "error";
      status.textContent = "Gate cerrado. No hay ejecución sensible autorizada.";
      addAudit(auditEvent("GATE_CLOSED", { id: "MODEL" }, "manual approval revoked"));
      return;
    }

    const candidate = evaluated.find((lead) => lead.stage === "nurture") || evaluated.find((lead) => lead.stage === "new");
    if (!candidate) {
      status.dataset.state = "error";
      status.textContent = "No hay candidato seguro para simular una transición.";
      addAudit(auditEvent("GATE_REJECTED", { id: "MODEL" }, "no transition candidate"));
      return;
    }

    const target = candidate.stage === "nurture" ? "qualified" : "nurture";
    const result = transition(candidate, target, true);
    if (!result.ok) {
      status.dataset.state = "error";
      status.textContent = "Transición rechazada por la política.";
      addAudit(auditEvent("GATE_REJECTED", candidate, result.reason));
      return;
    }

    const updated = result.lead;
    evaluated = evaluated.map((lead) => lead.id === updated.id ? { ...lead, ...updated, nextAction: nextAction(updated) } : lead);
    approved = true;
    gate.textContent = "Aprobación activa ✓";
    status.dataset.state = "ok";
    status.textContent = candidate.id + " aprobado: " + candidate.stage + " → " + target + " (simulación).";
    addAudit(auditEvent("APPROVED", candidate, candidate.stage + " → " + target));
    render();
  });

  document.addEventListener("keydown", (event) => {
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (event.key.toLowerCase() === "r") runWithAudit();
    if (event.key === "/") { event.preventDefault(); queueSearch?.focus(); }
  });

  renderWeights();
  renderHistory();
  persistAndRender(true);
}

initMenu();
initReveal();
initNavState();
initFilters();
initCalculator();
initBriefForm();
initTracking();
initPlayground();
