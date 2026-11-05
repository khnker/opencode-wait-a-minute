## Why

Fresh-session web verification is mandatory for behavioral changes, but it is
currently performed by hand: start a server, create a session, approve the
contract, watch the loop, and paste fragments of output into a report. That is
slow, easy to skip, and leaves no reproducible audit trail.

## What Changes

- Add `scripts/verify-web-e2e.ts`, a dependency-free TypeScript runner that:
  - creates an isolated fixture with its own `.wam/config.json`;
  - starts a fresh `opencode web` on a free loopback port;
  - creates a session, sends a deterministic implement prompt and approves the
    contract in test mode;
  - polls the task and loop state until completion, failure or timeout;
  - asserts the audit checks and writes `report.json`, `report.md`, the plugin
    log, server log, task state, loop events and child-session summaries.
- Add `npm run verify:web`.
- Add unit tests for the pure helpers (argument parsing, config, check
  evaluation, task selection, redaction, markdown report).
- Document the report schema and exit codes in the change design.

## Impact

- New files only; no runtime plugin code changes.
- Requires Node >= 22.6 for native TypeScript type stripping; `package.json`
  `engines` is aligned to `>=22.6` so the documented command always runs on a
  supported runtime.
- Never reads or writes the project `.wam`; all state lives in an OS temp
  fixture and a report directory.
- Report output defaults to the durable in-repo path
  `openspec/evidence/web-e2e/<runId>` so runs are auditable; `--ephemeral`
  keeps the old OS temp location for local smoke runs.
