# Tasks: Role-aware skills and stage reporting

## Role skill loading

- [x] Add ordered skills to `ANALYST`, `ARCHITECT`, `BUILDER` and `REVIEWER`.
- [x] Add available fallback skills to specialized engineering and UX roles.
- [x] Add `src/agents/role-skills.js` with registry lookup, missing-skill tolerance and prompt caps.
- [x] Inject loaded skill content into the role system prompt through the invocation adapter.
- [x] Keep the `Preferred skills:` line for traceability.

## Stage reporting

- [x] Add `ROLE_STAGES` and `getRoleStage` to role contracts.
- [x] Add `src/execution/task-stage.js` to derive the current stage from task state and `agentRun.results`.
- [x] Surface the stage in N2 task context.
- [x] Surface the stage in role system prompts.
- [x] Surface the stage in task-loop prompts and loop results.

## Zero-friction continuation

- [x] Pass `contractApproval` into `driveTaskLoop`.
- [x] Treat advisory contracts as approved for loop decisions while preserving `required`.
- [x] Set the global and scrapper project configs to advisory and enable auto-loop.

## Verification

- [x] Unit tests for role skill loading, caps, missing IDs and stage derivation.
- [x] Unit tests for advisory loop continuation and stage prompt text.
- [x] Run affected suites with `node --test --test-force-exit`.
- [x] Run `openspec validate --changes --strict`.
- [x] Run `npm run build` and load-check `dist/`.
- [x] Migrate the E2E approval command to `POST /session/:id/command`.
- [x] Accept advisory contracts in E2E checks and exercise the no-approval path.
- [x] Run fresh-session web verification (`/tmp/opencode/wam-web-e2e-role`, 11/11).
