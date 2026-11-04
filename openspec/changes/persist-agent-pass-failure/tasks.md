# Tasks — persist failed agent passes

- [x] Add `applyAgentFailure(task, message)` in `src/execution/task-agent-run.js`.
- [x] Persist the failure in `runTaskAgentPass`'s catch path with a fresh task read.
- [x] Propagate `failureReason` through `agentSignalForLoop` and the `BLOCK` reason.
- [x] Add regression tests for the persisted failure, the stopped retry, and the reason.
- [x] Run affected tests and `npm run build` + `dist/` load-check.
- [x] Validate the OpenSpec change with `--strict`.
