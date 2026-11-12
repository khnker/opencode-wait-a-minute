# Proposal: remove-cqe-and-dashboard

## Why

Two optional subsystems add dependency, code, prompt, test and operational surface
without carrying their weight:

- **CQE**: the plugin vendors `context-query-core`, ships `cqe-adapter.js` +
  `cqe-worker.mjs`, a Worker-backed retrieval path, failure taxonomy, per-task
  `cqeCalls`/`cqeStats` counters, prompts that advertise CQE lookups, and a large
  test/benchmark suite. Native retrieval (`selectContext` in
  `src/context/context.js`) already covers the plugin's needs deterministically.
  CQE was best-effort augmentation and its failure modes were the main source of
  retrieval diagnostics noise.
- **Sessions dashboard**: an inline HTTP server started from `index.js` behind
  `WAM_DASHBOARD`. It is off by default, duplicates the opencode session UI, and has
  caused port-conflict noise in E2E logs. The plugin does not need its own web server
  to expose session state.

## What Changes

- Remove the CQE engine end to end: `src/context/cqe-adapter.js`,
  `src/context/cqe-worker.mjs`, `vendor/context-query-core/`, the
  `context-query-core` dependency and build globs, the `smoke:bun` script, CQE
  benchmarks/tests/helpers, and CQE-first discovery nudges.
- Rewire per-turn retrieval to `selectContext` and `/wam ctx get` to
  `retrieveContext` (native capsules). Drop CQE failure codes, `phase("cqe")` and
  `cqeCalls`/`cqeStats` state.
- Remove the dashboard HTTP server from `index.js`, `isDashboardEnabled` from the
  config module, `WAM_DASHBOARD` / `WAM_DASHBOARD_PORT`, and its tests/docs.
- Update the affected capability specs.

## Out of scope

- Deleting historical evidence under `openspec/evidence/` or archived analysis docs.
- Changing the native retrieval algorithm, capsule model, or context assembly.
- Removing the external `context-query-engine` MCP from the *user's* opencode config
  (that is host configuration, not this plugin).
- Deleting `.wam` task state beyond dropping the obsolete CQE counters.

## Impact

- Breaking only for users that enabled `WAM_DASHBOARD` (off by default) or relied on
  `[cqe]` results in `/wam ctx get` (now native capsules).
- Smaller install, no vendored dependency, no Worker, no listening socket.
