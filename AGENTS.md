# AGENTS.md — wait-a-minute-plugin

## Mandatory change workflow

Every non-trivial change follows this order:

1. **Research**: search current best practices (official docs, papers, vendor docs) for the problem.
2. **Evaluate alternatives**: record at least two options, the chosen one and why the others were rejected.
3. **Spec first**: create/update an OpenSpec change under `openspec/changes/<change>/` with
   `proposal.md`, `design.md` (including the research links and alternatives), `tasks.md`
   and `specs/<capability>/spec.md`.
4. **Implement**: keep the smallest complete diff; no dead code, no unrequested abstractions.
5. **Test**: add regression tests for new behavior; run affected suites with
   `node --test --test-force-exit <files>`. Every behavioral change also needs a
   fresh-session web verification (see below); unit tests alone are not enough.
5b. **Craftsman review**: audit the diff against the `craftsman` skill's Diff Audit
   (KISS, DRY, clean) before validating; fix violations or record accepted
   exceptions in the change report. This review is part of "done".
6. **Validate**: `openspec validate --changes --strict`, `npm run build`, and load-check `dist/`.
7. **Report**: files changed, tests run, residual risks.

## Project commands

```bash
npm run build                 # copy index.js, package.json, src/, skills/, prompts/, vendor/ to dist (POSIX cp)
npm run verify:web -- --out <tmp>  # fresh opencode web E2E; writes report.json/report.md
npm run validate              # release gate (full suite; slow)
node scripts/run-tests.mjs    # full suite with force-exit
node scripts/prune-wam-artifacts.mjs --apply  # archive one-use test tasks/snapshots
```

Prerequisites: Node >= 22.6 and the sibling `../context-query-core` checkout
(`context-query-core` is a `file:` dependency).

Tests live in `tests/` (legacy, e2e, isolation), as `test-*.mjs` at the repo root and as
`src/**/*.test.js`. Per-file runs use `node --test --test-force-exit <files>`.

## Release base condition (mandatory)

A release is blocked until all of these pass on the exact code being released:

1. `npm run build` (the packed tarball must contain the built output).
2. `npm run verify:release` — packs the tarball, installs it into an isolated
   test-user HOME/XDG, starts a **new** `opencode web` instance that loads only the
   installed package (never this checkout), and drives the real UI with Playwright
   (prompt → assistant response → rendered text → `.wam` task/contract state).
   It writes `report.json`/`report.md`.
3. `npm run gate` (RC1 unified gate; includes `verify:release` as a required gate
   outside GitHub Actions).

Do not tag, push or publish when any step fails. The release note must record the
installed version, the report path and the server URL.

If the public free-model quota is exhausted, point the isolated E2Es at a local
OpenAI-compatible endpoint instead of copying credentials:

```bash
WAM_RELEASE_MODEL=<provider/model> WAM_RELEASE_BASE_URL=<url> \
WAM_E2E_MODEL=<provider/model> WAM_E2E_BASE_URL=<url> npm run gate
```

`WAM_RELEASE_API_KEY` / `WAM_E2E_API_KEY` are optional (default `x`).

Requirements: Node >= 22.6, `opencode` in PATH, Playwright with Chromium
(`npm i -g playwright && playwright install chromium`), and the sibling
`../context-query-core` checkout. The isolated test user does not copy real
credentials or secrets.

## Fresh-session web verification (mandatory)

Every behavioral change MUST be verified in a **fresh** `opencode web` instance, not only
with unit tests. The canonical automated check is:

```bash
npm run verify:web -- --out /tmp/wam-web-e2e-<run>
```

It creates an isolated fixture, starts a new server, approves the contract, drives the
real agent loop, and writes `report.json`/`report.md` with checks, timeline, roles,
artifacts and redacted logs. A change is not validated if this command has not been run
against the final code (or, if it cannot run, the manual procedure below was followed and
the reason recorded in the change report).

1. Create an isolated fixture project (e.g. a temp dir) with its own `.wam/config.json`.
   Never point the test server at the live project's `.wam`.
2. Start a new server process with the fixture as cwd (a process started before the
   change is not valid):
   `opencode web --port <free> --hostname 127.0.0.1`
3. Drive it with Playwright (new session, fill `[aria-label="Prompt"]`, press Enter,
   assert the rendered body) or with `curl` against the same base URL
   (`GET /session`, `GET /session/<sid>/message`, ...). Assert both the rendered UI and
   the persisted messages/parts.
4. Stop the server, remove the fixture, and record the URL, scenario and evidence in the
   change report.

## Runtime notes

- Logging is off by default; enable with `WAM_LOGGING=true` or `"logging": true`.
  `plugin.log` rotates at 5 MB.
- The sessions dashboard is off by default; enable with `WAM_DASHBOARD=true`
  (optional `WAM_DASHBOARD_PORT`, default 4321).
- Tests must not write to the project `.wam`; the test runner disables logging and
  redirects `WAM_LOG_FILE`, `WAM_METRICS_DIR` and `WAM_SESSION_DIR` to the OS temp directory.
- To run the suite while a live WAM session uses the project, use
  `node scripts/run-tests-isolated.mjs` (throwaway copy with its own `.wam`).
- `/wam off` bypasses WAM for the current session; `/wam on` restores it.

## Design rules

- Deterministic fallbacks first; LLM/embedding dependencies are optional, never required.
- Validate at trust boundaries; fail loud on corrupt state, fail soft on diagnostics.
- Keep user prompts immutable; injected context is synthetic and tagged.
- Prefer bounded structures (logs, recent changes, memory) over unbounded growth.

## Delegation rules

- Independent work runs in parallel subagents, never serialized in the orchestrator.
- Search, exploration and any read-only lookup go to the fast tier.
- Coding goes to the tier that matches the diff: trivial edits and file reads to the fast
  tier, multi-file or logic changes to the medium tier; heavy only for architecture and
  deep debugging.
- Sequential only when a step depends on another step's output.
