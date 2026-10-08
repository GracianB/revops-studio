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
  const render = () => {
    const hours = Math.min(80, numberValue("#hoursWeek", 6));
    const people = Math.min(100, Math.max(1, numberValue("#people", 2)));
    const cost = Math.min(500, numberValue("#hourCost", 25));
    output.textContent = formatEuro(hours * people * cost * 52);
    detail.textContent = hours.toLocaleString("es-ES") + " h/semana × " + people.toLocaleString("es-ES") + " personas × " + formatEuro(cost) + "/h × 52 semanas. Coste del tiempo, no ahorro prometido.";
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
  form.addEventListener("input", updateFallback);
  form.addEventListener("change", updateFallback);
  updateFallback();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const brief = collectBrief(form);
    if (qs("#websiteExtra")?.value.trim()) {
      status.textContent = "No se ha enviado el formulario.";
      status.dataset.state = "error";
      return;
    }
    updateFallback();
    saveBrief(brief);
    submit.disabled = true;
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
          consentimiento: "sí"
        }),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !(result.success === true || result.success === "true")) {
        const rejected = new Error("Provider rejected submission");
        rejected.status = response.status;
        rejected.providerMessage = typeof result.message === "string" ? result.message : "";
        throw rejected;
      }
      track("ContactSubmitted", { place: "landing" });
      window.location.assign("./gracias.html?via=proveedor");
    } catch (error) {
      status.dataset.state = "error";
      const providerSaidActivation = /activat|confirm.*email|verif.*email/i.test(
        typeof error?.providerMessage === "string" ? error.providerMessage : ""
      );
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
