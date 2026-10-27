# Design: Harden runtime foundations

## Decision 1 — explicit instructions never wait on inferred assumptions

**Chosen:** a deterministic `isExplicitInstruction(text)` predicate in
`src/policy/uncertainty.js`, consumed by `auditAssumptions`,
`escalateAssumptions` and the ASKING gate in `message-handler`.

Rule: explicit = `[router]` prefix, or (a file path present AND (an actionable
plan of ≥2 lines OR ≥200 chars)). Router dispatches additionally bypass ASKING
outright, because the orchestrator already supplied the plan.

**Alternatives rejected**
- *LLM classifier per message*: non-deterministic, adds latency and a model
  dependency to a gate that must run offline.
- *Raise the `ASKING` threshold / drop the gate*: loses the real protection for
  vague requests ("agregá algo"), which remains covered by a regression test.
- *Only special-case `[router]`*: leaves long user specs (the `>2000` branch)
  producing the same fabricated contract.

**Gate-1 contract synthesis** now extracts real requirements with
`extractContract` + `contractToRequirements` before falling back to the generic
requirement, and caps the result with `MAX_CONTRACT_REQUIREMENTS`. The security
requirement uses word-boundary keywords (`auth|oauth|jwt|api[_-]?key|secret|password`)
instead of the substring `token`.

## Decision 2 — coalesce identical measurements at the writer

**Chosen:** `recordTokenSavings` folds a new measurement into the newest record
when `taskId`, `actualTokens`, `baselineTokens`, `baselineSource` and
`usageSource` match and the gap is within `WAM_METRICS_DEDUPE_MS` (default 60 s).
The row keeps `firstAt`/`lastAt` and counts `occurrences`.

**Alternatives rejected**
- *Read-time dedupe*: the file keeps growing and the retention window still
  discards real measurements to make room for duplicates.
- *Separate evidence store*: duplicates are a write-path bug; a second store
  would duplicate state without fixing retention (YAGNI).
- *Drop the metric*: loses the sign of `deltaTokens`, which is the only signal
  available while baselines stay synthetic.

`summarizeTokenSavings` was added so reports never mix claimable savings with
synthetic deltas.

## References
- OpenTelemetry Logs Data Model (timestamp + observed timestamp, event counts):
  https://opentelemetry.io/docs/specs/otel/logs/data-model/
- Google SRE Workbook — Monitoring Distributed Systems (aggregation and
  duplicate suppression at the collector):
  https://sre.google/workbook/monitoring-distributed-systems/
- OWASP Logging Cheat Sheet (record only actionable events, avoid noise):
  https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
