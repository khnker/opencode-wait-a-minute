# Tasks

## Implementation
- [ ] `ci.yml`: install -> lint -> unit -> integration -> deterministic benchmark.
- [ ] `e2e.yml`: install -> package -> clean install -> OpenCode -> real E2E.
- [ ] `release-gate.yml`: all mandatory gates -> package validation -> E2E -> evidence validation.
- [ ] All three workflows exist and run the specified gates.
- [ ] Failing gates block merge/release.
- [ ] No manual step required.

## Validation
- [ ] Run the change's objective validation and paste the output.
- [ ] `openspec validate rc1-12-github-actions-release-gate --strict` passes.
