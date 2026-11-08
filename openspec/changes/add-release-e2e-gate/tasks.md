# Tasks: add-release-e2e-gate

- [x] Add `scripts/verify-release-e2e.mjs` (pack, install, isolated test user,
      new `opencode web`, Playwright, report).
- [x] Add the `verify:release` npm script.
- [x] Add `verify:release` as a required local gate in `scripts/release-gate.mjs`.
- [x] Document the release base condition in `AGENTS.md`.
- [x] Skip hidden directories in `collectTests` so build-backup dirs such as
      `.dist-root-old/` cannot inject root-owned tests into the gate.
- [x] Add `node --check scripts/verify-release-e2e.mjs`.
- [x] Use a small deterministic prompt (`hello.txt`) so the E2E exercises the
      real agent loop without the slow multi-agent coding path.
- [x] Run `npm run verify:release -- --out /tmp/wam-release-final` (13/13, 30s).
- [x] `openspec validate add-release-e2e-gate --strict`.
- [x] `npm run build`.
- [x] Pin `opencode/beam-free` in the isolated fixture (override with
      `WAM_RELEASE_MODEL`) because the default free model returned an empty turn.
- [x] Run `npm run verify:release -- --out /tmp/wam-release-model` (13/13, model
      `opencode/beam-free`).
- [x] Add local-endpoint overrides (`WAM_RELEASE_BASE_URL`/`WAM_E2E_BASE_URL`)
      for when the free quota is exhausted; no credentials are copied.
- [x] Run `node tests/e2e/opencode/smoke.mjs` with the local router (verdict pass).
- [x] Run `npm run verify:release -- --out /tmp/wam-release-realrouter` (13/13,
      local router).
- [x] Give `Strict DONE Verification (C1)` a 900s timeout in
      `scripts/release-gate.mjs` (its independent full-suite run exceeded the
      120s default under load).
- [x] `npm run gate` (PASS; release E2E report
      `/tmp/wam-release-e2e-2026-11-08T15-19-50-512Z-3684cc26/report.md`).
