export const DECISION_CERTIFICATE_CONTROL_VERSION = "33.0";

export const DECISION_CERTIFICATE_CONTROL_STATUS = Object.freeze({
  READY: "READY",
  VALID: "VALID",
  INVALID: "INVALID",
  UNTRUSTED: "UNTRUSTED",
  REPLAY_MISMATCH: "REPLAY_MISMATCH",
  EQUIVOCATION: "EQUIVOCATION",
  INCOMPLETE: "INCOMPLETE",
  MALFORMED: "MALFORMED"
});

const TERMINAL_FAILURES = new Set([
  DECISION_CERTIFICATE_CONTROL_STATUS.INVALID,
  DECISION_CERTIFICATE_CONTROL_STATUS.UNTRUSTED,
  DECISION_CERTIFICATE_CONTROL_STATUS.REPLAY_MISMATCH,
  DECISION_CERTIFICATE_CONTROL_STATUS.EQUIVOCATION,
  DECISION_CERTIFICATE_CONTROL_STATUS.MALFORMED
]);

export function normalizeDecisionCertificateControl(result = {}) {
  const valid = result.valid === true;

  let status = result.status ?? null;

  if (!status && valid) {
    status = DECISION_CERTIFICATE_CONTROL_STATUS.VALID;
  }

  if (!status) {
    status = DECISION_CERTIFICATE_CONTROL_STATUS.INCOMPLETE;
  }

  return Object.freeze({
    version: DECISION_CERTIFICATE_CONTROL_VERSION,
    valid,
    status,
    fingerprint: result.certificateFingerprint ?? null,
    failures: Array.isArray(result.failures) ? result.failures : [],
    terminal: TERMINAL_FAILURES.has(status),
    ready: status !== DECISION_CERTIFICATE_CONTROL_STATUS.INCOMPLETE
  });
}

export function decisionCertificateBadge(result = {}) {
  const normalized = normalizeDecisionCertificateControl(result);

  return {
    label: normalized.status,
    severity:
      normalized.status === DECISION_CERTIFICATE_CONTROL_STATUS.VALID
        ? "success"
        : normalized.terminal
          ? "danger"
          : "warning"
  };
}

export function decisionCertificateCanExport(result = {}) {
  return normalizeDecisionCertificateControl(result).valid === true;
}

export function decisionCertificateCanApprove(result = {}) {
  return normalizeDecisionCertificateControl(result).valid === true;
}

export function decisionCertificateControlSnapshot(result = {}) {
  const normalized = normalizeDecisionCertificateControl(result);

  return {
    version: normalized.version,
    valid: normalized.valid,
    status: normalized.status,
    fingerprint: normalized.fingerprint,
    failureCount: normalized.failures.length,
    terminal: normalized.terminal,
    ready: normalized.ready
  };
}
