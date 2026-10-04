/**
 * RevOps Studio execution adapter boundary.
 * V17: creates validated execution envelopes but never performs network calls.
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
    contractVersion: "17.0",
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
  if (!envelope || envelope.contractVersion !== "17.0" || envelope.canExecute !== false) {
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
    contractVersion: "17.0",
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
    envelopeValid: safe.valid === true,
    approval: Object.freeze({
      required: safe.approval?.required === true,
      status: normaliseText(safe.approval?.status, "pending")
    }),
    invariants: Object.freeze({
      externalCalls: 0,
      state: "NOT_EXECUTED",
      mode: "SIMULATION_ONLY"
    })
  });
}

export function validateIntegrationContract(contract) {
  const required = [
    contract?.contractVersion === "17.0",
    contract?.contractType === "REVOPS_EXECUTION_CONTRACT",
    contract?.dryRun === true,
    contract?.canExecute === false,
    contract?.envelopeValid === true,
    contract?.adapter === "CRM_PLACEHOLDER",
    contract?.endpoint === null,
    contract?.invariants?.externalCalls === 0,
    contract?.invariants?.state === "NOT_EXECUTED",
    contract?.invariants?.mode === "SIMULATION_ONLY",
    Boolean(String(contract?.idempotencyKey || "").trim()),
    contract?.approval?.required !== true ||
      contract?.approval?.status === "approved"
  ];
  return {
    valid: required.every(Boolean),
    checks: {
      version: required[0],
      type: required[1],
      dryRun: required[2],
      canExecute: required[3],
      envelopeValid: required[4],
      adapter: required[5],
      endpoint: required[6],
      noExternalCalls: required[7],
      state: required[8],
      mode: required[9],
      idempotencyKey: required[10]
    }
  };
}

export function simulateIntegrationContract(contract, context = {}) {
  const validation = validateIntegrationContract(contract);
  if (!validation.valid) {
    return Object.freeze({
      ok: false,
      executed: false,
      state: "REJECTED",
      status: "REJECTED",
      mode: ADAPTER_STATUS.SIMULATION_ONLY,
      externalCalls: 0,
      code: "INVALID_INTEGRATION_CONTRACT",
      validation
    });
  }

  const outcomePayload = {
    idempotencyKey: contract.idempotencyKey,
    envelopeId: contract.envelopeId,
    operation: contract.operation,
    payload: contract.payload
  };
  const outcomeId = "SIM-" + hashEnvelope(outcomePayload).toUpperCase();
  return Object.freeze({
    ok: true,
    executed: false,
    state: "SIMULATED",
    status: "SIMULATED",
    mode: ADAPTER_STATUS.SIMULATION_ONLY,
    adapter: contract.adapter,
    outcomeId,
    envelopeId: contract.envelopeId,
    idempotencyKey: contract.idempotencyKey,
    externalCalls: 0,
    simulatedAt: String(context.at || "").trim() || new Date().toISOString(),
    message: "Simulation completed locally. No external side effects were performed."
  });
}

export function createExecutionEvent(simulation, contract, context = {}) {
  const result = simulation || {};
  const safeContract = contract || {};
  return Object.freeze({
    type: result.ok ? "EXECUTION_SIMULATED" : "EXECUTION_BLOCKED",
    runId: safeContract.payload?.runId || null,
    leadId: safeContract.payload?.leadId || null,
    idempotencyKey: safeContract.idempotencyKey || null,
    actor: String(context.actor || "system").trim() || "system",
    status: result.status || result.state || "REJECTED",
    at: String(context.at || result.simulatedAt || "").trim() || new Date().toISOString(),
    payload: {
      outcomeId: result.outcomeId || null,
      envelopeId: safeContract.envelopeId || null,
      adapter: safeContract.adapter || "CRM_PLACEHOLDER",
      externalCalls: result.externalCalls ?? 0,
      mode: result.mode || ADAPTER_STATUS.SIMULATION_ONLY
    }
  });
}

export const EXECUTION_ADAPTER_STATUS = ADAPTER_STATUS;
