# Design: implement-prompt-eval-execution

## Context

`benchmarks/quality/prompt-eval/` currently freezes prompts and writes run
records, but `runEvaluation` never calls the evaluator. A real `core` run
produces `metrics: {}` and `details: []`, and `prompts:report` crashes on the
real run-record shape (`report.mjs` expects `labels: [string]` + a top-level
`scenarios`, neither of which the record has). The evaluator itself
(`deterministic.mjs`) only exposes `evaluateCriterion(criterion, output)`.

Constraints (from the review that motivated this change):

- Deterministic and offline: no network, no API keys, reproducible in CI.
- Live-model runs stay separate; only recorded outputs are evaluated here.
- No second prompt catalog, no new release gate, no duplicated infra.
- Token savings must never compensate a critical regression.

## Goals / Non-Goals

**Goals:**

- Execute every scenario against recorded outputs and compute `metrics` +
  `details` from real criterion results.
- Distinguish pass / fail / not-evaluable / no-evidence explicitly.
- Make `REGRESSION`/`IMPROVED` provable: no `IMPROVED` without data.
- Keep the run core byte-identical across repeats.

**Non-Goals:**

- No change to prompt content (`verify`, `scope`, `simplify`, `delegation`).
- No live model provider in CI.
- No semantic LLM grading (that is change 02, `strengthen-prompt-behavior-oracles`).

## Decisions

- **Recorded outputs as first-class fixtures.** Add
  `benchmarks/quality/prompt-eval/outputs/<label>__<suite>.json` mapping
  `scenarioId -> response string`. Rationale: keeps evaluation deterministic
  and offline; a live capture step can later write the same shape. Alternative
  considered: pass outputs inline in suites — rejected, couples data to spec.

- **`evaluateScenario(scenario, output)` aggregation.** Returns
  `{ scenarioId, severity, passed, evaluable, criteria[] }`. `passed` requires
  all required criteria to pass and no `must-not` violation; missing/empty
  output ⇒ `evaluable: false` for every criterion. Rationale: single source for
  per-scenario truth. Alternative: compute in `run.mjs` — rejected, hides logic.

- **`runEvaluation` takes `outputs` per label.** Signature gains an
  `outputsByLabel: Record<label, Record<scenarioId, string>>`. It evaluates the
  aggregate suite minus hashing-only concerns and writes `metrics` + `details`.
  Rationale: metrics must come from execution, not from pre-baked numbers.

- **Decision guards in `decision.mjs`.** `INCONCLUSIVE` when
  `evaluableCount === 0` or details are absent; `IMPROVED` additionally requires
  `criticalRegressions === 0` and a target improvement. Rationale: enforces the
  acceptance matrix; a savings-only delta can never promote.

- **Report consumes the real run record.** `renderMarkdownReport` must read
  `run.labels[*]` (objects) and per-label `details`; `report.test.mjs` is
  rewritten to the real shape so the CLI stops crashing.

## Risks / Trade-offs

- [Recorded outputs go stale vs live behavior] → Document that fixtures must be
  regenerated on prompt changes; hashes in the run record pin what was evaluated.
- [Literal matching still weakens behavioral fidelity] → Out of scope here;
  change 02 replaces literal checks with per-behavior oracles.
- [Adding `outputs` changes the run-record shape] → Determinism preserved (no
  timestamps); `serializeReport` output stays byte-stable for identical inputs.
- [Empty fixtures accidentally green] → `PQ-EXEC-03` asserts missing/empty ⇒
  not-evaluable and never `IMPROVED`.

## Migration Plan

Additive: existing runs without outputs become `INCONCLUSIVE`, which is the
correct fail-closed behavior. Rollback = revert the `run.mjs` wiring; fixtures
are inert data.

## Open Questions

- Should token counts live in `metrics` (per label) for `PQ-EXEC-05`, or be
  supplied alongside outputs? Default: optional `tokenUsage` in the label input,
  recorded in `metrics` when present, never used to offset regressions.
