## ADDED Requirements

### Requirement: Live harness MUST record tool-call and retry telemetry
The live harness `benchmarks/quality/prompt-eval/live.mjs` MUST capture, per scenario, every tool-call invoked through the provider's `recordToolCall(name, meta)` hook and every retry signaled through `recordRetry(reason)`. The aggregate live run artifact MUST include:

- `toolCalls`: flat array of `{ scenarioId, name, ok, retry, durationMs }`
- `retries`: flat array of `{ scenarioId, reason }`
- `toolCallTotals`: `{ calls, ok, retry, byName: { [name]: count } }`

#### Scenario: Provider without telemetry hooks
- **WHEN** a provider does not implement `recordToolCall` or `recordRetry`
- **THEN** the harness records an empty array for that field and the run still completes

#### Scenario: Mock provider in dry-run
- **WHEN** `--dry-run` is set and the mock provider is used
- **THEN** `toolCalls` and `retries` are empty arrays and the run is byte-deterministic across repeats (modulo `latencyMs`)

### Requirement: Prompt-eval matrix MUST cover S5–S8
The matrix under `benchmarks/quality/prompt-eval/suites/` MUST contain suites for:

- **S5 Discovery** — context-first, indexed lookup, ask only when contract is missing
- **S6 Runtime** — idempotent operations, isolated state, observable side-effects
- **S7 Decision Gate** — trade-off capture, ask when contract is genuinely missing
- **S8 Completion** — verified vs. partial, residual risk

Each suite MUST follow the existing `{ id, version, description, scenarios[] }` shape and ship a frozen baseline under `baselines/`.

Each S5–S8 suite MUST be backed by:
- an **active policy** under `prompts/policies/{discovery,runtime,decision-gate,completion}.md`
- an **experimental variant** under `prompts/experiments/{discovery,runtime,decision-gate,completion}/{D5,R1,G1,C1}.md`
- a mapping in `scripts/prompts-live.mjs` from `promptRef → activeRel`, suite → default variant, and variant → policy folder
- a registration in `prompts/index.json` so the loader knows the active policy is shipped

#### Scenario: S5–S8 suites are present and resolvable
- **WHEN** the suites directory and `scripts/prompts-live.mjs` are inspected
- **THEN** `discovery`, `runtime`, `decision-gate`, and `completion` suites exist with a frozen baseline, an active policy, an experimental variant, and a suite→variant mapping

### Requirement: Comparison report MUST include tool-calls and retries
`scripts/prompts-live.mjs` MUST surface `toolCalls` and `retries` for both baseline and candidate in every comparison row and in the rendered comparison report table. The values MUST be derived from `live.mjs` (`cost.toolCallTotals.calls` and `cost.retries.length`) and MUST default to `0` when a provider does not emit the optional telemetry.

#### Scenario: Provider emits telemetry
- **WHEN** a live run completes with a provider that emits tool-call/retry telemetry
- **THEN** every comparison row and the report table show baseline and candidate `toolCalls` and `retries`

#### Scenario: Provider omits telemetry
- **WHEN** a provider does not emit the optional telemetry
- **THEN** `toolCalls` and `retries` default to `0` and the run still completes

### Requirement: Live CLI MUST emit a structured comparison report
`scripts/prompts-live.mjs` MUST write `<out>/comparison.json` (schema `wam.prompt-eval.comparison/1`) and `<out>/comparison.md` after every run, summarizing per (suite, variant):

- decision (NO_CHANGE / IMPROVED / REGRESSION / INCONCLUSIVE)
- pass rate (mandatory compliance)
- tokens (baseline, variant, delta)
- latencyMs (baseline, variant, delta)
- toolCalls (baseline, variant, byName)
- retries (baseline, variant)
- improves / regressions lists

The report MUST be produced under `--dry-run` so CI can validate end-to-end without network.

#### Scenario: Dry-run writes comparison artifacts
- **WHEN** `--dry-run` is set and the run completes
- **THEN** `<out>/comparison.json` (schema `wam.prompt-eval.comparison/1`) and `<out>/comparison.md` are written with per (suite, variant) decision, pass rate, tokens, latencyMs, toolCalls, retries, and improves/regressions lists

### Requirement: Live CLI MUST accept S5–S8
`scripts/prompts-live.mjs` MUST resolve the suites `discovery`, `runtime`, `decision-gate`, `completion` and the variants `D5`, `R1`, `G1`, `C1`, mapping each to its active policy and experimental variant.

#### Scenario: All eight suites resolve
- **WHEN** `node scripts/prompts-live.mjs --suite all --dry-run` runs
- **THEN** all eight suites (verify, scope, simplify, delegation, discovery, runtime, decision-gate, completion) print a comparison row and the process exits 0

#### Scenario: Unknown suite or variant
- **WHEN** an unknown suite or variant value is passed
- **THEN** the CLI exits non-zero with an error naming the unknown value
`scripts/prompts-live.mjs --suite all` MUST iterate suites `verify, scope, simplify, delegation, discovery, runtime, decision-gate, completion` and `--suite <id>` MUST accept any of those individually. Default variants per new suite: D5, R1, G1, C1.
