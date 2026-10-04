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
- `SKILL.md` — Align version metadata to `1.1.0` (was `1.0.0`).

### Fixed
- Paired runner cross-contamination test: WAM arm now correctly includes turn prompt (was silently dropped, breaking test expectations).

### Compatibility
- OpenCode 1.18.33 tested pass; minimum version 1.18.0 (added).
- Node.js >=20 required.

### Validation
Run:
```bash
npm run gate        # Unit + integration + validation tests
npm run pack:test   # Package integrity (tarball install verification)
npm run smoke       # Plugin loads without exception
```

### Known limitations
- Real E2E against live OpenCode runtime requires manual verification (no CI harness in RC1).
- Performance baseline to be captured post-RC1 release.