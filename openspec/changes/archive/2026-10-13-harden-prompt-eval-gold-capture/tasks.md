# Tasks

## Implementation

- [x] Add `--help`/`-h` handling to `scripts/prompts-capture-gold.mjs` (prints usage, exits 0, no capture, no writes).
- [x] Add `--help`/`-h` handling to `scripts/prompts-calibrate.mjs` (prints usage, exits 0, no calibration, no writes).
- [x] Add `--force` flag and overwrite guard to `scripts/prompts-capture-gold.mjs`: refuse to write into any directory containing `meta.json` and/or `raw/` without `--force` (exit non-zero).
- [x] Add mock/dry-run guard to `scripts/prompts-capture-gold.mjs`: refuse to capture mock outputs into the canonical gold directory without `--force`.
- [x] Reject unknown flags on `scripts/prompts-capture-gold.mjs` to prevent silent mock fallback.
- [x] Export `USAGE` constants from both scripts.
- [x] Export `hasFrozenFixture` and `parseArgs` helpers for testability.

## Tests

- [x] Regression test: `--help` prints usage, exits 0, writes nothing.
- [x] Regression test: capture onto the canonical frozen gold dir without `--force` exits non-zero and leaves the fixture byte-identical (sha256 compare).
- [x] Regression test: `--force` is the only way to overwrite a frozen fixture (refused without, succeeds with).
- [x] Regression test: `prompts-calibrate.mjs --help` prints usage and exits 0.

## Verification

- [ ] `node scripts/prompts-capture-gold.mjs --help` → EXIT=0, usage printed.
- [ ] `node scripts/prompts-calibrate.mjs --help` → EXIT=0, usage printed.
- [ ] `node scripts/prompts-capture-gold.mjs` (no args) → non-zero, gold fixture byte-identical (sha256 diff empty).
- [ ] `node --test scripts/prompts-capture-gold.test.mjs` → all tests pass.
- [ ] `node scripts/prompts-calibrate.mjs` → EXIT=0, κ=1.0.
- [ ] `openspec validate --all --strict` → passes (Totals: all changes/archives/specs valid).
