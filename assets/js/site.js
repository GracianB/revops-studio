// Lightweight RevOps Studio commercial interactions (no V40 engine imports).
import { submissionState } from "./contact-response.js";
const STORAGE_KEY = "revops-studio:brief:v2";
const PENDING_KEY = "revops-studio:brief:pending";
const ACCEPTED_KEY = "revops-studio:contact:accepted";
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


function calculatorScenario() {
  const hours = Math.min(80, numberValue("#hoursWeek", 6));
  const people = Math.min(100, Math.max(1, numberValue("#people", 2)));
  const cost = Math.min(500, numberValue("#hourCost", 25));
  return { hours, people, cost, annual: hours * people * cost * 52 };
}

function showCalcContext() {
  const container = qs("#calcContext"), summary = qs("#calcContextSummary");
  const estimate = qs("#estimacion")?.value.trim() || "";
  if (!container || !summary) return;
  container.hidden = !estimate;
  summary.textContent = estimate ? "Se incluirá en tu consulta: " + estimate : "";
}

function initCalculator() {
  const output = qs("#annualCost"), detail = qs("#annualDetail");
  if (!output || !detail) return;
  const render = () => {
    const { hours, people, cost, annual } = calculatorScenario();
    output.textContent = formatEuro(annual);
    detail.textContent = hours.toLocaleString("es-ES") + " h/semana × " + people.toLocaleString("es-ES") + " personas × " + formatEuro(cost) + "/h × 52 semanas. Coste del tiempo, no ahorro prometido.";
  };
  ["#hoursWeek", "#people", "#hourCost"].forEach((selector) => qs(selector)?.addEventListener("input", render));
  qs("#calcToContact")?.addEventListener("click", () => {
    const hoursField = qs("#horas"), estimateField = qs("#estimacion"), form = qs("#briefForm");
    if (!hoursField || !estimateField || !form) return;
    const { hours, people, cost, annual } = calculatorScenario();
    hoursField.value = String(hours);
    estimateField.value = hours.toLocaleString("es-ES") + " h/semana por persona × " + people.toLocaleString("es-ES") + " personas × " + formatEuro(cost) + "/h × 52 semanas = " + formatEuro(annual) + "/año. Coste teórico del tiempo, no ahorro prometido.";
    showCalcContext();
    form.dispatchEvent(new Event("input", { bubbles: true }));
  });
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
    servicio: String(data.servicio || "").trim(),
    estimacion: String(data.estimacion || "").trim(),
    createdAt: new Date().toISOString()
  };
}

const FORM_ENDPOINT = "https://formsubmit.co/ajax/gracianbaenagonzalez@gmail.com";
const CONTACT_TO = "gracianbaenagonzalez@gmail.com";

function mailtoForBrief(brief) {
  const subject = "RevOps Studio | Consulta | " + (brief.servicio || "Proyecto");
  const body = ["Hola, quiero consultar un proyecto en RevOps Studio.", "",
    "Nombre: " + brief.nombre,
    "Email: " + brief.email,
    "Servicio: " + (brief.servicio || "Sin especificar"),
    "Herramientas: " + (brief.herramientas || "Sin especificar"),
    "Horas/semana: " + (brief.horas || "Sin especificar"),
    "Necesidad: " + brief.dolor,
    ...(brief.estimacion ? ["Estimación orientativa: " + brief.estimacion] : []),
    "", "Gracias."].join("\n");
  return "mailto:" + CONTACT_TO + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
}

function initBriefForm() {
  const form = qs("#briefForm"), status = qs("#formStatus");
  const submit = qs("#briefSubmit"), fallback = qs("#briefEmailFallback");
  if (!form || !status || !submit) return;
  const saveBrief = (brief) => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(brief)); } catch { /* storage is optional */ }
  };
  const updateFallback = () => {
    if (fallback) fallback.href = mailtoForBrief(collectBrief(form));
  };
  // Restore only a failed attempt, never the consent or a successfully sent form.
  try {
    if (sessionStorage.getItem(PENDING_KEY) === "true") {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
      if (saved && typeof saved === "object") {
        for (const name of ["nombre", "email", "herramientas", "horas", "dolor", "servicio", "estimacion"]) {
          const field = form.elements.namedItem(name);
          if (field && !field.value && typeof saved[name] === "string") field.value = saved[name];
        }
        status.dataset.state = "info";
        status.textContent = "Hemos recuperado tu consulta pendiente en esta pestaña. El envío anterior no está confirmado. Revisa los datos antes de volver a enviarla.";
      }
    }
  } catch { /* Storage may be unavailable or contain an invalid draft. */ }
  const hoursField = qs("#horas"), estimateField = qs("#estimacion");
  hoursField?.addEventListener("input", () => {
    if (estimateField?.value) { estimateField.value = ""; showCalcContext(); }
  });
  qs("#calcContextClear")?.addEventListener("click", () => {
    if (estimateField) estimateField.value = "";
    showCalcContext();
    updateFallback();
  });
  form.addEventListener("input", updateFallback);
  form.addEventListener("change", updateFallback);
  showCalcContext();
  updateFallback();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const brief = collectBrief(form);
    if (qs("#websiteExtra")?.value.trim()) {
      status.textContent = "No se ha enviado el formulario.";
      status.dataset.state = "error";
      return;
    }
    updateFallback();
    saveBrief(brief);
    try { sessionStorage.removeItem(ACCEPTED_KEY); } catch { /* optional */ }
    try { sessionStorage.setItem(PENDING_KEY, "true"); } catch { /* optional */ }
    submit.disabled = true;
    form.setAttribute("aria-busy", "true");
    submit.textContent = "Enviando consulta…";
    status.dataset.state = "info";
    status.textContent = "Enviando a través del proveedor del formulario. Tus datos no se guardan en el repositorio.";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          _subject: "RevOps Studio | Nueva consulta",
          _captcha: "true",
          _honey: "",
          nombre: brief.nombre,
          email: brief.email,
          servicio: brief.servicio,
          herramientas: brief.herramientas,
          horas: brief.horas,
          mensaje: brief.dolor,
          consentimiento: "sí",
          ...(brief.estimacion ? { estimacion: brief.estimacion } : {})
        }),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      const outcome = submissionState(response.ok, result);
      if (outcome !== "accepted") {
        const rejected = new Error("Provider rejected submission");
        rejected.status = response.status;
        rejected.activationRequired = outcome === "activation";
        throw rejected;
      }
      try { sessionStorage.removeItem(PENDING_KEY); sessionStorage.setItem(ACCEPTED_KEY, "true"); } catch { /* optional */ }
      track("ContactSubmitted", { place: "landing" });
      window.location.assign("./gracias.html?via=proveedor");
    } catch (error) {
      status.dataset.state = "error";
      const providerSaidActivation = error?.activationRequired === true;
      if (providerSaidActivation) {
        status.textContent = "El proveedor requiere que el propietario active el formulario desde el correo de FormSubmit. No hay entrega confirmada. Puedes escribirnos directamente por email.";
      } else if (error?.name === "AbortError") {
        status.textContent = "La conexión ha tardado demasiado. No podemos confirmar si el proveedor procesó el mensaje. Evita enviarlo repetidamente y usa el correo directo si lo necesitas.";
      } else if (error?.message === "Provider rejected submission") {
        status.textContent = "El proveedor no ha aceptado la solicitud (HTTP " + error.status + "). Puede faltar la activación inicial del formulario. No hay envío confirmado; utiliza el correo directo.";
      } else {
        status.textContent = "No se ha podido comprobar el envío al proveedor. No se ha confirmado la entrega. Puedes usar «Prefiero escribir un correo» sin perder los datos.";
      }
      if (fallback) fallback.focus();
    } finally {
      clearTimeout(timeout);
      submit.disabled = false;
      form.removeAttribute("aria-busy");
      submit.textContent = "Enviar solicitud ↗";
    }
  });
}

function initTracking() {
  qsa('a[data-track="calendar"]').forEach((link) => link.addEventListener("click", () => track(ANALYTICS_EVENT, { place: link.dataset.place || "calendar" })));
  qsa('a[data-track="github"]').forEach((link) => link.addEventListener("click", () => track("GitHub", { place: link.dataset.place || "hero" })));
  qsa('a[data-track="proof-deck"]').forEach((link) => link.addEventListener("click", () => track("ProfessionalDeck", { place: link.dataset.place || "proof" })));
  qsa('a[data-track="proof-linkedin"]').forEach((link) => link.addEventListener("click", () => track("LinkedIn", { place: link.dataset.place || "proof" })));
}


function initServiceChoice() {
  const select = qs("#servicio");
  if (!select) return;
  qsa("[data-service-choice]").forEach(link => link.addEventListener("click", () => {
    const value = link.dataset.serviceChoice || "";
    if (Array.from(select.options).some(option => option.value === value)) select.value = value;
  }));
}

// Keep configuration links shared before the lab was moved.
if (window.location.hash.startsWith("#config=") && window.location.hash.length < 4096) {
  window.location.replace("./laboratorio.html" + window.location.hash);
}

initMenu();
initReveal();
initNavState();
initFilters();
initServiceChoice();
initCalculator();
initBriefForm();
initTracking();
