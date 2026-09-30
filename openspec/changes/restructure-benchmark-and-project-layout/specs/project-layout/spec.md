# Specification: Project Layout

## Requirement: Benchmark directory separation

All benchmark scenarios, runners, analyzers, reporters, charts, fixtures, and results MUST reside under `benchmarks/`.

## Requirement: Operational script separation

Repository operational scripts such as audits and release gates MUST reside under `scripts/`.

## Requirement: Generated results location

Generated benchmark results MUST be stored under `benchmarks/results/`.

## Requirement: Import path updates

When files are relocated, all relative imports and module paths MUST be updated correctly.

## Requirement: Test integrity

Relocating benchmark files MUST NOT break existing tests or CI benchmark verification.
