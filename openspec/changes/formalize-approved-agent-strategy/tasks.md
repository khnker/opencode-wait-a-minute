# Tasks: Formalize the Approved Agent Strategy

## 1. Strategy module

- [x] Create `src/agents/approved-strategy.js` with
  `APPROVED_STRATEGY_VERSION = 1`.
- [x] Implement `buildApprovedStrategy({ decisions, constraints })` returning a
  frozen, deterministic strategy.
- [x] Implement `assertApprovedStrategy(strategy)` throwing `RoleContractError`
  with stable issues for invalid versions, sources, decisions and constraints.
- [x] Reject unknown keys and non-array fields; reject duplicate decision ids.

## 2. Orchestrator integration

- [x] Maintain `approvedStrategy = null` per orchestration run.
- [x] Build the strategy after a successful ARCHITECT invocation (initial).
- [x] Rebuild and replace the strategy after a REPLAN ARCHITECT invocation.
- [x] Attach `input.approvedStrategy` to BUILDER requests only.
- [x] Throw `AgentOrchestrationError` when BUILDER is invoked without a
  strategy.
- [x] Do not expose the strategy to ANALYST or REVIEWER.

## 3. Request contract

- [x] Add `approvedStrategy` to `REQUEST_INPUT_KEYS`.
- [x] Validate the strategy shape in `role-contracts.js` via a local validator
  (no circular import).

## 4. Tests

- [x] Add `tests/unit/agent-approved-strategy.test.mjs` covering build, freeze,
  invalid shapes and determinism.
- [x] Extend `tests/unit/agent-orchestrator.test.mjs`: BUILDER receives the
  ARCHITECT strategy, ANALYST/REVIEWER do not, replan replaces it, and a missing
  strategy is rejected.
- [x] Run `node --test --test-force-exit tests/unit/agent-approved-strategy.test.mjs tests/unit/agent-orchestrator.test.mjs tests/unit/agent-role-contracts.test.mjs tests/unit/task-agent-loop.test.mjs`.

## 5. Validation

- [x] Run `npm run build`.
- [x] `openspec validate --changes --strict` for this change.
