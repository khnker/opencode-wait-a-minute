# Enforce and Surface Completion-Gate Blocking

## Why

The completion gate already computes a hard verdict
(`evaluateCompletionGateStrict` in `src/integration/orchestration.js`), but the
public wrapper downgrades every blocked verdict to `blocked: false,
advisory: true` and the chat handler only injects a notice when
`gate.advisory` is true. The result is that a DONE claim with unverified
requirements, failed criteria, or insufficient quality evidence produces no
visible rejection and the loop can be treated as complete.

The existing archived design (`enforce-task-specific-quality-contracts`)
deliberately keeps the strict behavior opt-in so conversational sessions are not
blocked. This change keeps that contract and makes the opt-in actually reach the
user and the loop: when enabled, a blocked gate stays blocked and the agent is
told, in the response, what is missing.

## What Changes

1. Add `completionGate.enforce` (default `false`) to `loadWamConfig`, with
   `WAM_COMPLETION_GATE` / `WAM_COMPLETION_GATE_ENFORCE` overrides.
2. `evaluateCompletionGate(state, promptText, options)` returns the strict
   `blocked: true` verdict when `options.enforce === true`; without the flag the
   current advisory downgrade is byte-for-byte unchanged.
3. `buildCompletionValidation` emits a directive (⛔) message for a blocked gate
   instead of the "proceed" recommendation.
4. The chat handler injects the gate notice for `gate.blocked` as well as
   `gate.advisory`, and threads the configured enforce flag.
5. The task loop adapter and the auto-continuation planner receive the enforce
   flag so the persisted decision and the re-drive prompt agree.

## Impact

- Affected specs: `completion-gate-adversarial`, `task-quality`.
- Affected code: `src/config/wam-config.js`,
  `src/integration/orchestration.js`, `src/integration/message-handler.js`,
  `src/adapters/opencode-v1/session-driver.js`, `index.js`.
- No change to default behavior: `completionGate.enforce` is off by default and
  the quality-contract evaluation still only runs when `qualityContracts.enabled`
  is on.

## Success Criteria

- With `completionGate.enforce=true`, a DONE claim with an unverified
  requirement returns `blocked: true` and the injected validation contains the
  missing reasons and a directive to continue.
- With the flag on and every requirement verified, the gate returns
  `allDone: true` and does not block.
- With the flag off, the existing advisory behavior and tests are unchanged.
- The blocked verdict is visible in the chat response and the task-loop decision
  is not `COMPLETE`.
