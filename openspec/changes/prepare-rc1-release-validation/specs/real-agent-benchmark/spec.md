# Real Agent Benchmark

## ADDED Requirements

### Requirement: Real Baseline vs WAM Execution
The benchmark MUST execute the same task against two arms — BASELINE (OpenCode -> model -> task) and WAM (OpenCode -> WAM -> model -> task) — using the same model, provider, prompt and repository revision.

#### Scenario: Same task runs in both arms
- **WHEN** a real benchmark scenario is executed
- **THEN** the baseline arm and the WAM arm MUST receive the identical task prompt and model
- **AND** each arm MUST produce one turn record per turn index

#### Scenario: Per-run causal metrics are recorded
- **WHEN** a turn completes
- **THEN** the run record MUST include `scenario`, `run`, `turn`, `model`, `provider`, `inputTokens`, `outputTokens`, `totalTokens`, `contextTokens`, `wamOverheadTokens`, `contextRebuilds`, `fastPathCount`, `partialRebuildCount`, `fullRebuildCount` and `verification`

### Requirement: Net Input Savings
The benchmark MUST report `netInputSavings` as `baselineInputTokens - (wamInputTokens + wamOverheadTokens)`, so WAM fixed overhead is charged against savings.

#### Scenario: Overhead is subtracted once
- **WHEN** `netInputSavings` is computed
- **THEN** `wamOverheadTokens` MUST be added to WAM input tokens exactly once
- **AND** the resulting value MAY be negative

### Requirement: Canonical RC1 Scenarios
The benchmark MUST provide five canonical scenarios: `local`, `contextual`, `continuation`, `mutation` and `negative-control`.

#### Scenario: Continuation scaling
- **WHEN** the `continuation` scenario runs
- **THEN** it MUST exercise 1, 3, 5, 10 and 20 turns over the same task

#### Scenario: Mutation sequence
- **WHEN** the `mutation` scenario runs
- **THEN** it MUST include full-rebuild turns, fast-path turns, a partial rebuild after a file change, and a full rebuild after a task change

#### Scenario: Negative control
- **WHEN** the `negative-control` scenario runs
- **THEN** a case where WAM overhead exceeds context savings MUST be preserved as negative and MUST NOT be clamped

### Requirement: Break-even Reporting
The benchmark MUST report the continuation turn at which cumulative `netInputSavings` becomes non-negative as `breakEvenTurn`, or `null` when it never does.

#### Scenario: Break-even computed or null
- **WHEN** the continuation results are aggregated
- **THEN** `breakEvenTurn` MUST be the first turn index with cumulative `netInputSavings` greater than or equal to zero, or `null`
