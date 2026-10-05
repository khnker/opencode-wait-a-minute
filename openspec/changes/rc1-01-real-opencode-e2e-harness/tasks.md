# Tasks

## Implementation
- [ ] Harness: create temp workspace, install/copy the plugin from the real artifact, start real OpenCode, run a controlled prompt, await WAM signals, capture stdout/stderr/events/.wam/final state/exit code, assert, then clean up.
- [ ] Scenarios: basic-task, incomplete-task, assumption-required, continuation, evidence, completion.
- [ ] Never substitute the source tree for the published package.
- [ ] `npm run test:e2e` exits 0.
- [ ] Machine-readable summary produced.
- [ ] Each scenario asserts WAM signals.
- [ ] Workspace is cleaned up.

## Validation
- [ ] Run the change's objective validation and paste the output.
- [ ] `openspec validate rc1-01-real-opencode-e2e-harness --strict` passes.
