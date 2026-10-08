(() => {
  "use strict";
  const STORAGE_KEY = "revops-studio:brief:v2";
  const ACCEPTED_KEY = "revops-studio:contact:accepted";
  const TO = "gracianbaenagonzalez@gmail.com";
  const $ = id => document.getElementById(id);
  const summary = $("briefSummary"), status = $("thanksStatus");
  const send = $("sendBrief"), copy = $("copyBrief");
  const title = $("thanks-title"), explanation = $("deliveryExplanation");
  let confirmedInSession = false;
  try { confirmedInSession = sessionStorage.getItem(ACCEPTED_KEY) === "true"; } catch { /* Browser storage may be disabled. */ }
  const acceptedByProvider = new URLSearchParams(location.search).get("via") === "proveedor" && confirmedInSession;
  const empty = {nombre:"", email:"", servicio:"", herramientas:"", horas:"", dolor:"", estimacion:""};
  let brief = empty;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) brief = {...empty,...JSON.parse(stored)};
  } catch { /* A visit without session storage must still work. */ }

  const body = [
    "Hola Gracián,",
    "",
    "Te escribo sobre un posible proyecto de RevOps Studio.",
    "",
    "Nombre: " + brief.nombre,
    "Email: " + brief.email,
    "Servicio: " + (brief.servicio || "Por definir"),
    "Herramientas actuales: " + (brief.herramientas || "Sin especificar"),
    "Horas semanales: " + (brief.horas || "Sin especificar"),
    "Problema: " + brief.dolor,
    ...(brief.estimacion ? ["Estimación orientativa: " + brief.estimacion] : []),
    "",
    "Gracias."
  ].join("\n");
  send.href = "mailto:" + TO + "?subject=" + encodeURIComponent("RevOps Studio | Consulta") +
    "&body=" + encodeURIComponent(body);

  if (summary) {
    summary.textContent = brief.dolor ? [
      "Nombre: " + (brief.nombre || "No indicado"),
      "Servicio: " + (brief.servicio || "Por definir"),
      "Herramientas: " + (brief.herramientas || "Sin indicar"),
      "Necesidad: " + brief.dolor,
      ...(brief.estimacion ? ["Estimación orientativa: " + brief.estimacion] : [])
    ].join("\n") : "No hay datos guardados en esta pestaña. Puedes enviar un correo directo o reservar una llamada.";
  }
  if (acceptedByProvider) {
    title.textContent = "Tu consulta está en camino.";
    explanation.textContent = "FormSubmit ha aceptado tu consulta para enviarla a mi correo. Revisaré las solicitudes recibidas y responderé a la dirección indicada. Si necesitas añadir algo, puedes escribirme directamente.";
    send.textContent = "Añadir información por correo ↗";
    status.dataset.state = "info";
    status.textContent = "Este aviso confirma la aceptación del envío por FormSubmit, no la entrega al buzón ni la lectura del mensaje.";
  } else {
    title.textContent = "Tu mensaje está preparado.";
    explanation.textContent = "No se puede verificar un envío por abrir esta página directamente. Si ya has enviado tu consulta, evita duplicarla. Si no lo has hecho, usa el correo directo o vuelve al formulario.";
    status.dataset.state = "info";
    status.textContent = "Esta página no confirma un envío sin una aceptación previa de FormSubmit en esta pestaña.";
  }

  copy?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(body);
      status.dataset.state = "ok";
      status.textContent = "Texto copiado. Puedes pegarlo en tu aplicación de correo.";
    } catch {
      status.dataset.state = "error";
      status.textContent = "No fue posible copiar. Utiliza el botón de correo.";
    }
  });
})();
