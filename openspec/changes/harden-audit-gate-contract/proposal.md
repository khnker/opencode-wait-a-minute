# Proposal: Harden WAM Audit Gate Contract

## Problem

The `wam-audit` regression gate currently has ambiguous behavior around explicit configuration and baseline files.

In particular:

* `--config` can silently fall back to default configuration when the requested file does not exist or is invalid.
* `--baseline` can silently behave as if no baseline was supplied when the file does not exist or cannot be parsed.
* `--baseline` without `--gate` does not expose the gate result even though the contract describes the gate as part of the audit output.
* The existing OpenSpec task state does not accurately reflect the implementation already present in the repository.

These behaviors are dangerous for CI because a malformed or missing release-control input can degrade into a successful audit using implicit defaults.

## Goal

Make `wam-audit` deterministic and fail-closed when explicit gate inputs are invalid.

The audit command must distinguish:

1. valid audit execution,
2. valid audit with detected regression,
3. invalid command/configuration/input.

Regression remains a domain result and must not be conflated with command failure.

## Scope

This change covers:

* `--config`
* `--baseline`
* gate output generation
* input validation
* exit-code semantics
* associated tests
* reconciliation of the existing audit-gate OpenSpec task state

This change does not redesign the audit heuristics or introduce new audit metrics.

## Non-goals

* Changing the scoring model.
* Changing strategy classification.
* Making heuristic audit findings deterministic.
* Introducing a new persistence layer.
* Changing the public plugin API.

## Expected result

A CI invocation cannot silently downgrade from an explicitly requested gate configuration to implicit defaults.

Malformed or missing explicit inputs fail immediately and deterministically.
