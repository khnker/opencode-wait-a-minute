# Proposal: Formalize the Approved Agent Strategy

## Problem

ARCHITECT decisions currently reach BUILDER only as flattened free-text
constraints (`Decision <id>: <description> (<rationale>)`) appended to the
shared constraint list. Nothing binds BUILDER to a single, validated strategy
object for the current orchestration run. Consequences:

- BUILDER can start from an implicit or stale plan, especially after a
  revision or replan cycle.
- There is no machine-checkable proof that ARCHITECT actually approved the
  plan BUILDER is implementing.
- ANALYST and REVIEWER receive the same constraint list, so strategy data is
  not scoped to the role that consumes it.

## Changes

1. Add `src/agents/approved-strategy.js` with a frozen, deterministic
   `buildApprovedStrategy` and a fail-loud `assertApprovedStrategy`
   (`APPROVED_STRATEGY_VERSION = 1`).
2. Orchestrator maintains one `approvedStrategy` per run, builds it from a
   successful ARCHITECT result plus the constraints accumulated at that point,
   and attaches it to BUILDER requests only.
3. REPLAN replaces the strategy with the new ARCHITECT strategy.
4. A BUILDER invocation without a strategy fails loud with
   `AgentOrchestrationError`.
5. `approvedStrategy` becomes part of `REQUEST_INPUT_KEYS` and its shape is
   validated at the request boundary.

## Non-goals

- No persistence of the strategy to task state (existing task-level
  `approvedStrategy` in `src/execution/` is a separate concept).
- No scoring, ranking, or LLM evaluation of strategies.
- No new orchestration phases or adapter behavior.

## Impact

- New capability: `agent-approved-strategy`.
- Affected code: `src/agents/approved-strategy.js`,
  `src/agents/orchestrator.js`, `src/agents/role-contracts.js`.
- Affected tests: new `tests/unit/agent-approved-strategy.test.mjs`, extended
  `tests/unit/agent-orchestrator.test.mjs`.
- Backward compatible: `approvedStrategy` is optional for non-BUILDER roles and
  the deterministic free-text constraints remain unchanged.
