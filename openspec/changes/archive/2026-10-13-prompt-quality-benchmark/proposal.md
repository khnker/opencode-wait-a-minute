# Proposal: Prompt-Quality Benchmark

Establish an independent, deterministic benchmark that evaluates
prompt quality — comparing a **baseline** prompt set against a
**candidate** set and classing each scenario
**IMPROVED | NO_CHANGE | REGRESSION | INCONCLUSIVE**, with traceable
per-scenario, per-criterion, per-severity evidence.

The existing `benchmarks/quality/` harness measures model behavior
(token savings, fact coverage). This change measures the *prompt
artifacts* the recent centralization work produced: whether each
prompt's `verification`/`restrictions` contract is enforceable,
detectable, and comparable across versions.

## Goals
1. Freeze runs: content-hash every prompt so a run is reproducible
   against the exact prompt bytes it used.
2. Compare baseline vs candidate deterministically — no model, no API
   keys, no network — for the deterministic evaluator track.
3. Classify each scenario with severity-weighted, per-criterion
   evidence that survives git review.

## Non-goals (explicit)
- **NO second prompt loader.** Reuse `src/prompts/loader.js`
  (`loadPrompt`, `listPrompts`) and `prompts/index.json` as the only
  source of prompt content.
- **NO duplicate release gate.** This benchmark does not replace or
  re-implement `scripts/release-gate.mjs`; it produces evidence.
- **NO semantic/model evaluation in this change.** Judge/model-driven
  scoring is deferred; the deterministic track must run with zero API
  keys and zero network.

## Acceptance
- `validateSuite`/`validateScenario` reject duplicate scenario ids and
  missing mandatory criteria fields with explicit errors (PQ-001/002).
- Four suites (`verify`, `scope`, `simplify`, `delegation`) with the
  five required scenarios exist, each with severity + must/must-not
  criteria.
- Snapshot detects prompt content changes (PQ-003) and freezes content
  so later comparisons ignore live file edits (PQ-004).
- The deterministic evaluation path runs to completion with no API keys
  and no network (PQ-INT-05).
- `prompts:check` still passes; serialized run cores are byte-identical
  across repeats.
