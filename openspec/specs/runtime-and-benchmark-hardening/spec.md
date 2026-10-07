# Runtime and Benchmark Hardening

## Purpose
Define the requirements for mandatory output node handling (TASK-08) and CWR evidence handling (TASK-10) in the WAM context router and benchmark system.

## Requirements

### Requirement: Mandatory output node handling
The router SHALL include nodes of type "output" with `metadata.admission === "MANDATORY"` in the required set for context selection, SHALL respect the admission class of such nodes, and SHALL never drop them.

#### Scenario: Mandatory output node never dropped
- **WHEN** a node has type "output" and `metadata.admission === "MANDATORY"`
- **THEN** the router SHALL include it in the required set for context selection
- **AND** the router SHALL respect its admission class and never drop it

#### Scenario: Benchmark verifies oracle closure
- **WHEN** the benchmark test `tests/context-output-benchmark.test.mjs` runs a scenario with a mandatory output node
- **THEN** it SHALL verify SPR=1.0, COR=0, and CWR=0
- **AND** the test SHALL use an explicit `requires` edge in `scenario.requires` to ensure oracle closure verification

### Requirement: CWR evidence handling
`context-optimization-metrics.js` SHALL return `CWR = null` when no evidence of used tokens or used IDs is provided, and SHALL compute CWR normally when evidence is present.

#### Scenario: No evidence yields null CWR
- **WHEN** both `input.usedIds` is not an array and `input.usedTokens` is not a number
- **THEN** `context-optimization-metrics.js` SHALL return `CWR = null`

#### Scenario: Evidence yields computed CWR
- **WHEN** either `usedIds` or `usedTokens` is provided
- **THEN** `context-optimization-metrics.js` SHALL compute CWR normally

#### Scenario: Benchmark propagates scenario usedIds
- **WHEN** the selector returns `undefined` for usedIds
- **THEN** the benchmark system SHALL propagate the scenario `usedIds`

#### Scenario: Test verifies null CWR behavior
- **WHEN** `context-optimization.test.mjs` runs with no evidence
- **THEN** it SHALL verify CWR behavior with no evidence (CWR=null)
