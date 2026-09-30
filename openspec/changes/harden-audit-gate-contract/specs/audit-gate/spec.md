# Audit Gate Contract

## Requirement: Explicit configuration must fail closed

When `--config` is explicitly provided, the system MUST reject a missing, unreadable, malformed, or schema-invalid configuration.

It MUST NOT silently fall back to default configuration.

### Scenario: Missing configuration

* GIVEN `--config` references a nonexistent file
* WHEN `wam-audit` executes
* THEN the command exits with a command-error status
* AND no gate result is reported as valid

### Scenario: Invalid configuration

* GIVEN `--config` references invalid JSON
* WHEN `wam-audit` executes
* THEN the command exits with a command-error status

## Requirement: Explicit baseline must fail closed

When `--baseline` is explicitly provided, the system MUST reject a missing, unreadable, malformed, or invalid baseline.

### Scenario: Missing baseline

* GIVEN `--baseline` references a nonexistent file
* WHEN `wam-audit` executes
* THEN the command exits with a command-error status

### Scenario: Invalid baseline

* GIVEN `--baseline` contains invalid JSON
* WHEN `wam-audit` executes
* THEN the command exits with a command-error status

## Requirement: Gate evaluation must be observable

When sufficient audit data exists, the JSON result MUST expose the calculated gate evaluation.

This includes baseline comparison when a valid baseline is provided.

## Requirement: Regression must be distinct from command failure

A valid audit that detects a regression MUST return the regression exit code rather than the generic command-error exit code.

A malformed command or invalid input MUST return a command-error exit code.

## Requirement: Audit gate behavior must be deterministic

Identical audit input, configuration, and baseline MUST produce identical gate results.

The gate MUST NOT depend on implicit fallback configuration when explicit inputs were supplied.
