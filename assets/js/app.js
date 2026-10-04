(() => {
  "use strict";

  const STORAGE_KEY = "revops-studio:brief:v2";
  const ANALYTICS_EVENT = "Reservar";

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

  function track(eventName, props = {}) {
    if (typeof window.plausible === "function") {
      window.plausible(eventName, { props });
    }
  }

  function initMenu() {
    const button = qs("#menuBtn");
    const menu = qs("#mobileNav");
    if (!button || !menu) return;

    const setOpen = (open) => {
      button.setAttribute("aria-expanded", String(open));
      menu.classList.toggle("is-open", open);
      document.body.classList.toggle("menu-open", open);
    };

    button.addEventListener("click", () => {
      setOpen(button.getAttribute("aria-expanded") !== "true");
    });

    qsa("a", menu).forEach((link) => link.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(false);
    });
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
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) return;
      clear();
      (byId.get(visible.target.id) || []).forEach((link) => link.setAttribute("aria-current", "true"));
    }, { rootMargin: "-18% 0px -70% 0px", threshold: [0.05, 0.25, 0.5] });

    sections.forEach((section) => observer.observe(section));
  }

  function initFilters() {
    const buttons = qsa(".filter-btn");
    const cards = qsa(".service-card");
    if (!buttons.length || !cards.length) return;

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const filter = button.dataset.filter || "all";

        buttons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));

        cards.forEach((card) => {
          const services = (card.dataset.service || "").split(/\s+/).filter(Boolean);
          card.hidden = filter !== "all" && !services.includes(filter);
        });
      });
    });
  }

  function numberValue(selector, fallback) {
    const value = Number(qs(selector)?.value);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  function formatEuro(value) {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0
    }).format(value);
  }

  function initCalculator() {
    const fields = ["#hoursWeek", "#people", "#hourCost"];
    const output = qs("#annualCost");
    const detail = qs("#annualDetail");
    if (!output || !detail) return;

    const render = () => {
      const hours = numberValue("#hoursWeek", 6);
      const people = Math.max(1, numberValue("#people", 2));
      const cost = numberValue("#hourCost", 25);
      const annual = hours * people * cost * 52;

      output.textContent = formatEuro(annual);
      detail.textContent =
        hours.toLocaleString("es-ES") + " h/semana × " +
        people.toLocaleString("es-ES") + " persona(s) × " +
        formatEuro(cost) + "/h × 52 semanas";
    };

    fields.forEach((selector) => qs(selector)?.addEventListener("input", render));
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

  function storeBrief(data) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  function initBriefForm() {
    const form = qs("#briefForm");
    const status = qs("#formStatus");
    if (!form || !status) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const data = collectBrief(form);
      const stored = storeBrief(data);

      track(ANALYTICS_EVENT, { place: "brief" });

      status.dataset.state = stored ? "ok" : "error";
      status.textContent = stored
        ? "Brief guardado en esta pestaña. La siguiente pantalla prepara el correo y el calendario."
        : "No se pudo guardar el brief localmente. Mantén esta pestaña abierta y continúa.";

      window.setTimeout(() => {
        window.location.href = "./gracias.html";
      }, 180);
    });
  }

  function initTracking() {
    qsa('a[data-track="calendar"]').forEach((link) => {
      link.addEventListener("click", () => track(ANALYTICS_EVENT, { place: link.dataset.place || "calendar" }));
    });
    qsa('a[data-track="github"]').forEach((link) => {
      link.addEventListener("click", () => track("GitHub", { place: link.dataset.place || "hero" }));
    });
  }

  initMenu();
  initReveal();
  initNavState();
  initFilters();
  initCalculator();
  initBriefForm();
  initTracking();
})();
