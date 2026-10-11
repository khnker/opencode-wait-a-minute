# Change: Release Checklist Automation

## Why
RC1 must not depend on remembering to run ~12 manual commands.

## What Changes
- Provide `npm run release:check` producing a machine-readable PASS/FAIL summary per gate.
- Cover tests, package, clean install, smoke, E2E, persistence, completion, benchmark evidence, docs, version, changelog and git-clean.
- Emit `RC1 READY` or `RC1 BLOCKED` with the blocker list.
- Document the checklist in `docs/releases/RC1-CHECKLIST.md`.

## Non-goals
- Silent passes on skipped gates.

## Expected Result
One command reports every gate with an unambiguous READY/BLOCKED verdict.

## Validation
- [x] `npm run release:check` exits 0 iff all mandatory gates pass.
- [x] Summary is machine-readable.
- [x] Blockers are enumerated.
- [x] Checklist doc exists.

## Program
- RC1 item: RC1-27 (B)
- Priority: P0
