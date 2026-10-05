# Change: Package Allowlist

## Why
The published surface must be an explicit allowlist so the package cannot ship junk or miss required artifacts.

## What Changes
- Define the explicit runtime allowlist (runtime, plugin manifest, skills, required assets, README, LICENSE).
- Explicitly exclude tests, benchmarks/results, coverage, heavy fixtures, logs, .tmp and dev artifacts.
- Validation MUST fail if the tarball contains junk or lacks a required artifact.

## Non-goals
- Shipping tests/benchmarks/fixtures.
- Implicit wildcard inclusion without a guard.

## Expected Result
The packed tarball contains exactly the allowlisted runtime surface and nothing else.

## Validation
- [ ] `npm pack --dry-run` yields zero dev/test/bench files.
- [ ] Every required artifact is present.
- [ ] Test fails on any unexpected top-level entry.

## Program
- RC1 item: RC1-10 (B)
- Priority: P0
