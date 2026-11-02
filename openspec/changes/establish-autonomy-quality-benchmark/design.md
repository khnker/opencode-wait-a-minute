# Design — Establish Autonomy Quality Benchmark

## Research

- ACM Artifact Review and Badging v1.1 — reproducibility, availability and
  independent evaluation:
  https://www.acm.org/publications/policies/artifact-review-and-badging-current
- NIST SP 800-218 (SSDF) — evidence tied to artifacts and provenance:
  https://csrc.nist.gov/pubs/sp/800/218/final
- ISO/IEC 25010 — quality dimensions must be explicit and comparable:
  https://iso25000.com/index.php/en/iso-25000-standards/iso-25010
- OpenCode server/plugin events (the only trusted run signals):
  https://opencode.ai/docs/server/

## Alternatives Considered

1. **Extend `benchmarks/quality/prompt-eval` in place.**
   Rejected: it freezes prompt-quality fixtures and hashes; autonomy needs
   multi-turn runs, tool events and human-intervention timestamps. A separate
   `benchmarks/autonomy` avoids destabilizing an existing gate.
2. **Single aggregate score.**
   Rejected: hides false acceptance behind success rate. Chosen: a metric vector
   plus an explicit cost-per-outcome.
3. **Compare configs on different task sets.**
   Rejected: confounds WAM with task difficulty. Chosen: paired runs on the same
   task, model version, tool set and budget, same seed.
4. **Self-reported success from the agent.**
   Rejected: that is exactly the failure mode WAM exists to prevent. Success is
   derived from verification and review events.
5. **Model-as-judge for review defects.**
   Rejected in the benchmark: defect detection is measured against a frozen
   oracle set, not another model's opinion.

## Run record schema (`wam.autonomy.benchmark/1`)

```json
{
  "schema": "wam.autonomy.benchmark/1",
  "runId": "string",
  "configId": "opencode-no-wam | wam-task-loop | wam-task-loop-reviewer | wam-full",
  "taskId": "string",
  "taskKind": "research | implementation | debugging | refactoring | review | documentation",
  "model": { "id": "string", "version": "string" },
  "wam": { "version": "string", "flags": {} },
  "seed": 0,
  "startedAt": "ISO-8601",
  "endedAt": "ISO-8601",
  "tokens": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "total": 0 },
  "iterations": 0,
  "decisions": { "continue": 0, "verify": 0, "replan": 0, "waitUser": 0, "block": 0, "stopBudget": 0, "stopStagnation": 0 },
  "outcome": { "taskSuccess": false, "verifiedSuccess": false, "humanInterventions": 0, "recovered": false, "replanned": false },
  "quality": { "sufficient": false, "missing": 0, "stale": 0, "contradictions": 0, "falseAcceptance": false, "falseBlock": false },
  "review": { "findings": 0, "defectsFound": 0, "severity": { "critical": 0, "high": 0, "medium": 0, "low": 0 }, "falseAcceptsPrevented": 0 },
  "context": { "injectedTokens": 0, "relevantTokens": 0, "relevanceScore": 0 },
  "costPerOutcome": 0
}
```

## Metric definitions

| Metric | Definition |
| --- | --- |
| Task success rate | tasks whose final state is accepted / total tasks |
| Verified success rate | tasks accepted with `quality.sufficient` and passing verification / total |
| Review defect detection | oracle defects found by review / oracle defects present |
| False acceptance rate | tasks accepted with a known oracle defect / accepted tasks |
| Human intervention rate | human turns or approvals per task / tasks |
| Recovery rate | runs that reach success after a `REPLAN` or retry / runs needing recovery |
| Replanning efficiency | successful replans / total replans |
| Token cost per outcome | total tokens / verified successes |
| Context relevance | relevant injected tokens / injected tokens, judged by frozen fixture labels |

## Protocol

- Task set: fixed, versioned fixtures with an expected outcome and an oracle
  defect list. Minimum 30 tasks per configuration, stratified by task kind.
- Controls: same model id/version, same tool permissions, same token and
  iteration budget, same seed, same project snapshot.
- Pairing: each task runs under all four configurations; report per-task deltas,
  then medians with bootstrap confidence intervals.
- Ablations: start from `wam-full` and disable one feature at a time (quality
  contracts, review, context isolation, adaptive policy, outcome learning) to
  attribute gains.
- Attribution: pin the model and compare within-model; never compare a WAM run
  on model A with a no-WAM run on model B.
- Determinism: event-derived records are sorted by `(taskId, configId, runId)`;
  reports contain no timestamps and are byte-identical across repeats.

## Storage

```
benchmarks/autonomy/
  schema.mjs          # schema + validator (pure)
  suites/*.json       # frozen tasks + oracle defects
  metrics/*.jsonl     # append-only run records
  run.mjs             # runner for the four configurations
  report.mjs          # deterministic aggregation
  baselines/*.json    # frozen aggregate per release
```

## Risks

- Oracle defects are expensive to curate; begin with 30 well-understood tasks.
- Human intervention is noisy; count explicit approvals and user turns only.
- Token accounting differs per provider; record raw provider fields and derive
  the total with one documented formula.
- Ablations multiply cost; run the full matrix only on release candidates, a
  reduced matrix on every PR.
