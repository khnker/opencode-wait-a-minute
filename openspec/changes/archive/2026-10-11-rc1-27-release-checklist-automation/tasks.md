# Tasks

## Implementation
- [x] `npm run release:check` (alias of `scripts/release-gate.mjs`) evaluates every RC1 gate.
- [x] Machine-readable verdict: `npm run release:check -- --json` prints `{ verdict, exitCode, gates, blockers, ... }`.
- [x] Human summary prints `RC1 READY (…)` on all-green and `RC1 BLOCKED — N gate(s) failed` otherwise.
- [x] Blockers enumerated in the JSON `blockers` array (failed gate names).
- [x] Checklist doc added: `docs/RELEASE-CHECKLIST.md` (gates, criteria, JSON shape, exit codes).

## Validation
- [x] Exit code is `0` iff every mandatory gate passes (`2` if an optional gate is unavailable, `1` on failure).
- [x] `--json` output is valid JSON with `verdict` and `blockers`.
- [x] `docs/RELEASE-CHECKLIST.md` exists and matches the gate list in `scripts/release-gate.mjs`.
- [x] `openspec validate rc1-27-release-checklist-automation --strict` passes.
