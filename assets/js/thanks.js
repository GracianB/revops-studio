(() => {
  "use strict";

  const STORAGE_KEY = "revops-studio:brief:v2";
  const TO = "gracianbaenagonzalez@gmail.com";

  const $ = (id) => document.getElementById(id);
  const summary = $("briefSummary");
  const status = $("thanksStatus");
  const send = $("sendBrief");
  const copy = $("copyBrief");

  const fallback = {
    nombre: "Hola",
    email: "",
    herramientas: "",
    horas: "",
    dolor: "",
    servicio: ""
  };

  let data = fallback;

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    data = stored ? { ...fallback, ...JSON.parse(stored) } : fallback;
  } catch {
    data = fallback;
  }

  const mailBody = [
    "Hola Gracián,",
    "",
    "Te envío el brief de RevOps Studio.",
    "",
    "Nombre: " + data.nombre,
    "Servicio: " + (data.servicio || "Sin especificar"),
    "Email: " + data.email,
    "Herramientas actuales: " + data.herramientas,
    "Horas / semana: " + data.horas,
    "Qué duele: " + data.dolor,
    "",
    "Quiero revisar el proceso en una sesión de diagnóstico de 30–45 min.",
    "",
    "Gracias."
  ].join("\n");

  const subject = "RevOps Studio | Diagnóstico | " + (data.nombre || "Brief");
  const mailto = "mailto:" + TO +
    "?subject=" + encodeURIComponent(subject) +
    "&body=" + encodeURIComponent(mailBody);

  send.href = mailto;

  summary.textContent = [
    data.nombre ? "Persona: " + data.nombre : "Persona: no indicada",
    data.servicio ? "Servicio: " + data.servicio : "Servicio: sin especificar",
    data.herramientas ? "Herramientas: " + data.herramientas : "Herramientas: no indicadas",
    data.horas ? "Horas / semana: " + data.horas : "Horas / semana: no indicadas",
    data.dolor ? "Fricción: " + data.dolor : "Fricción: no indicada"
  ].join(" · ");

  send.addEventListener("click", () => {
    if (typeof window.plausible === "function") {
      window.plausible("Brief email", { props: { place: "gracias" } });
    }
  });

  copy?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(mailBody);
      status.dataset.state = "ok";
      status.textContent = "Brief copiado al portapapeles.";
    } catch {
      status.dataset.state = "error";
      status.textContent = "El navegador no permitió copiarlo. Usa el botón de email.";
    }
  });
})();
