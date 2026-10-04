import { parseCsv } from "./csv-utils.js";
import {
  DEFAULT_WEIGHTS,
  evaluateBatch,
  transition,
  auditEvent,
  summarisePipeline,
  buildActionQueue,
  summariseQueue
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
  { id:"L-001", account:"Northstar", fit:92, intent:88, engagement:80, urgency:74 },
  { id:"L-002", account:"Atlas", fit:78, intent:61, engagement:56, urgency:52 },
  { id:"L-003", account:"Kite", fit:41, intent:30, engagement:46, urgency:35 },
  { id:"L-004", account:"Nova", fit:86, intent:90, engagement:72, urgency:91 },
  { id:"L-005", account:"Orbit", fit:67, intent:54, engagement:62, urgency:44 },
  { id:"L-006", account:"Pine", fit:74, intent:49, engagement:67, urgency:28 },
  { id:"L-007", account:"Mica", fit:57, intent:79, engagement:61, urgency:72 },
  { id:"L-008", account:"Echo", fit:28, intent:35, engagement:32, urgency:18 }
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
  const totalWeight = qs("#weightTotal");
  const metrics = {
    total: qs("#demoTotal"), qualified: qs("#demoQualified"), nurture: qs("#demoNurture"),
    avg: qs("#demoAvgScore"), quality: qs("#demoQuality"), rate: qs("#demoRate")
  };
  const status = qs("#demoStatus"), audit = qs("#auditLog"), detail = qs("#leadDetail"), gate = qs("#approveDemo");
  const queue = qs("#actionQueue");
  const queueMeta = qs("#queueMeta");
  const queueSummary = qs("#queueSummary");
  const datasetLabel = qs("#datasetLabel");
  const shapeLabel = qs("#shapeLabel");
  const bars = {
    qualified: qs("#barQualified"), nurture: qs("#barNurture"),
    new: qs("#barNew"), blocked: qs("#barBlocked")
  };
  let evaluated = [];
  let approved = false;
  let dataSource = "demo";
  let lastRunAt = null;

  const scenarios = {
    balanced: { fit: 35, intent: 30, engagement: 20, urgency: 15 },
    growth: { fit: 25, intent: 40, engagement: 15, urgency: 20 },
    retention: { fit: 30, intent: 15, engagement: 40, urgency: 15 },
    speed: { fit: 20, intent: 25, engagement: 10, urgency: 45 }
  };

  const getWeights = () => Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, Number(input.value)]));
  const renderWeights = () => {
    const weights = getWeights();
    const sum = Object.values(weights).reduce((a, b) => a + b, 0) || 100;
    Object.entries(values).forEach(([key, output]) => { output.textContent = Math.round(weights[key] / sum * 100) + "%"; });
    if (totalWeight) totalWeight.textContent = Math.round(sum) + "%";
  };
  const render = () => {
    const summary = summarisePipeline(evaluated);
    metrics.total.textContent = String(summary.total);
    metrics.qualified.textContent = String(summary.byStage.qualified || 0);
    metrics.nurture.textContent = String(summary.byStage.nurture || 0);
    metrics.avg.textContent = String(summary.averageScore);
    metrics.quality.textContent = String(summary.qualityIssues);
    metrics.rate.textContent = Math.round(summary.qualificationRate * 100) + "%";

    Object.entries(bars).forEach(([stage, bar]) => {
      if (bar) bar.style.width = (summary.total ? (summary.byStage[stage] || 0) / summary.total * 100 : 0) + "%";
    });
    if (shapeLabel) {
      shapeLabel.textContent = summary.total
        ? (summary.byStage.qualified || 0) + " qualified · " +
          (summary.byStage.nurture || 0) + " nurture · " +
          (summary.byStage.blocked || 0) + " blocked"
        : "—";
    }

    const builtQueue = buildActionQueue(evaluated);
    const qSummary = summariseQueue(builtQueue);
    if (queueMeta) queueMeta.textContent = qSummary.total + " actions · " + qSummary.urgent + " urgent";
    if (queueSummary) queueSummary.textContent =
      "Critical " + (qSummary.byPriority.critical || 0) +
      " · High " + (qSummary.byPriority.high || 0) +
      " · Medium " + (qSummary.byPriority.medium || 0) +
      " · Low " + (qSummary.byPriority.low || 0);
    if (queue) {
      queue.replaceChildren();
      if (!builtQueue.length) {
        const empty = document.createElement("div");
        empty.className = "queue-empty";
        empty.textContent = "Ejecuta el modelo para construir una cola operativa.";
        queue.appendChild(empty);
      } else {
        builtQueue.slice(0, 8).forEach((item, index) => {
          const article = document.createElement("article");
          article.className = "queue-item";
          const top = document.createElement("div");
          top.className = "queue-top";
          const rank = document.createElement("span");
          rank.className = "queue-rank";
          rank.textContent = String(index + 1).padStart(2, "0");
          const title = document.createElement("strong");
          title.textContent = item.account;
          const priority = document.createElement("span");
          priority.className = "queue-priority";
          priority.dataset.priority = item.priority;
          priority.textContent = item.priority.toUpperCase();
          top.append(rank, title, priority);

          const meta = document.createElement("div");
          meta.className = "queue-meta";
          meta.textContent = item.action + " · " + item.lane + " · SLA " + item.slaHours + "h";
          const why = document.createElement("div");
          why.className = "queue-reason";
          why.textContent = item.reason;
          article.append(top, meta, why);
          queue.appendChild(article);
        });
      }
    }

    rows.replaceChildren();
    evaluated.forEach((lead) => {
      const tr = document.createElement("tr");
      tr.tabIndex = 0;
      [lead.id, lead.account, lead.score ?? "—", lead.stage, lead.nextAction].forEach((value, index) => {
        const td = document.createElement("td");
        td.textContent = String(value);
        if (index === 3) td.dataset.state = lead.stage;
        tr.appendChild(td);
      });
      const inspect = () => {
        if (detail) detail.textContent = lead.score === null
          ? lead.id + " · blocked · " + lead.quality.errors.join(", ")
          : lead.id + " · " + lead.account + " · score " + lead.score + " · " +
            Object.entries(lead.breakdown).map(([key, value]) => key + " +" + value).join(" · ");
      };
      tr.addEventListener("click", inspect);
      tr.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inspect(); } });
      rows.appendChild(tr);
    });
  };
  const addAudit = (entry) => {
    if (!audit) return;
    const line = document.createElement("div");
    line.className = "audit-line";
    line.textContent = entry.at.slice(11, 19) + " · " + entry.action + " · " + entry.leadId + " · " + entry.detail;
    audit.prepend(line);
    while (audit.children.length > 8) audit.lastElementChild.remove();
  };
  const run = () => {
    renderWeights();
    evaluated = evaluateBatch(window.__REVOPS_DATA__ || demoSeed, getWeights());
    lastRunAt = new Date();
    const nowLabel = lastRunAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    if (datasetLabel) datasetLabel.textContent =
      (dataSource === "demo" ? "Demo dataset" : "CSV local") + " · " + evaluated.length + " records";
    evaluated.forEach((lead) => addAudit(auditEvent("EVALUATE", lead, lead.stage + " / score " + (lead.score ?? "n/a"))));
    status.dataset.state = "ok";
    status.textContent = "Modelo evaluado localmente. " +
      (dataSource === "demo" ? "Datos sintéticos." : "CSV leído en este navegador.") +
      " Sin llamadas de red.";
    const lastRun = qs("#lastRun");
    if (lastRun) lastRun.textContent = "Última ejecución " + nowLabel;
    render();
  };

  Object.values(inputs).forEach((input) => input?.addEventListener("input", run));
  qs("#runDemo")?.addEventListener("click", run);
  qs("#resetDemo")?.addEventListener("click", () => {
    Object.entries(DEFAULT_WEIGHTS).forEach(([key, value]) => { inputs[key].value = String(Math.round(value * 100)); });
    window.__REVOPS_DATA__ = null;
    dataSource = "demo";
    evaluated = []; approved = false; audit?.replaceChildren();
    gate.textContent = "Simular aprobación humana";
    status.dataset.state = ""; status.textContent = "";
    detail.textContent = "Selecciona un registro para inspeccionar la explicación.";
    renderWeights(); run();
  });

  qsa("[data-scenario]").forEach((button) => {
    button.addEventListener("click", () => {
      const values = scenarios[button.dataset.scenario];
      if (!values) return;
      Object.entries(values).forEach(([key, value]) => { if (inputs[key]) inputs[key].value = String(value); });
      qsa("[data-scenario]").forEach((item) => item.classList.toggle("is-active", item === button));
      run();
      addAudit(auditEvent("SCENARIO", { id: button.dataset.scenario }, "weights updated"));
    });
  });

  qs("#csvInput")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      window.__REVOPS_DATA__ = parseCsv(await file.text());
      dataSource = "csv";
      approved = false;
      gate.textContent = "Simular aprobación humana";
      run();
      status.dataset.state = "ok";
      status.textContent = "CSV importado localmente: " + window.__REVOPS_DATA__.length + " registros. Nada se ha subido.";
      addAudit(auditEvent("IMPORT", { id: "CSV" }, file.name + " · " + window.__REVOPS_DATA__.length + " rows"));
    } catch (error) {
      status.dataset.state = "error";
      status.textContent = "CSV rechazado: " + error.message;
      addAudit(auditEvent("IMPORT_REJECTED", { id: "CSV" }, error.message));
      event.target.value = "";
    }
  });

  qs("#exportDemo")?.addEventListener("click", () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: dataSource,
      weights: normaliseForExport(getWeights()),
      pipeline: summarisePipeline(evaluated),
      queue: buildActionQueue(evaluated),
      records: evaluated
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "revops-run.json";
    anchor.click();
    URL.revokeObjectURL(url);
    addAudit(auditEvent("EXPORT", { id: "RUN" }, "JSON artifact generated"));
  });

  const normaliseForExport = (weights) => {
    const total = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
    return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Number((value / total).toFixed(4))]));
  };
  gate?.addEventListener("click", () => {
    approved = !approved;
    gate.textContent = approved ? "Aprobación activa ✓" : "Simular aprobación humana";
    status.dataset.state = approved ? "ok" : "error";
    status.textContent = approved ? "Gate activo: las transiciones sensibles pueden avanzar en la simulación." : "Gate desactivado: ejecución sensible bloqueada.";
    const candidate = evaluated.find((lead) => lead.stage === "qualified");
    if (approved && candidate) {
      const result = transition(candidate, "qualified", true);
      if (result.ok) addAudit(auditEvent("APPROVED", result.lead, "human gate passed"));
    }
  });

  renderWeights();
  run();
}

initMenu();
initReveal();
initNavState();
initFilters();
initCalculator();
initBriefForm();
initTracking();
initPlayground();
