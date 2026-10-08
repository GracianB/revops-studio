(() => {
  "use strict";
  const key = "revops-theme";
  const root = document.documentElement;
  const buttons = [...document.querySelectorAll("[data-theme-toggle]")];
  const meta = document.querySelector('meta[name="theme-color"]');
  const chosen = () => root.dataset.theme === "light" ? "light" : "dark";
  const render = () => {
    const light = chosen() === "light";
    if (meta) meta.content = light ? "#f6f4ef" : "#0d141d";
    buttons.forEach(button => {
      button.setAttribute("aria-label", light ? "Cambiar a modo oscuro" : "Cambiar a modo claro");
      button.setAttribute("aria-pressed", String(light));
      const icon = button.querySelector("[data-theme-icon]");
      if (icon) icon.textContent = light ? "☾" : "☼";
      const label = button.querySelector(".theme-label");
      if (label) label.textContent = light ? "Oscuro" : "Claro";
    });
  };
  buttons.forEach(button => button.addEventListener("click", () => {
    const next = chosen() === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try { localStorage.setItem(key, next); } catch { /* private browsing */ }
    render();
  }));
  render();
})();
