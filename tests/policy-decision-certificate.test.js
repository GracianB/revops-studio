import test from "node:test";
import assert from "node:assert/strict";

import {
  generatePolicyEvidenceKeyPair,
  signPolicyEvidenceBundle
} from "../assets/js/policy-evidence-signing.js";

import {
  buildRecalibrationProposal,
  decidePolicy
} from "../assets/js/policy-engine.js";

import {
  buildPolicyEvidenceBundle
} from "../assets/js/policy-evidence.js";

import {
  generateTrustFabricKeySet,
  createTrustFabric,
  signTrustFabricCheckpoint
} from "../assets/js/policy-trust-fabric.js";

import {
  createTrustRegistry,
  registerTrustedSigner
} from "../assets/js/policy-trust-registry.js";

import {
  createTransparencyLog,
  appendTransparencyCheckpoint,
  generateTransparencyWitnessKeyPair,
  signTransparencyWitnessAttestation
} from "../assets/js/policy-transparency.js";

import {
  buildDecisionCertificate,
  verifyDecisionCertificate,
  fingerprintDecisionCertificate,
  exportDecisionCertificate,
  importDecisionCertificate
} from "../assets/js/policy-decision-certificate.js";

const now = "2026-10-05T00:00:00.000Z";

function report() {
  return {
    severity: "CRITICAL",

    global: {
      severity: "CRITICAL",
      sampleSufficient: true
    },

    recommendations: [
      {
        code:
          "CONTROLLED_RECALIBRATION"
      }
    ]
  };
}

function rows() {
  return Array.from(
    { length: 10 },
    (_, index) => ({
      leadId:
        "L" + index,

      probability:
        0.9,

      observedSuccess:
        index < 2
          ? 1
          : 0
    })
  );
}

async function fixture() {

  const observed =
    rows();

  const datasetFingerprint =
    "ds-v32";

  const proposal =
    buildRecalibrationProposal({
      report:
        report(),

      rows:
        observed,

      datasetFingerprint,

      runId:
        "run-v32",

      now
    });

  assert.equal(
    proposal.valid,
    true,
    proposal.reason
  );

  const decision =
    decidePolicy({
      proposal,

      decision:
        "APPROVE",

      actor:
        "gracian-local",

      reason:
        "V32 integration test",

      datasetFingerprint,

      rows:
        observed,

      now
    });

  const evidenceKeys =
    await generatePolicyEvidenceKeyPair();

  const evidenceBundle =
    buildPolicyEvidenceBundle({
      datasetFingerprint,

      proposal,

      ledger:
        decision.ledger,

      rows:
        observed,

      exportedAt:
        now
    });

  assert.equal(
    evidenceBundle.valid,
    true,
    evidenceBundle.reason
  );

  const signedEvidence =
    await signPolicyEvidenceBundle(
      evidenceBundle,
      {
        privateKey:
          evidenceKeys.privateKey,

        publicKeyJwk:
          evidenceKeys.publicKeyJwk
      }
    );

  assert.equal(
    signedEvidence.valid,
    true,
    signedEvidence.reason
  );

  const rootKeys =
    await generateTrustFabricKeySet(
      3
    );

  const fabric =
    await createTrustFabric({
      rootPublicKeys:
        rootKeys.map(
          (key) =>
            key.publicKeyJwk
        ),

      threshold:
        2
    });

  assert.equal(
    fabric.valid,
    true,
    fabric.reason
  );

  const registry =
    await registerTrustedSigner(
      createTrustRegistry(),
      {
        publicKeyJwk:
          evidenceKeys.publicKeyJwk,

        effectiveAt:
          now,

        actor:
          "security-owner",

        rationale:
          "V32 certificate integration",

        createdAt:
          now
      }
    );

  assert.equal(
    registry.accepted,
    true,
    registry.reason
  );

  const checkpoint =
    await signTrustFabricCheckpoint(
      registry.registry,
      {
        fabric,

        rootSigners:
          rootKeys,

        actor:
          "security-owner",

        rationale:
          "V32 decision certificate",

        signedAt:
          now
      }
    );

  assert.equal(
    checkpoint.valid,
    true,
    checkpoint.reason
  );

  let log =
    createTransparencyLog();

  const appended =
    await appendTransparencyCheckpoint(
      log,

      checkpoint.snapshot,

      {
        observedAt:
          now
      }
    );

  assert.equal(
    appended.valid,
    true,
    appended.reason
  );

  log =
    appended.log;

  const witness =
    await generateTransparencyWitnessKeyPair();

  const attestation =
    await signTransparencyWitnessAttestation(
      log.entries.at(-1),
      {
        privateKey:
          witness.privateKey,

        publicKeyJwk:
          witness.publicKeyJwk,

        witnessId:
          witness.witnessFingerprint,

        observedAt:
          now
      }
    );

  assert.equal(
    attestation.valid,
    true,
    attestation.reason
  );

  log =
    Object.freeze({
      ...log,

      witnesses: [
        ...log.witnesses,
        attestation.attestation
      ]
    });

  const built =
    await buildDecisionCertificate({
      certificateId:
        "DC32-INTEGRATION",

      issuedAt:
        now,

      signedEvidenceBundle:
        signedEvidence.bundle,

      trustFabricCheckpoint:
        checkpoint.snapshot,

      transparencyLog:
        log,

      minWitnesses:
        1
    });

  assert.equal(
    built.valid,
    true,
    built.reason
  );

  return {
    certificate:
      built.certificate,

    observed
  };
}

test(
  "V32 builds over the real V26-V31 chain",
  async () => {

    const {
      certificate
    } =
      await fixture();

    assert.equal(
      certificate.schema,
      "revops-policy-decision-certificate"
    );

    assert.equal(
      certificate.certificateVersion,
      "32.0"
    );

    assert.match(
      certificate.certificateFingerprint,
      /^DC32-[A-Za-z0-9_-]{43,44}$/
    );
  }
);

test(
  "V32 fingerprint excludes embedded fingerprint",
  async () => {

    const {
      certificate
    } =
      await fixture();

    assert.equal(
      await fingerprintDecisionCertificate(
        certificate
      ),
      certificate.certificateFingerprint
    );
  }
);

test(
  "V32 verifies the integrated certificate",
  async () => {

    const {
      certificate,
      observed
    } =
      await fixture();

    const result =
      await verifyDecisionCertificate(
        certificate,
        {
          rows:
            observed
        }
      );

    assert.equal(
      result.valid,
      true,
      JSON.stringify(
        result.failures
      )
    );

    assert.equal(
      result.status,
      "CERTIFICATE_VALID"
    );

    assert.equal(
      result.components
        .evidenceValid,
      true
    );

    assert.equal(
      result.components
        .signatureValid,
      true
    );

    assert.equal(
      result.components
        .trustValid,
      true
    );

    assert.equal(
      result.components
        .transparencyValid,
      true
    );

    assert.equal(
      result.components
        .headWitnessesValid,
      true
    );
  }
);

test(
  "V32 detects certificate tampering",
  async () => {

    const {
      certificate
    } =
      await fixture();

    const tampered =
      structuredClone(
        certificate
      );

    tampered.decision.status =
      "BLOCKED";

    const result =
      await verifyDecisionCertificate(
        tampered
      );

    assert.equal(
      result.valid,
      false
    );

    assert.ok(
      result.failures.some(
        (item) =>
          item.code ===
          "CERTIFICATE_FINGERPRINT_EMBEDDED_MISMATCH"
      )
    );
  }
);

test(
  "V32 detects trust checkpoint substitution",
  async () => {

    const {
      certificate
    } =
      await fixture();

    const tampered =
      structuredClone(
        certificate
      );

    tampered.trust
      .checkpoint
      .checkpointFingerprint =
      "CP30-FAKE";

    const result =
      await verifyDecisionCertificate(
        tampered
      );

    assert.equal(
      result.valid,
      false
    );

    assert.ok(
      result.failures.some(
        (item) =>
          item.code ===
            "TRUST_INVALID" ||
          item.code ===
            "TRANSPARENCY_CHECKPOINT_MISMATCH"
      )
    );
  }
);

test(
  "V32 detects transparency checkpoint substitution",
  async () => {

    const {
      certificate
    } =
      await fixture();

    const tampered =
      structuredClone(
        certificate
      );

    tampered.transparency
      .latestCheckpointFingerprint =
      "CP30-FAKE";

    const result =
      await verifyDecisionCertificate(
        tampered
      );

    assert.equal(
      result.valid,
      false
    );
  }
);

test(
  "V32 requires witnesses on the current transparency head",
  async () => {

    const {
      certificate
    } =
      await fixture();

    const tampered =
      structuredClone(
        certificate
      );

    tampered.transparency
      .log
      .witnesses = [];

    const result =
      await verifyDecisionCertificate(
        tampered
      );

    assert.equal(
      result.valid,
      false
    );

    assert.equal(
      result.status,
      "CERTIFICATE_UNTRUSTED"
    );
  }
);

test(
  "V32 export and import remain verifiable",
  async () => {

    const {
      certificate
    } =
      await fixture();

    const exported =
      await exportDecisionCertificate(
        certificate
      );

    assert.equal(
      exported.valid,
      true,
      exported.reason
    );

    const imported =
      await importDecisionCertificate(
        exported.json
      );

    assert.equal(
      imported.valid,
      true,
      imported.reason
    );

    assert.equal(
      imported.certificate
        .certificateFingerprint,

      certificate.certificateFingerprint
    );
  }
);
