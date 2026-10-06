# RC1 Release Checklist

Single command that evaluates every mandatory RC1 gate and emits a machine-readable verdict:

```bash
npm run release:check          # human summary + RC1 READY / RC1 BLOCKED
npm run release:check -- --json # machine-readable JSON verdict
```

Exit codes: `0` all required gates pass, `2` required pass but an optional gate is unavailable, `1` any required gate failed.

## Gates

| # | Gate | Command | Pass criterion |
|---|------|---------|----------------|
| 1 | Version Parity | `node scripts/verify-version-parity.mjs` | package.json / README / CHANGELOG / manifest versions agree |
| 2 | Test Suite | `npm test` | all tests pass (0 fail) |
| 3 | Package Integrity | `node scripts/verify-package.mjs` | `.tgz` packs, installs in a clean temp dir, loads bundled registry |
| 4 | Security Audit | `node scripts/verify-security.mjs` | no secrets/sensitive files in the packed tarball |
| 5 | Migration E2E | `node tests/e2e/migration/run.mjs` | legacy state migrates cleanly |
| 6 | Isolation E2E | `node tests/isolation/run.mjs` | runtime state stays out of the repo |
| 7 | OpenCode Smoke E2E | `node tests/e2e/opencode/smoke.mjs` | plugin loads in a real OpenCode instance |
| 8 | Performance Sanity | `node scripts/performance-sanity.mjs` | *(optional)* budgets within thresholds |
| 9 | Real Benchmark | `npm run benchmark:real` | *(only when `WAM_RC1_EVIDENCE=1`)* reproducible RC1 evidence |

## JSON verdict shape

```json
{
  "verdict": "READY",
  "exitCode": 0,
  "totalDuration": 58700,
  "skipped": 0,
  "gates": [{ "name": "Version Parity", "status": "PASS", "duration": 320 }],
  "blockers": []
}
```

`verdict` is `READY` iff every required gate passed; otherwise `BLOCKED` with the failing gate names in `blockers`.

## Pre-flight

- `npm ci` from a clean checkout.
- Node `>=20`, npm `>=10`, OpenCode `>=1.18.0`.
- Full runbook: `docs/RC1_VALIDATION.md`.
