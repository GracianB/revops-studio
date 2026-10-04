/**
 * RevOps Studio execution adapter boundary.
 * V15: creates validated execution envelopes but never performs network calls.
 */

const ADAPTER_STATUS = Object.freeze({
  NOT_CONNECTED: "NOT_CONNECTED",
  SIMULATION_ONLY: "SIMULATION_ONLY"
});

function normaliseText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function hashEnvelope(value) {
  const json = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < json.length; i += 1) {
    hash ^= json.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createExecutionEnvelope(trace, context = {}) {
  const safeTrace = trace || {};
  const leadId = normaliseText(safeTrace.input?.id);
  const from = normaliseText(safeTrace.proposal?.from, "blocked");
  const to = safeTrace.proposal?.to ? normaliseText(safeTrace.proposal.to) : null;
  const approvalRequired = safeTrace.approval?.required === true;
  const approvalStatus = normaliseText(
    context.approvalStatus,
    normaliseText(safeTrace.approval?.status, "pending")
  );
  const blocked = safeTrace.decision?.stage === "blocked";
  const actionable = Boolean(to);
  const valid = Boolean(leadId) &&
    Boolean(from) &&
    actionable &&
    !blocked &&
    (!approvalRequired || approvalStatus === "approved");

  const payload = {
    leadId,
    transition: { from, to },
    action: normaliseText(safeTrace.proposal?.action, "No action"),
    lane: normaliseText(safeTrace.proposal?.lane, "RevOps"),
    priority: normaliseText(safeTrace.proposal?.priority, "critical"),
    runId: safeTrace.runId || null
  };

  return Object.freeze({
    contractVersion: "15.0",
    envelopeId: "ENV-" + hashEnvelope(payload).toUpperCase(),
    adapter: "CRM_PLACEHOLDER",
    status: ADAPTER_STATUS.NOT_CONNECTED,
    mode: ADAPTER_STATUS.SIMULATION_ONLY,
    canExecute: false,
    valid,
    approval: {
      required: approvalRequired,
      status: approvalStatus
    },
    payload
  });
}

export function simulateExecution(envelope) {
  if (!envelope || envelope.contractVersion !== "15.0" || envelope.canExecute !== false) {
    return {
      ok: false,
      executed: false,
      state: "REJECTED",
      mode: ADAPTER_STATUS.SIMULATION_ONLY,
      code: "INVALID_EXECUTION_ENVELOPE"
    };
  }

  return {
    ok: false,
    executed: false,
    state: "NOT_EXECUTED",
    mode: ADAPTER_STATUS.SIMULATION_ONLY,
    adapter: envelope.adapter,
    envelopeId: envelope.envelopeId,
    code: "ADAPTER_NOT_CONNECTED",
    message: "Public prototype stops before external execution."
  };
}

export const EXECUTION_ADAPTER_STATUS = ADAPTER_STATUS;
