# Design: Package Allowlist

## Approach
The published surface must be an explicit allowlist so the package cannot ship junk or miss required artifacts.

## Scope
- Define the explicit runtime allowlist (runtime, plugin manifest, skills, required assets, README, LICENSE).
- Explicitly exclude tests, benchmarks/results, coverage, heavy fixtures, logs, .tmp and dev artifacts.
- Validation MUST fail if the tarball contains junk or lacks a required artifact.

## Validation Strategy
- `npm pack --dry-run` yields zero dev/test/bench files.
- Every required artifact is present.
- Test fails on any unexpected top-level entry.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
