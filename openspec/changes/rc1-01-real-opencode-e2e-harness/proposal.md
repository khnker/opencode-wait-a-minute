# Change: Real OpenCode E2E Harness

## Why
WAM must be proven inside a real OpenCode instance, not only against mocks/unit tests.

## What Changes
- Harness: create temp workspace, install/copy the plugin from the real artifact, start real OpenCode, run a controlled prompt, await WAM signals, capture stdout/stderr/events/.wam/final state/exit code, assert, then clean up.
- Scenarios: basic-task, incomplete-task, assumption-required, continuation, evidence, completion.
- Never substitute the source tree for the published package.

## Non-goals
- Using mocks as the system-under-test.

## Expected Result
`npm run test:e2e` exits 0 and leaves a machine-readable summary.

## Validation
- [ ] `npm run test:e2e` exits 0.
- [ ] Machine-readable summary produced.
- [ ] Each scenario asserts WAM signals.
- [ ] Workspace is cleaned up.

## Program
- RC1 item: RC1-01 (C)
- Priority: P0
