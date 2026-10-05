# Tasks

## Implementation
- [ ] Provide `npm run release:check` producing a machine-readable PASS/FAIL summary per gate.
- [ ] Cover tests, package, clean install, smoke, E2E, persistence, completion, benchmark evidence, docs, version, changelog and git-clean.
- [ ] Emit `RC1 READY` or `RC1 BLOCKED` with the blocker list.
- [ ] Document the checklist in `docs/releases/RC1-CHECKLIST.md`.
- [ ] `npm run release:check` exits 0 iff all mandatory gates pass.
- [ ] Summary is machine-readable.
- [ ] Blockers are enumerated.
- [ ] Checklist doc exists.

## Validation
- [ ] Run the change's objective validation and paste the output.
- [ ] `openspec validate rc1-27-release-checklist-automation --strict` passes.
