# Integrate Impeccable Frontend UX — Design

## Goal

Add an optional, opt-in frontend UX capability backed by Impeccable while preserving WAM's task lifecycle, orchestration, and outcome-based completion contract.

## Data Model

- `wam.capabilities.frontendUx.state`: `"unavailable" | "available-but-disabled" | "enabled"`
- `wam.capabilities.frontendUx.impeccable`: `{ license, revision, commands, installMechanism }`
- `task.isFrontendUx`: boolean flag derived from task description/prompt compatibility.
- `task.uxCapability`: optional reference to Impeccable's generated plan when capability enabled and task eligible.

## Architecture & Flow

1. **Initialization**: On startup, probe for Impeccable via `npx impeccable --version`. If not found, set state to `unavailable`.
2. **Explicit Opt-In**: User runs `npx impeccable install --wam` to expose the frontend UX extension points. This writes WAM's capabilities discovery manifest and changes state to `available-but-disabled`.
3. **Task Handling**: When a task is classified (`task.isFrontendUx`), evaluate:
   - If capability unavailable → fallback, return explicit status `"frontendUx.unavailable"` in outcome.
   - If capability disabled → fallback, return `"frontendUx.disabled"`.
   - If enabled → delegate via `npx impeccable run` producing a plan; WAM executes this plan as part of task execution but keeps control of outcome verification and completion gating.
4. **State Preservation**: All Impeccable state and user config are stored under `.impeccable` in the user's home directory; WAM does not write over user config.
5. **Completion Gate**: The existing `approveContract` and `completeTask` gates remain unchanged. Impeccable plan execution is wrapped in a "capability extension" context that still produces the same outcome contract (no changes to DONE semantics).

## Integration Points

- `engine.js`: add a wrapper in the task orchestration chain that checks the capability state before proceeding.
- `index.js`: expose a CLI endpoint `wam frontend-ux-status` for users to see current state and configuration.
- `state.taskContext`: add a field `frontendUx.capabilityStatus` to report the current integration state in task outcome.

## CLI Commands

- `wam frontend-ux:status` – show integration state (unavailable/available-but-disabled/enabled), license, revision.
- `wam frontend-ux:enable` – run `npx impeccable install --wam` and switch state to `available-but-disabled`.
- `wam frontend-ux:activate` – enable capability, load commands, switch state to `enabled`.
- `wam frontend-ux:disable` – revert to `available-but-disabled`; does NOT uninstall user Impeccable.
- `wam frontend-ux:deactivate` – uninstall using `npx impeccable uninstall --wam`; revert to `unavailable`.

## Implementation Notes

- All file operations are done under a dedicated directory `~/.wam/impeccable/` to isolate WAM's integration config from user's own Impeccable usage.
- No network downloads at task time; all static commands and dependencies are resolved at install time.
- Only run Impeccable commands through child process with WAM's default execution context (no privileged operation).
- Do not add Impeccable as a direct dependency in `package.json`; require `--optional` or skip installation if not present.
- When capability is disabled or unavailable, the system falls back to the default WAM execution path, but must report the status in the task outcome for transparency.
