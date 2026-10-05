import {
  POLICY_CONTRACT_VERSION,
  activePolicy,
  buildPolicyDecisionLineage,
  buildPolicyLineageFingerprint,
  buildPolicyProposalFingerprint,
  verifyActivePolicy,
  verifyPolicyLedger,
  verifyPolicyProposal
} from "./policy-engine.js";

export const POLICY_EVIDENCE_VERSION = "26.0";
export const POLICY_EVIDENCE_SCHEMA = "revops-policy-evidence";

const stableHash = (value) => {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const isoTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const safeClone = (value, fallback = null) => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
};

const canonicalProposal = (proposal = null) => {
  if (!proposal || typeof proposal !== "object") return null;
  return {
    proposalId: proposal.proposalId || null,
    status: proposal.status || null,
    contractVersion: proposal.contractVersion || null,
    datasetFingerprint: proposal.datasetFingerprint || null,
    runId: proposal.runId || null,
    records: Number.isFinite(Number(proposal.records)) ? Number(proposal.records) : null,
    multiplier: proposal.multiplier ?? null,
    improvement: proposal.improvement ?? null,
    replayFingerprint: proposal.replayFingerprint || null,
    rowsFingerprint: proposal.rowsFingerprint || null,
    proposalFingerprint: proposal.proposalFingerprint || null,
    lineageFingerprint: proposal.lineageFingerprint || null
  };
};

const canonicalActive = (active = null) => {
  if (!active || typeof active !== "object") return null;
  return {
    decisionId: active.decisionId || null,
    policyId: active.policyId || null,
    proposalId: active.proposalId || null,
    datasetFingerprint: active.datasetFingerprint || null,
    multiplier: active.multiplier ?? null,
    runId: active.runId || null,
    actor: active.actor || null,
    rationale: active.rationale || null,
    rowsFingerprint: active.rowsFingerprint || null,
    replayFingerprint: active.replayFingerprint || null,
    lineageFingerprint: active.lineageFingerprint || null
  };
};

const buildManifest = ({
  datasetFingerprint,
  proposal = null,
  ledger = [],
  active = null,
  observationMode = "FINGERPRINT_ONLY"
} = {}) => ({
  schema: POLICY_EVIDENCE_SCHEMA,
  evidenceVersion: POLICY_EVIDENCE_VERSION,
  policyContractVersion: POLICY_CONTRACT_VERSION,
  datasetFingerprint: datasetFingerprint || null,
  observationMode,
  proposal: canonicalProposal(proposal),
  proposalLineage: proposal ? buildPolicyDecisionLineage({ proposal }) : null,
  active: canonicalActive(active),
  ledgerEventCount: Array.isArray(ledger) ? ledger.length : 0
});

export const buildPolicyEvidenceManifest = (options = {}) =>
  Object.freeze(buildManifest(options));

export function buildPolicyEvidenceBundle({
  datasetFingerprint = null,
  proposal = null,
  ledger = [],
  rows = null,
  exportedAt = new Date().toISOString()
} = {}) {
  const scope = datasetFingerprint ? String(datasetFingerprint) : null;
  if (!scope) {
    return { valid: false, reason: "DATASET_FINGERPRINT_REQUIRED" };
  }
  if (!Array.isArray(ledger)) {
    return { valid: false, reason: "LEDGER_INVALID" };
  }

  const active = activePolicy(ledger, scope);
  const observationMode = rows === null ? "FINGERPRINT_ONLY" : "OBSERVED_ROWS";
  const manifest = buildManifest({
    datasetFingerprint: scope,
    proposal,
    ledger,
    active,
    observationMode
  });
  const manifestFingerprint = "E26-" + stableHash(JSON.stringify(manifest));

  const bundle = {
    schema: POLICY_EVIDENCE_SCHEMA,
    evidenceVersion: POLICY_EVIDENCE_VERSION,
    policyContractVersion: POLICY_CONTRACT_VERSION,
    exportedAt: isoTime(exportedAt) || new Date(0).toISOString(),
    datasetFingerprint: scope,
    manifest,
    manifestFingerprint,
    proposal: safeClone(proposal),
    ledger: safeClone(ledger, [])
  };

  const verification = verifyPolicyEvidenceBundle(bundle, { rows });
  return Object.freeze({
    ...bundle,
    valid: verification.valid,
    reason: verification.reason,
    verification: Object.freeze({
      ...verification,
      exportedObservationMode: observationMode
    })
  });
}

export function verifyPolicyEvidenceBundle(
  bundle = null,
  { rows = null, datasetFingerprint = null } = {}
) {
  if (!bundle || typeof bundle !== "object") {
    return { valid: false, reason: "EVIDENCE_BUNDLE_INVALID" };
  }
  if (bundle.schema !== POLICY_EVIDENCE_SCHEMA) {
    return { valid: false, reason: "EVIDENCE_SCHEMA_MISMATCH" };
  }
  if (bundle.evidenceVersion !== POLICY_EVIDENCE_VERSION) {
    return { valid: false, reason: "EVIDENCE_VERSION_MISMATCH" };
  }
  if (bundle.policyContractVersion !== POLICY_CONTRACT_VERSION) {
    return { valid: false, reason: "POLICY_CONTRACT_MISMATCH" };
  }

  const scope = datasetFingerprint
    ? String(datasetFingerprint)
    : (bundle.datasetFingerprint ? String(bundle.datasetFingerprint) : null);
  if (!scope) return { valid: false, reason: "DATASET_FINGERPRINT_REQUIRED" };
  if (bundle.datasetFingerprint !== scope) {
    return { valid: false, reason: "DATASET_SCOPE_MISMATCH" };
  }
  if (!Array.isArray(bundle.ledger)) {
    return { valid: false, reason: "LEDGER_INVALID" };
  }

  const derivedActive = activePolicy(bundle.ledger, scope);
  const expectedManifest = buildManifest({
    datasetFingerprint: scope,
    proposal: bundle.proposal,
    ledger: bundle.ledger,
    active: derivedActive,
    observationMode: bundle.manifest?.observationMode || "FINGERPRINT_ONLY"
  });

  if (JSON.stringify(bundle.manifest) !== JSON.stringify(expectedManifest)) {
    return { valid: false, reason: "MANIFEST_MISMATCH" };
  }

  const expectedManifestFingerprint = "E26-" + stableHash(JSON.stringify(expectedManifest));
  if (bundle.manifestFingerprint !== expectedManifestFingerprint) {
    return { valid: false, reason: "MANIFEST_FINGERPRINT_MISMATCH" };
  }

  const proposalResult = !bundle.proposal
    ? { valid: true, reason: "NO_PROPOSAL" }
    : bundle.proposal.replay
      ? verifyPolicyProposal(bundle.proposal, { rows })
      : { valid: true, reason: "PROPOSAL_BLOCKED_NO_REPLAY" };

  const ledgerResult = verifyPolicyLedger(bundle.ledger, {
    datasetFingerprint: scope
  });

  if (!ledgerResult.valid) {
    return {
      valid: false,
      reason: ledgerResult.reason,
      proposal: proposalResult.reason,
      ledger: ledgerResult.reason,
      active: derivedActive?.policyId || null
    };
  }

  const activeResult = derivedActive
    ? verifyActivePolicy(derivedActive, {
        rows,
        datasetFingerprint: scope
      })
    : { valid: true, reason: "NO_ACTIVE_POLICY" };

  if (derivedActive && !activeResult.valid) {
    return {
      valid: false,
      reason: activeResult.reason,
      proposal: proposalResult.reason,
      ledger: ledgerResult.reason,
      active: activeResult.reason
    };
  }

  if (!proposalResult.valid) {
    return {
      valid: false,
      reason: proposalResult.reason,
      proposal: proposalResult.reason,
      ledger: ledgerResult.reason,
      active: activeResult.reason
    };
  }

  if (bundle.manifest.active?.policyId !== (derivedActive?.policyId || null) ||
      bundle.manifest.active?.decisionId !== (derivedActive?.decisionId || null)) {
    return { valid: false, reason: "ACTIVE_MANIFEST_MISMATCH" };
  }

  if (bundle.manifest.ledgerEventCount !== bundle.ledger.length) {
    return { valid: false, reason: "LEDGER_COUNT_MISMATCH" };
  }

  return {
    valid: true,
    reason: rows === null ? "EVIDENCE_VERIFIED_FINGERPRINT_ONLY" : "EVIDENCE_VERIFIED_WITH_ROWS",
    proposal: proposalResult.reason,
    ledger: ledgerResult.reason,
    active: activeResult.reason,
    manifestFingerprint: bundle.manifestFingerprint,
    datasetFingerprint: scope,
    activePolicyId: derivedActive?.policyId || null
  };
}

export function serialisePolicyEvidenceBundle(bundle = null) {
  if (!bundle || typeof bundle !== "object") return null;
  return JSON.stringify(bundle, null, 2);
}

export function buildPolicyEvidenceDecisionLineage({ proposal = null, active = null } = {}) {
  return buildPolicyDecisionLineage({
    proposal,
    decisionEvent: active
  });
}

export function verifyPolicyEvidenceLineage(bundle = null, options = {}) {
  const result = verifyPolicyEvidenceBundle(bundle, options);
  if (!result.valid) return result;
  const active = bundle?.ledger && bundle?.datasetFingerprint
    ? activePolicy(bundle.ledger, bundle.datasetFingerprint)
    : null;
  if (!active) return result;
  const expected = buildPolicyLineageFingerprint(buildPolicyDecisionLineage({ decisionEvent: active }));
  return active.lineageFingerprint === expected
    ? result
    : { ...result, valid: false, reason: "ACTIVE_LINEAGE_MISMATCH" };
}
