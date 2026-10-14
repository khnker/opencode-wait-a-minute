---
id: expand-prompt-eval-matrix
title: Expand prompt evaluation matrix with S5–S8 suites and live tool-call telemetry
status: draft
created: 2026-10-14
schema: spec-driven
---

# Why

The current prompt-eval matrix covers four suites (S1 verify, S2 scope, S3 simplify, S4 delegation) and the live harness only records tokens and latency. The matrix needs to cover the full prompt-policy surface (Discovery, Runtime, Decision Gate, Completion) and the live harness must surface behavioral signals (tool-calls, retries, execution failures) so regressions in agent behavior — not just cost — can be detected and vetoed.

# What changes

- Extend `benchmarks/quality/prompt-eval/live.mjs` so `runLiveVariant` returns `{ toolCalls, retries, executionFailures }` per scenario and aggregate. The provider surface gains optional `recordToolCall(toolName, { ok, retry, durationMs })` and `recordRetry(reason)`, both opt-in (no behavior change for providers that don't implement them).
- Persist `toolCalls` and `retries` in the live cost artifact (`cost.json` → `toolCalls[]`, `retries[]`); keep `tokens`, `latencyMs`, `executionFailures` unchanged.
- Add four new suites under `benchmarks/quality/prompt-eval/suites/`:
  - `discovery.json` (S5) — Discovery: gather context before acting, prefer indexed tools, ask only when required.
  - `runtime.json` (S6) — Runtime hygiene: idempotent ops, isolated state, observable side-effects.
  - `decision-gate.json` (S7) — Decision gate: capture trade-offs, record the choice, ask when the contract is genuinely missing.
  - `completion.json` (S8) — Completion: distinguish partial vs. verified, mark only with executed checks, record residual risk.
- Wire the new suites into `scripts/prompts-live.mjs` (default variants S5→D5, S6→R1, S7→G1, S8→C1) and ship the matching active policies (`prompts/policies/{discovery,runtime,decision-gate,completion}.md`) plus experimental variants (`prompts/experiments/{discovery/D5,runtime/R1,decision-gate/G1,completion/C1}.md`); register the active policies in `prompts/index.json`.
- Extend the live comparison report so every row carries `toolCalls` and `retries` (baseline vs. candidate, derived from `cost.toolCallTotals.calls` and `cost.retries.length`) and the rendered table adds `tc` / `re` columns. into the experiment engine so the comparison report lists improves / regressions / tokens / latency / tool-calls / retries / decision per suite × variant.
- Output a structured comparative report at `<out>/comparison.md` and `<out>/comparison.json` covering every (suite, variant) pair in the run.

# Acceptance

- `node scripts/prompts-live.mjs --suite verify --variant V1 --dry-run` exits 0 (existing CI gate, must not regress).
- `node scripts/prompts-live.mjs --suite all --variant V1 --dry-run` exits 0 and lists S1–S8.
- `live.mjs` exports `runLiveVariant` returning `toolCalls` and `retries` (alongside existing fields); default mock provider records 0 / 0.
- The comparison report enumerates each suite, lists improves/regressions, token totals, latency median, total tool-calls, total retries, and the final decision per variant.
- Existing tests still pass: `node --test benchmarks/quality/prompt-eval/*.test.mjs`.

# Non-goals

- No real-model LLM calls in CI; the `--dry-run` path stays provider-mock.
- No change to existing S1–S4 rubric criteria; we add new suites, we don't mutate old ones.
- No migration of historical live evidence — new fields are additive and missing in old runs.
