# Design

## Overview
The task-conditioned role replacement introduces a new module `src/cognition/task-role-engine.js` that provides:
- `selectRole({ objective, requirements })`: returns the best matching role and confidence.
- `buildRoleDirective(...)`: formats the role into one or two lines for injection.

## Role Selection Algorithm
Two-tier signal architecture:
1. Tier 1 (requirement-scoped): suffix-shaped signals (e.g., `-verify`, `-rollback`) evaluated per requirement.
2. Tier 2 (prompt-scoped): free-text patterns evaluated once against the objective.

Roles are selected by scoring each role's signals and picking the highest confidence, with a fallback to IMPLEMENTER.

## Integration
The role directive is built and injected into the context assembly in `src/integration/message-handler.js` immediately after the task inference directive.

## Configuration
A feature flag `taskConditionedRoleReplacement` in `src/config/wam-config.js` controls activation (default: false).

## Benchmark
Located in `benchmarks/task-conditioned-role-replacement/` with:
- `fixtures/scenarios.jsonl`: 15 scenarios covering the software lifecycle.
- `run-benchmark.mjs`: CLI to run the benchmark and produce reports.
