// RevOps R2: deterministic, local-only evidence of a workflow change.
// The comparison contains counters and rule reasons, never input rows or client identifiers.
import { analyzeWorkflow } from "./workflow-insights.js";

const STATES = Object.freeze(["listo", "revisar", "bloqueado"]);
const RULE_REASONS = new Set([
  "Identificador vacío","Duplicado: identificador ya procesado",
  "Falta el cliente","Email incompleto o inválido","Total no válido o no positivo",
  "Estado de pedido desconocido","Marcado para revisión por origen",
  "Pedido cerrado; no debe reabrirse","Pedido listo tras validación",
  "Falta el asunto de la incidencia","Prioridad desconocida","Estado de ticket desconocido",
  "Incidencia ya cerrada","Prioridad alta: necesita criterio humano","Incidencia válida",
  "Falta fuente","Fecha inválida; utiliza AAAA-MM-DD",
  "Valor numérico incorrecto","Valor negativo: confirmar con la fuente","Registro consistente"
]);
function ruleReason(reason) {
  return RULE_REASONS.has(reason) ? reason : "Regla no catalogada";
}


function snapshot(result) {
  const a = analyzeWorkflow(result);
  return Object.freeze({
    total: a.total,
    prepared: a.actionable,
    historical: a.historical,
    reviewing: a.reviewCount,
    blocked: a.blockedCount,
    preparedPercent: a.ratio,
    externalExecuted: 0
  });
}
function diff(before, after) {
  return after - before;
}
function label(state) {
  return { listo: "listo", revisar: "revisión humana", bloqueado: "bloqueado" }[state] || "sin estado";
}
/**
 * Compares two executions over the same scenario and ordered record positions.
 * It does not claim causation or business gains. If inputs are incomparable,
 * the output says so rather than creating a fake before/after.
 */
export function compareWorkflow(baseline, current) {
  if (!baseline?.rows || !current?.rows) {
    throw new Error("Ejecuta primero un proceso antes de compararlo.");
  }
  const before = snapshot(baseline), after = snapshot(current);
  const comparable = baseline.scenario === current.scenario && before.total === after.total;
  const transitions = new Map();
  let changed = 0;
  if (comparable) {
    for (let i = 0; i < baseline.rows.length; i++) {
      const left = baseline.rows[i], right = current.rows[i];
      if (!STATES.includes(left.status) || !STATES.includes(right.status)) {
        throw new Error("Un registro contiene un estado no reconocido.");
      }
      if (left.status !== right.status || left.reason !== right.reason || left.action !== right.action) {
        changed++;
        const fromReason=ruleReason(left.reason),toReason=ruleReason(right.reason);
        const key = [left.status,right.status,fromReason,toReason].join("\u001f");
        const group = transitions.get(key) || {
          from: left.status, to: right.status, fromReason, toReason, count: 0
        };
        group.count++;
        transitions.set(key, group);
      }
    }
  }
  const changes = Object.freeze([...transitions.values()].map(item => Object.freeze({
    ...item, description: item.count + " registro(s): " + label(item.from) + " → " + label(item.to) +
      " · Regla: " + item.fromReason + " → " + item.toReason
  })));
  const delta = Object.freeze({
    prepared: diff(before.prepared, after.prepared),
    blocked: diff(before.blocked, after.blocked),
    reviewing: diff(before.reviewing, after.reviewing),
    historical: diff(before.historical, after.historical),
    preparedPoints: diff(before.preparedPercent, after.preparedPercent)
  });
  const mode = !comparable ? "incomparable" : changed > 0 ? "recalculated" : "baseline";
  const summary = !comparable
    ? "Los conjuntos no son comparables. Ejecuta un nuevo punto de partida."
    : mode === "baseline"
      ? "Punto de partida capturado. Corrige un registro para comparar los resultados."
      : "Cambio recalculado sobre las mismas " + before.total +
        " posiciones. " + changed + " registro(s) con decisión o motivo distinto. " +
        "Ninguna propuesta se ha ejecutado fuera del navegador.";
  return Object.freeze({
    mode, comparable, before, after, delta, changed, transitions: changes,
    summary,
    rule: "Cada decisión procede de las reglas deterministas y los datos introducidos en la pestaña.",
    limitation: "Las acciones están propuestas, no ejecutadas. El cambio no mide tiempo ahorrado, ROI ni calidad en producción.",
    externalExecuted: 0
  });
}

/** Aggregated readout intended for sharing; no ID, customer name, email or raw CSV. */
export function comparisonReport(result) {
  if (!result?.comparable) throw new Error("No se puede exportar una comparación de conjuntos distintos.");
  const formatDelta = value => value > 0 ? "+" + value : String(value);
  return [
    "REVOPS STUDIO | COMPARATIVA R2 · SIMULACIÓN LOCAL",
    "Estado: " + (result.mode === "baseline" ? "punto de partida" : "recalculado"),
    "Antes: " + result.before.prepared + " propuestas, " + result.before.blocked + " bloqueados, " + result.before.reviewing + " revisiones, " + result.before.historical + " históricos.",
    "Después: " + result.after.prepared + " propuestas, " + result.after.blocked + " bloqueados, " + result.after.reviewing + " revisiones, " + result.after.historical + " históricos.",
    "Cambio de propuestas: " + formatDelta(result.delta.prepared),
    "Cambio de bloqueos: " + formatDelta(result.delta.blocked),
    "Cambio de revisiones humanas: " + formatDelta(result.delta.reviewing),
    "Decisiones distintas: " + result.changed,
    ...result.transitions.map(item => item.description),
    "Acciones ejecutadas fuera del navegador: 0",
    result.rule,
    result.limitation
  ].join("\n");
}
