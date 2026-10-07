# Deterministic Control

## Claim

WAM makes control decisions from explicit task state, available context, evidence
and policy rather than relying exclusively on accumulated model conversation.

## Core proposition

For the same relevant state and inputs, the control decision should be
deterministic.

## Implementation

The control layer is composed of pure, deterministic mechanisms:

- **Formal state machine** — `src/execution/execution-state.js`: a fixed
  `ALLOWED_TRANSITIONS` table and `transition(from, to, taskState)`. Given the
  same `from`, `to` and `taskState`, the same transition is accepted or rejected.
- **Skill routing** — `src/skills/engine.js`: `scoreSkill` is a weighted lexical
  sum with no randomness; `routeSkillsV2` ranks deterministically.
- **Context selection** — `src/context/context.js`: selection uses a closed
  alias set and a budget, with no vector DB and no embeddings.
- **Risk evaluation** — `src/policy/risk-engine.js`: action capability
  classification is a function of the action and path.

## Boundary

Determinism applies to WAM's *control* layer (routing, gating, transitions,
completion control). The model's own reasoning is not deterministic, and some
state records timestamps (`createdAt`, `updatedAt`) that vary across runs. The
documented proposition is therefore scoped to the control decisions WAM itself
makes.

## Evidence required

The validation suite should demonstrate:

```text
same state + same inputs
        ↓
same decision
```

and:

```text
relevant input changes
        ↓
expected decision changes
```

while:

```text
irrelevant input changes
        ↓
decision remains stable
```

## Evidence

- Implementation: `src/execution/execution-state.js`,
  `src/skills/engine.js`, `src/context/context.js`, `src/policy/risk-engine.js`.
- Tests: `tests/unit/state-machine.test.mjs`,
  `tests/unit/policy-state-machine.test.mjs`,
  `tests/unit/skill-routing.test.mjs`,
  `tests/unit/active-context-boundary.test.mjs`.

**Status: Implemented, Tested** (control layer). The end-to-end "same decision
under real model execution" guarantee remains a **Design target**; see the
[Causal Decision Matrix](../validation/causal-decision-matrix.md).

## See also

- [Task State](task-state.md)
- [Context Management](context-management.md)
