# Define Agent Role Contracts

## Why

WAM has single-agent role specialization through
`task-conditioned-role-replacement`, but no multi-agent contract for delegating
work, receiving structured results and constraining each participant's
authority.

That specialization is a mechanism inside one agent. It is not an orchestrator
and this change neither reuses nor archives it.

This change starts the multi-agent track by fixing roles, inputs, outputs and
authority limits before any invocation exists. The contracts are independent of
OpenCode so the same definitions can run through the V1 adapter now and another
adapter later.

## What Changes

- Declares a closed `AgentRole` enum: `ANALYST`, `ARCHITECT`, `BUILDER`,
  `REVIEWER`.
- Declares the common `AgentRequest` contract: identity, objective, acceptance
  criteria, selected input and expected output.
- Declares the common `AgentResult` contract, including findings, decisions,
  artifacts, evidence, open questions, recommendations and limitations.
- Declares statuses `COMPLETED`, `BLOCKED`, `NEEDS_INPUT` and `FAILED`; no agent
  can declare `DONE`.
- Declares the `ReviewResult` contract with `ACCEPTED`, `REVISION_REQUIRED`,
  `REPLAN_REQUIRED` and `BLOCKED` verdicts.
- Declares the capability matrix as design data. It is not enforcement.
- Adds deterministic request/result validators and unit tests.

## Invariants

- WAM is the only coordinator.
- Agents do not modify global task state.
- WAM owns task state, approvals, evidence and completion.

## Impact

- `src/agents/role-contracts.js` (new)
- `tests/unit/agent-role-contracts.test.mjs` (new)
- `openspec/changes/define-agent-role-contracts/**` (new)
- No dependency or host-adapter changes.

## Non-Goals

- Invoking agents or routing to models (Change 02).
- Selecting and isolating context per role (Change 03).
- Enforcing capabilities at runtime (Changes 02/03).
- Orchestrating the four roles (Change 04).
- Review feedback cycles (Change 05).
- Re-executing tests from the Reviewer.
- Task Loop integration (Change 06) or the multi-agent benchmark (Change 07).
- Verifier and Integrator roles.
