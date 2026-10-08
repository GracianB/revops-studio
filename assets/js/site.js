// Lightweight RevOps Studio commercial interactions (no V40 engine imports).
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
    servicio: String(data.servicio || "").trim(),
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
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Session storage can be disabled. Keep the brief available for review.
      const message = [
        "Hola,","", "Quiero consultar un proyecto en RevOps Studio.","",
        "Nombre: " + data.nombre, "Email: " + data.email,
        "Servicio: " + data.servicio,
        "Herramientas actuales: " + data.herramientas,
        "Horas/semana: " + data.horas, "Problema: " + data.dolor
      ].join("\n");
      const link = document.createElement("a");
      link.href = "mailto:gracianbaenagonzalez@gmail.com?subject=" +
        encodeURIComponent("RevOps Studio | Consulta") + "&body=" + encodeURIComponent(message);
      link.textContent = "Revisar correo preparado ↗";
      status.replaceChildren(document.createTextNode("El navegador no permite guardar el brief. "), link);
      status.dataset.state = "error";
      return;
    }
    track(ANALYTICS_EVENT, { place: "brief" });
    status.dataset.state = "ok";
    status.textContent = "Brief preparado en esta pestaña. Revisa el mensaje antes de enviarlo.";
    window.location.assign("./gracias.html");
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

initMenu();
initReveal();
initNavState();
initFilters();
initServiceChoice();
initCalculator();
initBriefForm();
initTracking();
