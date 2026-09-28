# Proposal: Production Validation Gate

## Intent

Add deterministic production-validation gate that proves WAM's critical execution-control invariants before release.

## Scope

Gate covers:
- real execution-to-assessment lineage;
- false-success prevention;
- browser-runtime failure diagnosis;
- inconclusive observations;
- repetitive strategy detection;
- restart/crash recovery;
- duplicate-event idempotency;
- concurrent-session isolation;
- secret redaction;
- corrupted-state handling.

Gate must run against clean installation and fail closed when production invariant is violated.

## Non-goals

- No new agent strategy or product capability.
- No broad refactor of cognition/execution architecture.
- No performance optimization beyond recording regression measurements.