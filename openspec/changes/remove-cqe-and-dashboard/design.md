# Design: remove-cqe-and-dashboard

## Research

- opencode plugin hooks and lifecycle: <https://opencode.ai/docs/plugins/>. A plugin
  that only needs to react to `chat.message` / `tool.execute.*` does not need to run
  its own HTTP server or worker pool.
- opencode server/session API (the host already exposes session state):
  <https://opencode.ai/docs/server/>.
- Node `worker_threads` (why the CQE path ran in a Worker):
  <https://nodejs.org/api/worker_threads.html>. Removing it removes cross-thread
  lifecycle, warm-up (`warming`) and timeout handling.
- Local prior art: `openspec/specs/cqe-integration/spec.md`,
  `openspec/changes/improve-cqe-failure-diagnostics`,
  `openspec/changes/remove-write-and-ask-gates`.
- Current native fallback already exists: `selectContext`
  (`src/context/context.js:469`) and `retrieveContext` (`:633`), plus
  `assembleContext` (`src/context/assembly.js:197`).
- Project design rule (AGENTS.md): deterministic fallbacks first; LLM/embedding
  dependencies are optional, never required. Native retrieval is deterministic.

## Alternatives considered

### CQE

1. **Keep CQE, flip default to disabled.** Rejected: the vendored dependency, Worker,
   prompts, benchmarks and tests remain; the complexity the user asked to remove stays.
2. **Drop the vendored core but keep `cqe-adapter` against an external MCP.** Rejected:
   the adapter is written for `context-query-core`'s API and result shape; an external
   MCP is host configuration, and keeping a half-adapter preserves dead surface.
3. **Full removal; native retrieval only (chosen).** `selectContext` for the per-turn
   pipeline, `retrieveContext` for `/wam ctx get`. Smallest complete diff, no new
   abstraction.

### Dashboard

1. **Keep the opt-in server.** Rejected: off by default, unused in normal operation, and
   it opened a port during E2E runs.
2. **Remove the server and its config/test surface (chosen).** Session state is already
   available from the host; WAM keeps no HTTP listener.

## Decisions

- `selectContextWithCqe` and `retrieveContextWithCqe` are deleted from
  `src/context/context.js`; the CQE import and failure taxonomy go with them.
- `src/integration/message-handler.js` calls `selectContext` directly and drops the
  `cqe` phase and the `cqeCalls`/`cqeStats` persistence.
- `index.js` stops importing CQE, stops forwarding it into the message-handler deps,
  removes the CQE-first discovery nudge, and rewires `/wam ctx get` to
  `retrieveContext` (prefix `[wam-native]`).
- The dashboard block in `index.js` (server creation, HTML, `listen`) and
  `isDashboardEnabled` in `src/config/wam-config.js` are deleted; `WAM_DASHBOARD` and
  `WAM_DASHBOARD_PORT` are no longer read.
- Discovery nudges/policies that advertise CQE are rewritten to native tools; the
  `discovery-nudge` requirement is modified accordingly.

## Risks

- `/wam ctx get` output changes: CQE file hits disappear; only capsule hits remain. This
  matches the native contract and is recorded in the change report.
- Removing `vendor/context-query-core/` is irreversible in the diff but recoverable from
  git history.
- `WAM_DASHBOARD` users lose the UI. It was off by default; documented as a breaking
  change.
- The large test/benchmark deletion must not take down unrelated suites; verify with the
  affected test runner plus `npm run build`.
