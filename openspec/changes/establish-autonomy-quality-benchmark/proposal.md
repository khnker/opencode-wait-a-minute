# Establish Autonomy Quality Benchmark

## Why

WAM can now drive a task loop, but it cannot yet answer the only question that
matters for autonomy: **is it producing correct results with less human help,
at an acceptable cost?** Without a shared measurement contract, Changes 08–12
would each invent their own success signal and improvements would be
unfalsifiable.

This change defines the benchmark schema, the four configurations and the
fair-comparison protocol. It starts alongside Change 08 so every quality
decision is measured from its first commit.

## Scope

- A canonical run record schema (`wam.autonomy.benchmark/1`).
- Metric definitions for success, verification, review, intervention, recovery,
  replanning, token cost and context relevance.
- A four-configuration matrix:
  1. OpenCode without WAM.
  2. WAM with Task Loop.
  3. WAM with Task Loop + independent review (Change 09).
  4. WAM full: adaptive policy (11) + isolated context (10) + outcome learning
     recommendations (12).
- A paired-run protocol with fixed tasks, model, tools and budgets.
- Ablations that attribute gains to WAM rather than to the model.

## Non-goals

- No training, no automatic prompt rewriting.
- No leaderboard or cross-model claims.
- No replacement of `benchmarks/quality/prompt-eval`; that suite measures prompt
  quality, this one measures autonomy outcomes.
- No production telemetry upload.

## Success Criteria

- Two runs with the same seed and fixtures produce byte-identical reports.
- Every metric is defined from persisted events, not from self-reported text.
- The report separates model effects from WAM effects via ablations.
- A failing regression in any of Changes 08–12 is visible as a metric delta.

## Dependencies

- Change 08 emits `quality.evaluated`.
- Change 09 emits review findings and severities.
- Change 11 emits autonomy level and downgrade events.
- Change 12 emits strategy recommendations and their outcomes.
