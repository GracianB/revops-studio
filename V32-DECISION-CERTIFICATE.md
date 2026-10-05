# V32 — Decision Certificate

V32 is the final proof envelope over the existing RevOps Studio trust chain.

## Architecture

DATA → POLICY → REPLAY → EVIDENCE → SIGNATURE → TRUST → QUORUM → TRANSPARENCY → WITNESSES → DECISION CERTIFICATE

V32 does not reimplement V26–V31 verification. It orchestrates the production modules already shipped in the mainline:

- V26 evidence lineage
- V27 cryptographic evidence signature
- V28 trusted signer registry
- V29 trusted root
- V30 trust-fabric quorum
- V31 append-only transparency and witnesses

## Certificate contract

A V32 certificate contains the signed evidence bundle, the V30 trust-fabric checkpoint, the V31 transparency log, the current-head witness quorum, decision metadata and a deterministic DC32 fingerprint.

The certificate is valid only when all referenced layers verify and the latest V31 checkpoint equals the V30 checkpoint carried by the certificate.

## Security properties

- deterministic canonical representation
- SHA-256 DC32-* certificate fingerprint
- embedded fingerprint verification
- dataset-scope binding
- trust-fabric checkpoint binding
- transparency-head binding
- current-head witness quorum
- fail-closed structured status
- portable JSON export/import
- no private-key persistence
- no external authority is fabricated by the browser

## Expected statuses

- CERTIFICATE_VALID
- CERTIFICATE_INVALID
- CERTIFICATE_MALFORMED
- CERTIFICATE_INCOMPLETE
- CERTIFICATE_UNTRUSTED
- CERTIFICATE_REPLAY_MISMATCH
- CERTIFICATE_EQUIVOCATION
