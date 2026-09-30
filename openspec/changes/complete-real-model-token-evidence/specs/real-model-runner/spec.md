## ADDED Requirements

### Requirement: Real-Model Runner
The benchmark suite MUST include an opt-in runner that executes declared scenarios against a live model provider and persists raw evidence.

#### Scenario: Real-Model Execution
- **WHEN** the real-model runner is invoked with a declared scenario
- **THEN** it prepares a controlled initial state, executes baseline, restores the equivalent initial state, executes WAM, captures token usage and WAM events, verifies task completion, and persists raw evidence

#### Scenario: Opt-In Execution
- **WHEN** the normal test suite runs
- **THEN** real-model execution is NOT required

### Requirement: Paired Execution
Baseline and WAM executions MUST be paired under a shared pair identifier and equivalent conditions.

#### Scenario: Equivalent Pair
- **WHEN** a pair is executed
- **THEN** both arms use equivalent repository state, task, model, provider, generation parameters, token limits, initial task state, environment, and scenario version
- **AND** the pair identifier is recorded

### Requirement: Provider Token Usage
When the provider reports token usage, the provider value MUST be authoritative, and the source of every token measurement MUST be recorded.

#### Scenario: Provider Usage Available
- **WHEN** the provider reports usage
- **THEN** input, output, total, and available cached/reasoning token fields are captured
- **AND** the recorded source is `provider`

#### Scenario: Provider Usage Unavailable
- **WHEN** the provider does not report usage
- **THEN** the run identifies the fallback source explicitly as one of `tokenizer`, `trace`, or `estimated`

#### Scenario: Unknown Provider Fields
- **WHEN** the provider returns additional usage fields
- **THEN** they are preserved and not silently discarded when they may affect interpretation

### Requirement: WAM Event Provenance
WAM executions MUST expose evidence that the optimization mechanism actually executed, and this MUST NOT be inferred solely from token totals.

#### Scenario: Captured Events
- **WHEN** a WAM execution completes
- **THEN** available snapshot checks, `VALID`/`STALE`/`INVALID` classifications, fast-path executions, context assemblies, partial/full rebuilds, and task verification are captured

### Requirement: Verification
Both baseline and WAM executions MUST verify the same expected outcome before a reduction is reported as successful optimization.

#### Scenario: Verified Reduction
- **WHEN** a token reduction is reported
- **THEN** the WAM execution completed and verified the expected work
- **AND** the evidence contains `completionVerified`, `requirementsVerified`, `verificationCount`, and `verificationResult`

#### Scenario: Failed Verification
- **WHEN** the WAM execution fails to complete or verify the expected work
- **THEN** the token reduction is NOT reported as successful optimization

### Requirement: Repeated Runs
The runner MUST support repeated paired executions and report distribution statistics without silently removing outliers.

#### Scenario: Repeated Paired Runs
- **WHEN** the runner is invoked with a sample size
- **THEN** it performs at least `N >= 5` paired executions and preserves every valid run

#### Scenario: Distribution Statistics
- **WHEN** runs are aggregated
- **THEN** the report includes minimum, p25, median, p75, and maximum

#### Scenario: Excluded Run
- **WHEN** a run is excluded
- **THEN** it carries an explicit exclusion reason
