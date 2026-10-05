# Design: Real OpenCode E2E Harness

## Approach
WAM must be proven inside a real OpenCode instance, not only against mocks/unit tests.

## Scope
- Harness: create temp workspace, install/copy the plugin from the real artifact, start real OpenCode, run a controlled prompt, await WAM signals, capture stdout/stderr/events/.wam/final state/exit code, assert, then clean up.
- Scenarios: basic-task, incomplete-task, assumption-required, continuation, evidence, completion.
- Never substitute the source tree for the published package.

## Validation Strategy
- `npm run test:e2e` exits 0.
- Machine-readable summary produced.
- Each scenario asserts WAM signals.
- Workspace is cleaned up.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
