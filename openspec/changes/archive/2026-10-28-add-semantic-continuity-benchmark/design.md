## Context

The semantic projection (`src/context/semantic-projection.js`) is wired into
`buildContextBrief` whenever a root is supplied and either an execution ledger
or a canonical base exists. Nothing currently proves that it preserves more
execution continuity than the legacy brief, nor that it does so inside the
same budget once recovery of omitted detail is counted.

## Research

- W3C PROV-DM — provenance entities/activities/agents give the vocabulary for
  "which requirement, which evidence, which decision version":
  https://www.w3.org/TR/prov-dm/
- Event sourcing (Fowler) — the ledger is an append-only event log and every
  projection is a deterministic fold over it:
  https://martinfowler.com/eaaDev/EventSourcing.html
- LLM-as-judge benchmark methodology — shows judge-based evaluation is useful
  but noisy, position-sensitive and expensive:
  https://arxiv.org/abs/2306.05685

## Goals / Non-Goals

- Goal: a readable, reproducible benchmark that fails when the projection loses
  a required continuity property, exceeds the budget including recovery, or
  leaks state between tasks.
- Non-goal: scoring prose quality, measuring model comprehension, or replacing
  the existing curation benchmark.

## Decisions

### Chosen: deterministic fixture benchmark over the real modules

The benchmark seeds a temp `.wam` through the production modules (execution
ledger events, canonical deltas, retention planning, task hierarchy) and scores
eight boolean continuity probes that both systems answer identically. Totals
are computed as `brief tokens + estimateTokens(stored detail for refs loaded)`.
Determinism wins here because the properties under test are structural: a
verified id is present or it is not, a superseded decision is absent or it is
not. A deterministic check has no sampling variance, runs in milliseconds, and
can gate CI.

### Rejected A: token-count-only benchmark

Counting tokens is already what the curation benchmark does. It rewards
dropping the pending obligation or the evidence ref, which is exactly the
regression this phase must catch. Rejected because it cannot distinguish a
small, lossy brief from a small, complete one.

### Rejected B: live-model evaluation with an LLM judge

An LLM judge would measure whether a model can still answer follow-up questions,
which is closer to the real consumer. Rejected for this phase because it adds
network and model dependencies, nondeterministic scores, cost, and judge
position bias (arXiv 2306.05685). It also cannot be run offline in the release
gate. A judge can be layered on top later; the deterministic probe set remains
the contract.

## Risks / Trade-offs

- The probe set is fixed, so a future projection change could satisfy the
  probes while losing another property; the probe list is intentionally small
  and explicit so new properties are added as new probes.
- Fixture text is synthetic; it proves structural continuity, not model
  comprehension.

## Migration Plan

Additive: new benchmark file and npm script. No runtime code changes, no
storage format changes.
