## Why

The release contract was split: PR and release CI ran a legacy 8-test subset (`scripts/production-gate.mjs`), while the canonical unified gate (`scripts/release-gate.mjs`, aliased as `gate`/`rc1`/`validate`/`production:gate`) only ran on RC1 tags. A pull request could therefore pass CI without exercising the actual release contract. In addition, the OpenCode smoke E2E stage declared success on a clean process exit without asserting that the model actually completed the round-trip.

## What Changes

- `ci.yml` and `release.yml` now run the canonical `npm run gate` (`scripts/release-gate.mjs`) with `WAM_SKIP_OPENCODE_E2E=1`, because CI has no model provider.
- Remove the redundant `production-validation` job from `ci.yml` (its scope is a subset of the canonical gate).
- Harden `tests/e2e/opencode/smoke.mjs` so success requires the expected model answer in the output, not merely a clean exit.
- Retire the legacy `scripts/production-gate.mjs` subset; its `*.test.mjs` suites remain covered by the recursive `npm test` runner.
- **BREAKING**: any external automation invoking `node scripts/production-gate.mjs` must switch to `npm run gate`.

## Capabilities

### New Capabilities
- `release-gate-contract`: the canonical release gate command and its aliases, CI parity with that gate, the OpenCode E2E round-trip assertion, and retirement of the legacy production gate.

### Modified Capabilities
- (none)

## Impact

- `.github/workflows/ci.yml`, `.github/workflows/release.yml`
- `tests/e2e/opencode/smoke.mjs`
- `scripts/production-gate.mjs` (removed)
- `CHANGELOG.md`
- No runtime/plugin behavior change and no new dependencies.
