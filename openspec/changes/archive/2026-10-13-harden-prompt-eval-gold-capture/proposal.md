# Proposal: Harden Prompt-Eval Gold Capture CLI

## Problem

`scripts/prompts-capture-gold.mjs` silently corrupts the frozen calibration ground truth when run without a valid provider configuration:

- With no `.env` or any extra/unknown flag (e.g. `--help`), the script falls back to the mock/dry-run provider and **overwrites** the canonical gold fixture at `benchmarks/quality/prompt-eval/gold/v1-provisional/{raw/*.json,meta.json}`, silently replacing genuine baseline outputs with deterministic mock output. This flips the calibration gate from pass (κ=1.0) to κ≈0.26 until manually restored from git.
- `--help` is not handled: it falls through to capture logic instead of printing usage and exiting cleanly.

## Goal

Make `prompts-capture-gold.mjs` and `prompts-calibrate.mjs` fail-closed on the frozen gold fixture and provide safe usage without requiring a network provider.

## Scope

This change covers:

- `--help`/`-h` on both `prompts-capture-gold.mjs` and `prompts-calibrate.mjs`
- Overwrite guard: refuse to write into any directory already containing `meta.json` and/or `raw/` unless `--force` is passed
- Mock/dry-run guard: refuse to capture mock outputs into the canonical gold directory without `--force`
- Unknown-flag rejection on `prompts-capture-gold.mjs` to prevent silent mock fallback
- Regression tests asserting all three safety properties

This change does **not**:
- Modify the gold fixture bytes (read-only inspection is allowed)
- Touch `prompts/` or any policy files
- Change the provider implementations
- Add new dependencies
- Commit to git

## Non-goals

- Changing the calibration algorithm or κ thresholds
- Redesigning the gold versioning scheme
- Adding new provider types
- Modifying `prompts-calibrate.mjs` beyond `--help`

## Expected result

Running `node scripts/prompts-capture-gold.mjs` with no provider env or with `--help` exits non-zero (help: 0, no writes). Running it without `--force` on the canonical gold dir exits non-zero and leaves the fixture byte-identical. Running it with `--force` bypasses the guard for explicit replacement. `prompts-calibrate.mjs --help` prints usage and exits 0 without writes. All guards are covered by regression tests. `openspec validate --all --strict` passes.
