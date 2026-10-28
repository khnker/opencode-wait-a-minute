# Change: Permission Preflight Before Delegation

## Objective

WAM must collect and request every access permission an approved task needs
(`edit`, `bash`, `webfetch`, `external_directory`) at the start, before the
main session issues any `task` (subagent) tool call. Today a delegated subagent
can hit a permission prompt mid-flight, after the orchestrator already spent
context on the dispatch, and the user has no single place to approve or deny the
task's access surface.

## Scope

- New pure policy module `src/policy/permission-preflight.js`.
- New `permission.ask` hook that auto-allows only explicitly granted types.
- `tool.execute.before` blocks `task` delegation while the plan is pending.
- Plan is surfaced in the injected context and persisted in task state.
- `/wam permissions approve|deny|status` CLI.
- `permissionPreflight` runtime flag (default true).
