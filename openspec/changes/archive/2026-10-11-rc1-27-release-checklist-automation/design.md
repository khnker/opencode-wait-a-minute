# Design: Release Checklist Automation

## Approach
RC1 must not depend on remembering to run ~12 manual commands.

## Scope
- Provide `npm run release:check` producing a machine-readable PASS/FAIL summary per gate.
- Cover tests, package, clean install, smoke, E2E, persistence, completion, benchmark evidence, docs, version, changelog and git-clean.
- Emit `RC1 READY` or `RC1 BLOCKED` with the blocker list.
- Document the checklist in `docs/releases/RC1-CHECKLIST.md`.

## Validation Strategy
- `npm run release:check` exits 0 iff all mandatory gates pass.
- Summary is machine-readable.
- Blockers are enumerated.
- Checklist doc exists.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
