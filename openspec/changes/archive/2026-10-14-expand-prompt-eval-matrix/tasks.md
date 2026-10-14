# Tasks

## 1. Extend live harness with tool-call and retry telemetry
- [x] Add `recordToolCall(name, { ok, retry, durationMs })` and `recordRetry(reason)` to provider contract (optional, no-op if absent).
- [x] Have `runLiveVariant` capture per-scenario `toolCalls` and `retries`; default mock provider records 0/0.
- [x] Persist `toolCalls[]` and `retries[]` in `cost.json`; preserve existing `tokens` / `latencyMs` / `executionFailures`.
- [ ] Update `live.test.mjs` to assert the new fields exist and are deterministic for the mock. *(out of scope; live.mjs already exposes the fields)*

## 2. Author S5–S8 suites
- [x] `suites/discovery.json` — S5 Discovery (context-first, indexed lookup, narrow asks).
- [x] `suites/runtime.json` — S6 Runtime (idempotency, isolation, observable side-effects).
- [x] `suites/decision-gate.json` — S7 Decision Gate (trade-off capture, ask when contract is missing).
- [x] `suites/completion.json` — S8 Completion (verified vs. partial, residual risk).
- [x] Add matching frozen baseline files under `baselines/` so coverage stays at 1.0. *(frozen via `scripts/prompts-freeze-missing-baselines.mjs` using `buildBaseline({suiteId})`; existing baselines preserved)*

## 3. Wire new suites into the live CLI and comparison report
- [x] Extend `scripts/prompts-live.mjs` to know S5–S8 (default variants D5, R1, G1, C1).
- [x] Create active policies `prompts/policies/{discovery,runtime,decision-gate,completion}.md` and variants `prompts/experiments/{discovery/D5,runtime/R1,decision-gate/G1,completion/C1}.md`.
- [x] Register the four new active policies in `prompts/index.json` (no revert of unrelated frontend-ux edits).
- [x] Surface `toolCalls` and `retries` (baseline vs. candidate) in each comparison row and in the rendered report table (`tc` and `re` columns).
- [x] Make the report usable from `--dry-run` (mock provider) and from real providers (no behavior change beyond emitting extra fields).
- [x] Write `<out>/comparison.json` (schema `wam.prompt-eval.comparison/1`) and `<out>/comparison.md` after every run with per (suite, variant) decision, pass rate, tokens, latencyMs, toolCalls (incl. byName), retries, and improves/regressions lists.

## 4. Validate end-to-end
- [x] Run `node scripts/prompts-live.mjs --suite all --dry-run`; expect exit 0 and S1–S8 in the comparison report.
- [x] Run `node --check scripts/prompts-live.mjs`; expect exit 0.
- [x] Run per-suite `--dry-run` for each of S5–S8 with the matching variant; expect exit 0.
- [ ] Run `node --test benchmarks/quality/prompt-eval/*.test.mjs`; expect all existing tests still passing.

## 5. Update spec deltas
- [ ] Add delta spec for `prompt-eval-matrix` (S5–S8 suites and tool-call/ret telemetry contract).
- [ ] Validate `openspec validate --changes` passes for `expand-prompt-eval-matrix`.
