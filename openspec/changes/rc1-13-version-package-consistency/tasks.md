# Tasks

## Implementation
- [ ] Assert equality of package.json version, README version, CHANGELOG version, plugin manifest version and git tag.
- [ ] Fail the gate on divergence.
- [ ] A mismatch in any source fails the gate.
- [ ] A matching set passes.
- [ ] The check runs in CI and locally.

## Validation
- [ ] Run the change's objective validation and paste the output.
- [ ] `openspec validate rc1-13-version-package-consistency --strict` passes.
