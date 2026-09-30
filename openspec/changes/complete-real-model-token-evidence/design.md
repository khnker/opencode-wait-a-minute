# Design: Complete Real-Model Token Evidence

## Scope

* Language: JavaScript ESM (`.mjs`), zero new runtime dependencies.
* Real-model execution is opt-in; deterministic trace replay remains the CI default.
* This change MUST NOT modify WAM's runtime optimization algorithm, context assembly semantics, snapshot invalidation, or internal token accounting.

## Paired Execution Model

For each scenario, the runner executes a paired baseline/WAM run sharing an identical initial state:

1. snapshot the controlled initial state;
2. run baseline to completion, capture provider usage and trace;
3. restore the exact initial state;
4. run WAM to completion, capture provider usage, WAM events, and trace;
5. verify both executions against the same expected outcome;
6. persist the pair under a shared `pairId`.

The runner repeats pairs `N` times (`N >= 5`, target `N = 10`) and keeps every valid run.

## Provider Usage Boundary

A provider-neutral usage schema normalizes heterogeneous provider responses:

```
{ inputTokens, outputTokens, cachedInputTokens, reasoningTokens, totalTokens, extra }
```

* Provider-reported values are authoritative.
* When usage is absent, the measurement records its fallback source: `provider | tokenizer | trace | estimated`.
* Unknown provider fields are preserved under `extra`, never silently dropped.

## WAM Event Provenance

WAM execution events are captured from instrumentation seams (not inferred from token totals): snapshot checks, `VALID`/`STALE`/`INVALID`, fast-path executions, context assemblies, partial/full rebuilds, and task verification.

## Verification

Both arms verify the same expected outcome. Evidence records `completionVerified`, `requirementsVerified`, `verificationCount`, `verificationResult`. Token reduction is only reported as a successful optimization when WAM verification succeeds.

## Statistics

Repeated-run statistics report `min`, `p25`, `median`, `p75`, `max`. No outlier is silently removed; excluded runs carry an explicit `exclusionReason`.

## Provenance & Reproducibility

Every run records `runId`, `pairId`, `gitSha` (resolved actual SHA — never the literal `HEAD`), `gitDirty`, component versions, provider/model, generation parameters, and timestamp.

Artifacts: `raw.json` (source of truth), `summary.json`, `report.md`, `charts/`. Summary and report are derived from `raw.json`; re-running the analyzer over the same raw evidence yields equivalent metrics. Real-model execution is non-deterministic; the reproducible artifact is the captured evidence plus its analysis.

## Claims

Evidence is classified as mechanism (deterministic traces), provider (real-model token usage), or task-efficiency (tokens + successful verification). No universal token-savings claim is made.

## Negative Results

Negative savings remain valid and preserve their sign; no clamping to zero.
