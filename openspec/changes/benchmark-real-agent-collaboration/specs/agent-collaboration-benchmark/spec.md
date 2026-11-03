# Agent Collaboration Benchmark

## ADDED Requirements

### Requirement: Injectable real adapter

The benchmark SHALL accept an `adapterFactory({ scenario })` that returns an
object with `invoke(request)` compatible with the orchestrator adapter contract,
and SHALL reject a missing or invalid factory with a clear error.

#### Scenario: Factory is required

- **WHEN** `runRealCollaborationBenchmark` is called without `adapterFactory`
- **THEN** it rejects with an error naming `adapterFactory`

#### Scenario: Factory is invoked per scenario

- **WHEN** a factory is supplied
- **THEN** it is called once per scenario with that scenario descriptor

### Requirement: Real orchestration reuse

The benchmark SHALL run `runAgentFeedbackOrchestration` for each scenario and
SHALL NOT reimplement the collaboration pipeline.

#### Scenario: Metrics reflect orchestrator behavior

- **WHEN** a scenario runs
- **THEN** `agentInvocations` equals the orchestrator's result count,
  `handoffs` equals its handoff count, and `revisions`/`replans` come from its
  cycles

### Requirement: Deterministic serializable report

The benchmark SHALL return a JSON-serializable report with a `benchmark` id and
one entry per scenario containing scenario identity, expected outcome, metrics
(`completed`, `accepted`, `revisions`, `replans`, `agentInvocations`,
`handoffs`, `independentReviewArtifacts`, `estimatedTokens`) and `expectedMet`.
Token counts SHALL be `ceil(chars / 4)` over serialized requests and results.

#### Scenario: Deterministic default scenarios

- **WHEN** the same deterministic adapter is injected and the benchmark runs
  twice
- **THEN** both reports are deeply equal and include `accepted-first-pass` and
  `revision-accepted`

### Requirement: Opt-in CLI

The module SHALL only execute the benchmark when run as the CLI entry, and that
entry SHALL load a factory module from `WAM_AGENT_BENCH_ADAPTER`, preferring the
`createAdapterFactory` export, then `default`, printing the JSON report and
exiting nonzero when the variable/export is missing or the expected outcomes are
not met.

#### Scenario: Import does not execute

- **WHEN** the module is imported (not run as the entry point)
- **THEN** no benchmark runs and no report is printed

#### Scenario: Missing adapter is loud

- **WHEN** the CLI runs without `WAM_AGENT_BENCH_ADAPTER`
- **THEN** it exits nonzero with a message naming the variable
