# Tasks

## Implementation
- [ ] Define the explicit runtime allowlist (runtime, plugin manifest, skills, required assets, README, LICENSE).
- [ ] Explicitly exclude tests, benchmarks/results, coverage, heavy fixtures, logs, .tmp and dev artifacts.
- [ ] Validation MUST fail if the tarball contains junk or lacks a required artifact.
- [ ] `npm pack --dry-run` yields zero dev/test/bench files.
- [ ] Every required artifact is present.
- [ ] Test fails on any unexpected top-level entry.

## Validation
- [ ] Run the change's objective validation and paste the output.
- [ ] `openspec validate rc1-10-package-allowlist --strict` passes.
