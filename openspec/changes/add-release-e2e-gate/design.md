# Design: add-release-e2e-gate

## Research

- npm pack/install contract: <https://docs.npmjs.com/cli/v10/commands/npm-pack>
  and <https://docs.npmjs.com/cli/v10/commands/npm-install>.
- Playwright browser automation: <https://playwright.dev/docs/intro> and
  <https://playwright.dev/docs/api/class-locator>.
- opencode web server and routes: the installed `opencode` CLI
  (`opencode web --port <p> --hostname 127.0.0.1`) and its session API
  (`GET/POST /session`, `GET /session/<id>/message`).
- Existing install-path reference: `tests/e2e/opencode/smoke.mjs` (pack,
  install, adapter, isolated env).
- Existing web-session reference: `scripts/verify-web-e2e.ts` (fixture config,
  server readiness, polling and WAM artifact checks).

## Pipeline

1. `npm pack` the working tree; the tarball is the only source of plugin code.
2. Install the tarball into a throwaway app with `npm install --ignore-scripts`.
3. Write a thin adapter that imports the installed package `main` and touches a
   marker file when opencode loads it, then re-exports the plugin as `default`.
4. Create a fixture project with `.wam/config.json` (logging on, enforcement on,
   `contractApproval: "advisory"`, `autoLoop: false`, task loop enabled) and an
   `opencode.json` that registers only `./wam-release-entry.js`.
5. Create an isolated test-user HOME with its own
   `XDG_CONFIG_HOME/DATA_HOME/STATE_HOME/CACHE_HOME`. No real config,
   credentials or caches are copied.
6. Spawn a new `opencode web` process with the fixture as cwd and the isolated
   environment.
7. Drive the UI with Playwright: open the project through the folder picker,
   create a session, type the prompt and send it.
8. Poll the session API for the first completed assistant text; assert the UI
   renders a plain fragment of it.
9. Assert the installed-plugin marker, the `.wam/tasks/*/task.json` state and a
   contract that is not `REJECTED`.
10. Write `report.json` / `report.md` and exit `0` only when every required
    check passes. Exit `2` for setup/infrastructure failures.

## Decisions

- **Playwright against the installed package.** The release artifact is the
  tarball, so the test must not import the checkout.
- **Isolated HOME/XDG.** This avoids the user's global plugins, credentials and
  provider configuration; the default model works without a key.
- **Folder-picker navigation.** The web UI starts at HOME and requires a project
  to be opened before a session can be created. The picker's folder search
  accepts the absolute fixture path; the test waits for the folder list to
  finish loading before selecting the entry.
- **Plain-text UI fragment.** Assistant messages are markdown; the assertion
  strips emphasis/list/heading markers so it checks rendered text, not raw
  markdown.
- **Free port + process-group kill.** Avoids collisions and orphaned servers.
- **No `--auto`.** `opencode web` does not accept that flag; the fixture grants
  `edit`, `bash` and `webfetch` permissions instead.
- **Hidden directories are not test roots.** An old root-owned `.dist-root-old/`
  backup made the full suite discover unreadable copies and fail with EACCES.
  `collectTests` now skips any dot-directory; real suites live under `tests/`,
  `src/` and `scripts/`.
- **Advisory contract.** The test records the contract state and requires it not
  to be rejected; it does not require a human approval step.
- **Strict DONE gets a 15-minute budget.** It re-runs the full unit suite
  independently, so the gate's 120s default killed it under load with SIGTERM.
  The 900s explicit timeout keeps the C1 check honest without a false failure.
- **Pin a reliable free model.** The isolated test user has no credentials, so
  the release E2E uses a public free model. `opencode/big-pickle` can return an
  empty assistant turn and stall the poll; the fixture now pins
  `opencode/beam-free` (override with `WAM_RELEASE_MODEL`). If the free quota
  is exhausted, local validation can point the isolated fixture at a local
  OpenAI-compatible endpoint with `WAM_RELEASE_BASE_URL` /
  `WAM_RELEASE_API_KEY`; the smoke E2E mirrors this with `WAM_E2E_*`. The
  fixture still contains no copied credentials.
- **Small deterministic prompt.** The E2E asks for a single `hello.txt` write and
  verification. A full coding task drives the multi-agent loop and becomes slow
  and flaky under load; the gate only needs a real prompt, a rendered assistant
  response, and a `.wam` task/contract. The simpler prompt finishes in seconds
  while still exercising the installed plugin.

## Risks

- The web UI is a moving target; the folder-picker and prompt selectors are
  pinned to user-visible roles/labels and fail loudly if they change.
- Playwright/Chromium is an external prerequisite. The script fails with a
  clear setup error (exit 2) when it is missing.
- The default model is remote; the prompt is bounded and the timeout is
  configurable.

## Verification

- `node --check scripts/verify-release-e2e.mjs`.
- `npm run verify:release -- --out /tmp/wam-release-final` (13/13, ~30s).
- `openspec validate add-release-e2e-gate --strict`.
- `npm run build`; `npm run gate`.
