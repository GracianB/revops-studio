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
    contractVersion: "16.0",
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

export function createIntegrationContract(envelope, context = {}) {
  const safe = envelope || {};
  const payload = {
    envelopeId: safe.envelopeId || null,
    leadId: safe.payload?.leadId || null,
    transition: safe.payload?.transition || { from: null, to: null },
    action: safe.payload?.action || null,
    runId: safe.payload?.runId || null,
    mode: "SIMULATION_ONLY"
  };
  const idempotencyKey = "IDEMP-" + hashEnvelope(payload).toUpperCase();

  return Object.freeze({
    contractVersion: "16.0",
    contractType: "REVOPS_EXECUTION_CONTRACT",
    idempotencyKey,
    envelopeId: safe.envelopeId || null,
    operation: "PROPOSE_STAGE_TRANSITION",
    dryRun: true,
    canExecute: false,
    adapter: "CRM_PLACEHOLDER",
    endpoint: null,
    authRequired: false,
    timeoutMs: Number.isFinite(Number(context.timeoutMs)) ? Number(context.timeoutMs) : 5000,
    payload,
    invariants: Object.freeze({
      externalCalls: 0,
      state: "NOT_EXECUTED",
      mode: "SIMULATION_ONLY"
    })
  });
}

export function validateIntegrationContract(contract) {
  const required = [
    contract?.contractVersion === "16.0",
    contract?.contractType === "REVOPS_EXECUTION_CONTRACT",
    contract?.dryRun === true,
    contract?.canExecute === false,
    contract?.adapter === "CRM_PLACEHOLDER",
    contract?.endpoint === null,
    contract?.invariants?.externalCalls === 0,
    contract?.invariants?.state === "NOT_EXECUTED",
    contract?.invariants?.mode === "SIMULATION_ONLY",
    Boolean(String(contract?.idempotencyKey || "").trim())
  ];
  return {
    valid: required.every(Boolean),
    checks: {
      version: required[0],
      type: required[1],
      dryRun: required[2],
      canExecute: required[3],
      adapter: required[4],
      endpoint: required[5],
      noExternalCalls: required[6],
      state: required[7],
      mode: required[8],
      idempotencyKey: required[9]
    }
  };
}

export const EXECUTION_ADAPTER_STATUS = ADAPTER_STATUS;
