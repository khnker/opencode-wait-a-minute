## Context

`AGENTS.md` requires a fresh `opencode web` session for every behavioral change,
with a URL, scenario and evidence in the change report. The validated 2026-11-04
timeout fix was verified manually on port 5011 with a fixture under `/tmp`; the
same sequence must be repeatable and auditable.

Relevant facts gathered from the repo:

- `package.json` has `"type": "module"`, no devDependencies, no TypeScript, and
  no Playwright package. Node in this environment is v24.16.0.
- `scripts/test-e2e.mjs` only shells out to Playwright/package checks; it does
  not start a fresh server or drive the WAM loop.
- `scripts/run-real-wam-flow.mjs` calls the plugin in-process with a temp
  directory; it does not exercise the web server or a real session.
- The web server exposes `GET /session`, `POST /session`, and
  `POST /session/{id}/message` (OpenAPI at `/doc`). The legacy prompt endpoint
  returns the assistant message `{ info, parts }`; provider failures appear on
  `info.error`.
- `src/config/wam-config.js` defaults `taskLoop.agents.enabled` to `false`; the
  fixture must enable it.
- `npm run build` copies `index.js`, `package.json`, `src/`, `skills/`,
  `prompts/` and `vendor/` to `dist/`; `scripts/` is not copied.

## Research

- Node.js native TypeScript support (type stripping, `.ts` entry points):
  https://nodejs.org/api/typescript.html
- Node.js test runner `.ts` imports:
  https://nodejs.org/api/test.html
- OpenCode server API (local OpenAPI at `/doc`; session and message endpoints):
  https://opencode.ai/docs/server/
- Repo rule: fresh-session web verification is mandatory (`AGENTS.md`,
  "Fresh-session web verification").

## Alternatives

1. **Shell/Node `.mjs` script.** Rejected: the user asked for TypeScript and the
   report/state types make the script easier to audit; Node 24 strips types
   without a build step.
2. **Add Playwright and drive the UI.** Rejected: adds a heavy dependency and
   browser install, while the HTTP API already exposes the same session,
   message, task and loop state deterministically. The UI adds flakiness without
   increasing audit coverage.
3. **Reuse `scripts/run-real-wam-flow.mjs` in-process.** Rejected: it bypasses
   the web server, the session lifecycle and the worker that owns the loop, so
   it cannot reproduce the original failure.
4. **Dependency-free TypeScript runner over the HTTP API.** Chosen: matches the
   real path, needs no new packages, and can emit a complete evidence bundle.
5. **Keep `engines.node: ">=20"` and ship a precompiled `.mjs` runner.**
   Rejected: it would duplicate the 1000-line source, add a build/transpile step
   with no TypeScript dependency available, and drift from the TS source. Node 20
   reached end of life on 2026-04-30, so aligning `engines` to `>=22.6` (the
   native type-stripping floor) is the smaller, honest change. The runner still
   fails loudly with exit code 2 on older runtimes.
6. **Keep reports under `/tmp` and copy them manually.** Rejected: prior audit
   could not re-verify the documented PASS because `/tmp` artifacts disappeared.
   Defaulting to `openspec/evidence/web-e2e/<runId>` makes every run auditable
   from the repository; `--ephemeral` preserves a fast local smoke mode.

## Architecture

Single file `scripts/verify-web-e2e.ts`:

- Pure, exported helpers: `parseArgs`, `buildFixtureConfig`, `pickTaskDir`,
  `evaluateChecks`, `redactSecrets`, `renderMarkdown`, `summarizeSession`.
- `main()` guarded by `import.meta.url === pathToFileURL(process.argv[1]).href`
  so unit tests can import the helpers without launching a server.
- HTTP helper with per-request `AbortSignal.timeout`, explicit status checks and
  response-size limits.
- Server supervision: `spawn("opencode", ["web", ...], { cwd: fixture,
  detached: true })`, readiness poll on `/session`, `SIGTERM` then `SIGKILL`.
- Fixture: `mkdtemp`, `.wam/config.json`, `README.md`, git init/commit (best
  effort), prompt asking for `add.js` + `add.test.mjs`.
- Flow: create session → send prompt → wait for `contract.status` → send
  `/wam contract approve` (test mode) → poll task/loop until terminal or
  timeout → collect child sessions and messages.
- Report directory defaults to the durable in-repo path
  `openspec/evidence/web-e2e/<runId>` so reports can be committed with the
  change. `--out` overrides it and `--ephemeral` uses
  `<os.tmpdir()>/wam-web-e2e/<runId>` for local smoke runs. `--keep` keeps the
  fixture.

## Checks

Required checks (exit 0 only if all pass):

1. `server-ready` — `/session` answered before the deadline.
2. `session-created` — a session ID was returned.
3. `contract-approved` — task contract is `APPROVED`.
4. `agent-pass-ran` — at least one WAM role session or result exists.
5. `agent-pass-settled` — execution gate is inactive and `agentRun.status` is
   non-null.
6. `loop-complete` — phase `DONE` and every requirement is `verified`/`done`.
7. `failure-surfaced` — if the pass failed, `failureReason` is non-empty.
8. `no-empty-response` — `failureReason` does not contain
   `agent response is empty`.
9. `artifacts-present` — `task.json` and `loop-state.json` were captured.

Informational checks: child roles observed, duration, server/plugin log paths.

## Audit report

`report.json`:

```ts
interface RunReport {
  schemaVersion: 1;
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  exitCode: 0 | 1 | 2;
  options: RunOptions;
  environment: {
    node: string;
    opencode: string;
    gitCommit: string | null;
    gitDirty: boolean;
    platform: string;
  };
  fixturePath: string;
  reportDir: string;
  server: { pid: number | null; port: number; baseUrl: string; logPath: string };
  session: { id: string | null; prompt: string; approvalPrompt: string };
  timeline: Array<{ at: string; event: string; detail?: unknown }>;
  task: unknown;
  loop: unknown;
  sessions: SessionSummary[];
  checks: CheckResult[];
  artifacts: Record<string, string>;
  logTail: string;
}
```

`report.md` mirrors it with a checks table, timeline, role results and artifact
index. Log copies are redacted for `authorization`, `api-key`, `bearer`,
`token`, `secret`, `password` and common key prefixes.

## Exit codes

- `0`: every required check passed.
- `1`: the run completed but at least one required check failed.
- `2`: setup/runtime error (server did not start, fixture missing, Node too old).

## Risks

- The model router is external; a provider outage produces a failed run. The
  report preserves the provider message (`agent session error: ...`) instead of
  masking it as an empty response.
- Native type stripping requires Node >= 22.6. The script checks
  `process.versions.node` and exits `2` with the exact requirement.
- Port selection races are possible; the script retries once with a new port.

## Verification

Run on 2026-11-05 with the real binary:

```bash
npm run verify:web -- --out /tmp/wam-web-e2e-final6 --timeout 300000
```

- Server: `http://127.0.0.1:34875` (fresh process, fixture cwd)
- Run: `2026-11-05T00-08-25-893Z-cd319b88`
- Result: PASS, 9/9 checks (`server-ready`, `session-created`,
  `contract-approved`, `agent-pass-ran`, `agent-pass-settled`, `loop-complete`,
  `failure-surfaced`, `no-empty-response`, `artifacts-present`)
- Environment: Node `24.16.0`, opencode `1.19.4`
- Evidence (durable, in-repo):
  `openspec/evidence/web-e2e/2026-11-05T00-08-25-893Z-cd319b88/report.json`
  and `report.md`, plus redacted `server.log`, `plugin.log`, `sessions.json`,
  `task.json` and `loop-state.json`.
- Fixture: `autoLoop: false` isolates the task-agent loop from the post-DONE
  auto-continuation, whose competing idle prompt is a separate behavior.
- Cleanup: fixture removed, server stopped; no project `.wam` writes.

Earlier exploratory runs used `/tmp` and were not retained; the durable default
path above replaces them so future runs can be audited from the repository.
