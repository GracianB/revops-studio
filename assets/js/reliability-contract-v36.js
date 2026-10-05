export const RELIABILITY_CONTRACT_VERSION = "36.0";

export const RELIABILITY_LIMITS = Object.freeze({
  maxVerificationMs: 5000,
  maxExportMs: 3000,
  maxPayloadBytes: 5000000
});

export function measureOperation(operation) {
  const started = performance.now();

  try {
    const value = operation();

    return {
      ok: true,
      value,
      durationMs: performance.now() - started
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      durationMs: performance.now() - started,
      error: error instanceof Error
        ? error.message
        : String(error)
    };
  }
}

export function evaluateReliabilityBudget(
  {
    verificationMs = 0,
    exportMs = 0,
    payloadBytes = 0
  } = {},
  limits = RELIABILITY_LIMITS
) {
  const failures = [];

  if (verificationMs > limits.maxVerificationMs) {
    failures.push("VERIFICATION_TIME_LIMIT");
  }

  if (exportMs > limits.maxExportMs) {
    failures.push("EXPORT_TIME_LIMIT");
  }

  if (payloadBytes > limits.maxPayloadBytes) {
    failures.push("PAYLOAD_SIZE_LIMIT");
  }

  return {
    valid: failures.length === 0,
    failures,
    limits
  };
}
