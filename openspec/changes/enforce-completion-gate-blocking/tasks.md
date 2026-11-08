# Tasks

## Phase 1: Configuration

- [x] 1.1 Add `completionGate: { enforce: false }` to `DEFAULT_WAM_CONFIG`
- [x] 1.2 Parse `completionGate.enforce` from file, `WAM_COMPLETION_GATE` and `WAM_COMPLETION_GATE_ENFORCE`
- [x] 1.3 Pass `completionGate` through the plugin config in `index.js`

## Phase 2: Gate behavior

- [x] 2.1 Honor `options.enforce` in `evaluateCompletionGate`, keeping the advisory path unchanged
- [x] 2.2 Merge quality-contract reasons without duplicates when enforcing
- [x] 2.3 Emit a directive message from `buildCompletionValidation` for a blocked gate

## Phase 3: Wiring

- [x] 3.1 Inject the gate notice for `gate.blocked` in `message-handler`
- [x] 3.2 Thread the enforce flag into the message-handler gate calls
- [x] 3.3 Thread the enforce flag into `driveTaskLoop` and the auto-continuation planner
- [x] 3.4 In enforce mode, emit only the block directive (no contradictory advisory) and never
  suppress a repeated blocked DONE

## Phase 4: Tests

- [x] 4.1 Add a unit test: enforce blocks an unverified DONE claim
- [x] 4.2 Add a unit test: enforce allows a fully verified DONE claim
- [x] 4.3 Add a unit test: the default advisory behavior is unchanged
- [x] 4.4 Add a unit test: the blocked validation is directive, not a recommendation
- [x] 4.5 Add a regression test: enforce emits no "Recomendación: faltan"/"procedo" and re-blocks repeated DONE
- [x] 4.6 Fix the allowed-DONE path: a DONE claim with `allDone` must not take the continuation fast-path

## Phase 5: Validation

- [x] 5.1 Run the affected suites with `node --test --test-force-exit`
- [x] 5.2 Run `openspec validate --changes --strict`
- [x] 5.3 Run `npm run build` and load-check `dist/`
- [x] 5.4 Run the real opencode end-to-end check described in the report
- [x] 5.5 Re-run the web check with a fully verified task: DONE reaches `phase: DONE` and emits the completion notice
