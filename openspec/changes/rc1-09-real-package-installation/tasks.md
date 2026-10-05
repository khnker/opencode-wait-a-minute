# Tasks

## Implementation
- [ ] `npm pack` to a temp dir and install the `.tgz` in a clean OpenCode environment.
- [ ] Validate package.json, exports, plugin manifest, skills, runtime, scripts and required docs.
- [ ] Validate included/excluded files.
- [ ] Fail if it only works from the checkout.
- [ ] Install from `.tgz` in a fresh temp env exits 0.
- [ ] Required runtime files present.
- [ ] Skills load.
- [ ] Scripts resolve.
- [ ] Fails when run against the source tree only.

## Validation
- [ ] Run the change's objective validation and paste the output.
- [ ] `openspec validate rc1-09-real-package-installation --strict` passes.
