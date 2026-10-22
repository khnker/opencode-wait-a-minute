# Tasks: WAM-OpenCode Real Interaction Validation
## Implementation
- [x] Refine `tests/e2e/opencode/smoke.mjs` to robustly handle transient failures in model backend interaction.
      Transient = stalled backend (no output/exit), non-zero exit without plugin error, or an answer without the
      expected payload. Retried up to `MAX_ATTEMPTS = 3` with a 3s backoff; environment problems (missing binary)
      and plugin crashes are **not** retried. Attempt count is reported in the summary.
- [x] Add explicit validation of `plugin.on` hook registration within the smoke test.
      The E2E adapter wraps `input.plugin` to record `plugin.on(...)` calls and captures the hook map returned by
      the plugin factory; both are written to `WAM_E2E_HOOKS`. The harness asserts that `chat.message`,
      `tool.execute.before` and `tool.execute.after` are registered.
- [x] Ensure `.wam/` state directory creation and lifecycle management are validated in the E2E environment.
      The harness no longer pre-creates `.wam/` (that would mask creation by the plugin). It locates the state
      directory under the real project root and asserts both creation and lifecycle artifacts
      (`active-task` / `tasks/` / `task-state.json`). The state root is `input.directory` — `WAM_HOME` is not read
      by the runtime, so the previous check against `$WAM_HOME` was validating the wrong directory.
- [x] Verify `check-compatibility.mjs` logic against the compatibility matrix fixture (`compatibility-matrix.mjs`).
      Verified empirically: the Node axis is always enforced (`>=20`), the OpenCode axis is only enforced when a
      minimum is supplied (`--min-opencode`) because the matrix declares `opencode.minimum: null` (undetermined).
      The gap between the documented `1.18.0` minimum and the unenforced matrix value is now documented.
- [x] Add documentation in `docs/OPENCODE_COMPATIBILITY.md` for any discovered versioning constraints.
      Documented: hook registration is a returned hook map (not `plugin.on`), the 1.19 `chat.message` payload carries
      no user text, the project directory is resolved from `PWD` (the E2E must override it), `WAM_HOME` is inert,
      the OpenCode version axis is not machine-enforced, and the transient-backend retry policy.
## Validation
- [x] Run `npm run test:e2e:opencode` and confirm deterministic pass.
      `VERDICT: pass` — artifact loaded from the packed tarball, hooks registered
      (`chat.message, command.execute.before, tool.execute.before, tool.execute.after`) and `.wam/` created with
      lifecycle artifacts (`active-task`, `tasks/`, `task-state.json`).
- [x] Run `node scripts/check-compatibility.mjs` and verify it correctly detects version mismatches.
      Rejects `--node 18.0.0` and `--min-opencode 1.18.0 --opencode 0.9.0` with a non-zero exit; accepts the
      current runtime and `--min-opencode 1.18.0 --opencode 1.19.0`.
- [x] `openspec validate wam-opencode-real-interaction-validation --strict` passes.
      Fixed the change spec delta headers (`## ADDED Requirements` + SHALL/MUST statements) so the change
      validates.
