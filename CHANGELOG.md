# Changelog

## [RC1]

### Added
- `docs/OPENCODE_COMPATIBILITY.md` — Defines OpenCode plugin contract (hooks used, API surface, Node.js engine requirement).
- `docs/benchmark/` — RC1 benchmark documentation (methodology, limitations, RC1 report schema).
- `scripts/wam-audit-report.mjs` — Single-file WAM audit report generator; produces one unified report file instead of per-session files.
- `docs/RC1.md` — RC1 release specification (purpose, scenarios, validation gates).
- `docs/benchmark/methodology.md`, `limitations.md` — Benchmark design rationale and known limitations.

### Changed
- `benchmarks/providers/openai-compatible.mjs` — Add timeout with `AbortSignal.timeout();` fall back to `reasoning_content` when `content` is empty (for reasoning-routed models).
- `benchmarks/real/runners/paired-runner.mjs` — Append `[Task]\n${turn.prompt}` to WAM assembled context so both baseline and WAM arms receive the user prompt. Removes silent omission bug.
- `package.json` — Add `release-gate` script alias for unified validation.
- `benchmarks/reporters/rc1-report.mjs` — Distinguish live-provider from dry-run evidence in section B, comparison notes and metrics; select the latest suite envelope by mtime (dry-run dirs named `dry-run-<epoch>` previously sorted above ISO-timestamped live runs); add a live-run caveat about textual outcome equivalence.
- `SKILL.md` — Align version metadata to `1.1.0` (was `1.0.0`).

### Fixed
- Paired runner cross-contamination test: WAM arm now correctly includes turn prompt (was silently dropped, breaking test expectations).

### Compatibility
- OpenCode 1.18.33 tested pass; minimum version 1.18.0 (added).
- Node.js >=20 required.

### Validation
Run the unified RC1 release gate (also available as `npm run rc1` / `npm run validate`):
```bash
npm run gate        # Version parity + package integrity + security + migration/isolation E2E + OpenCode smoke E2E + perf sanity
npm run report:rc1  # Regenerate the machine-readable RC1 evidence bundle (benchmarks/reports/rc1/)
npm run smoke       # Plugin loads without exception
```
The OpenCode smoke E2E is skipped automatically when the `opencode` binary or a model provider is unavailable (CI); set `WAM_SKIP_OPENCODE_E2E=1` to force-skip.

### Known limitations
- Real-provider benchmark (`npm run benchmark:real`) requires `WAM_BENCH_BASE_URL`/`WAM_BENCH_API_KEY`/`WAM_BENCH_MODEL`; it is skipped when unset. A live run was executed against an OpenAI-compatible provider (`auto/best-fast`): `benchmarkValid=true`, `stateEquivalent=true`, `netInputSavings=95357` tokens over 39 turns (`TokenReductionPct=35.94`).
- **Live-run `outcomeMatch` is structurally ~0.** `outcomeMatch`/`EquivalenceRate` compare the exact normalized text of two independent stochastic LLM generations (baseline vs WAM). For live providers this is expected to be ~0 and is NOT a correctness signal. The authoritative live signals are state equivalence, the deterministic internal suite, and net input savings.
- Performance baseline is a soft sanity check, not a regression threshold.