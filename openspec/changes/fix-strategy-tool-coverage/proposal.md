# Proposal: Fix strategy tool coverage and orphan execution gates

## Problem Statement

Session `ses_e47f908c0ffeSaZBEXMNAsS2Eb` (project `wam-core`) stalled with
`STOP_STAGNATION` and the agent reported
`[wait-a-minute] STRATEGY VIOLATION: no-matching-capability` while inspecting
the repository. Two independent defects produce the false violation and the
blocked-feeling session:

1. **Incomplete default allowlist.** `approveContract()` persists an
   `approvedStrategy.allowedActions` list that mixes natural-language steps
   (`modify source`, `run validation`) with tool names. The host tool names
   `glob`, `grep`, `list` and `webfetch` are absent, so ordinary read-only
   inspection is classified as `no-matching-capability` and a strategy
   violation directive is emitted for every such call.
2. **Broken fallback classifier.** `classifyActionAgainstStrategy` has a
   self-contained fallback used when the function is extracted with
   `new Function(...)` by the autonomy suite. It builds the candidate as
   `{ executable: args }` and never sets `args`, so `command.execute`
   capabilities never match the real executable/argv and can dereference
   `undefined`.
3. **Orphan execution gate.** A persisted `executionGate.active=true` owned by
   the current process is only released on the next turn/idle event or when a
   *different* pid owns it. If the owning loop reached a terminal state
   (`STOPPED`/`COMPLETED`) without a pass in flight, mutations stay blocked for
   the rest of the turn.

## Proposed Solution

- Extend the default `allowedActions` with the ordinary host tools the agent
  uses: `read`, `glob`, `grep`, `list`, `webfetch`, `patch`, `multiedit`,
  `apply_patch`, `todoread`, `skill`, `question`.
- Build the fallback candidate from the already-derived `executable` and
  `argv` instead of the raw `args` object.
- Release a same-process execution gate when its persisted loop status is
  terminal (`STOPPED`/`COMPLETED`) and no agent pass is in flight.

Prohibited actions keep failing closed: the change only covers ordinary tools,
never the `prohibitedActions` list.

## Acceptance Criteria

- [ ] `approveContract()` persists an allowlist that covers `read`, `glob`,
      `grep`, `list`, `webfetch`, `write`, `edit`, `bash`, `task` and
      `todowrite`.
- [ ] The extracted fallback classifier covers `npm test` and `git status`
      (executable + argv) and rejects `npm publish`.
- [ ] Prohibited actions still return `covered: false`, including when invoked
      through an otherwise-covered tool (`bash`).
- [ ] A same-process active gate is released when the loop status is `STOPPED`
      or `COMPLETED` and no agent pass is in flight.
- [ ] A same-process active gate still blocks while the loop is `RUNNING`.

## Non-goals

- No change to `prohibitedActions` semantics or the risk envelope.
- No redesign of the stagnation detector or the loop fingerprint.
- No new runtime dependency.

## Impact

- Affected code: `index.js`, `src/execution/execution-gate.js`.
- Affected tests: `tests/unit/allowed-actions-default.test.mjs`,
  `tests/unit/execution-gate.test.mjs`,
  `tests/unit/execution-gate-hook.test.mjs`, new
  `tests/unit/strategy-tool-coverage.test.mjs`.
- Backward compatible: existing approved strategies keep working; the fallback
  matcher becomes strictly more accurate.
