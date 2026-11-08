# Production-Safe Runtime Defaults

## Why

A production install of `opencode-wait-a-minute` currently starts a local HTTP dashboard on port 4321 during plugin initialization and defaults `logging` to `true`. On a normal user machine this opens an unrequested web server that exposes active session and task state, and it can surface `[WaitAMinute]` console output by default.

## What Changes

- Default `logging` to `false`; `WAM_LOGGING=true`, config `logging: true`, or the existing silent overrides still control it.
- Start the sessions dashboard only when explicitly enabled with `WAM_DASHBOARD=true` (or `1`).
- Keep `WAM_DASHBOARD_PORT` for opt-in users.
- Add deterministic tests for the default and opt-in paths.

## Non-Goals

- Removing the dashboard.
- Changing WAM task state, contracts, or validation behavior.
- Changing the `opencode web` server that ships with opencode itself.
