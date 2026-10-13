# Design: Harden Prompt-Eval Gold Capture CLI

## Key design decisions

### 1. `--help` handling

Both scripts export a `USAGE` constant and check `args.help` at the top of `main()`. The check returns early, printing usage and exiting with status 0, before any provider resolution or file system access. This satisfies the no-side-effects requirement.

### 2. Overwrite guard (`hasFrozenFixture`)

`hasFrozenFixture(dir)` checks for the presence of `meta.json` **or** the `raw/` directory. Both are required components of a valid fixture, so either being present is sufficient to treat the directory as a frozen gold target.

The guard fires before the provider is resolved, avoiding any network I/O in the protected path.

### 3. Mock/dry-run detection (`isMockEnv`)

`isMockEnv(env)` mirrors the dry-run logic in `benchmarks/providers/index.mjs` using only the effective environment variables, without instantiating a provider. This allows the guard to refuse mock captures even when the fallback was implicit (no `WAM_BENCH_BASE_URL`, no `WAM_BENCH_REAL_MODEL=1`).

The guard applies specifically to the canonical gold directory (`DEFAULT_OUT`). Mock captures to any other `--out` directory are allowed without `--force`, supporting offline testing.

### 4. `--force` bypass

`--force` is the only flag that disables both guards. It is intentionally verbose in its refusal messages to make accidental use obvious.

### 5. Unknown-flag rejection

Any `-` prefixed argument not recognized by `parseArgs` is collected in `unknown[]` and causes an immediate usage print + exit 2 before any capture. This prevents silent mock fallback from an accidentally passed flag.

### 6. Exit codes

| Situation | Exit |
|---|---|
| `--help`/`-h` | 0 |
| Guarded (no --force, or mock into canonical) | 1 |
| Unknown flag | 2 |
| Suite not found | 1 |
| Capture succeeded | 0 (from `captureGold`) |

### 7. Minimal changes

All changes are confined to `scripts/prompts-capture-gold.mjs` and `scripts/prompts-calibrate.mjs`. No provider code is modified. The gold fixture is never written during any guard scenario.
