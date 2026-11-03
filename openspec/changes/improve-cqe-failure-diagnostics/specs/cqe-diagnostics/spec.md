# CQE Diagnostics Specification

## ADDED Requirements

### Requirement: CQE failures expose a stable failure code

The system SHALL classify every CQE fallback into a stable failure code so the
cause is deterministic and testable.

#### Scenario: Timeout is classified

- **WHEN** a CQE query rejects with `CQE_TIMEOUT` or `timedOut` is true
- **THEN** `classifyCqeFailure` returns `timeout`

#### Scenario: Busy or warming worker is classified

- **WHEN** the worker is busy or still warming
- **THEN** the reported failure code is `busy` or `warming` respectively

#### Scenario: Genuine empty result is not reported as an error

- **WHEN** CQE executes successfully but returns no items
- **THEN** the failure code is `empty` and the injected line says `sin resultados`

### Requirement: Injected CQE line is actionable

The injected prompt line SHALL distinguish empty results from failures and
include the failure code plus a short hint when CQE failed.

#### Scenario: Failure injection

- **WHEN** `cqeMeta.failureCode` is not `empty` and no files were retrieved
- **THEN** the injected line includes `fallo (<code>)` and a hint

#### Scenario: Empty injection

- **WHEN** `cqeMeta.failureCode` is `empty`
- **THEN** the injected line includes `sin resultados` without an error hint

### Requirement: CQE outcomes are accounted

The task state SHALL persist a bounded `cqeStats` breakdown of CQE outcomes
alongside the existing `cqeCalls` counter.

#### Scenario: Outcome counter increments

- **WHEN** a CQE call completes with an outcome
- **THEN** exactly one `cqeStats` bucket is incremented
