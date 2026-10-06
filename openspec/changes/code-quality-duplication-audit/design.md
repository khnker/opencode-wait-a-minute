# Design

## Duplication Taxonomy

### D1 — Exact Duplication

Same implementation exists in multiple locations.

Action:

- consolidate into a single implementation;
- preserve public behavior;
- update callers;
- add regression coverage where required.

### D2 — Structural Duplication

Different code implements the same algorithm or control flow.

Action:

- compare semantics and invariants;
- determine whether the algorithm has a common owner;
- extract only if the resulting abstraction is clearer.

### D3 — Semantic Duplication

Different implementations perform the same conceptual responsibility.

Examples:

- multiple task-state transition helpers;
- multiple completion checks;
- multiple evidence normalization paths.

Action:

- identify the owning pillar;
- define the canonical responsibility;
- migrate callers toward the canonical implementation.

### D4 — Intentional Duplication

Repetition exists deliberately because abstraction would create coupling, reduce readability, or isolate failure domains.

Action:

- keep the duplication;
- document the reason when it is not obvious.

## Ownership Rule

The location of a helper is determined by the responsibility it owns, not by the number of callers.

A helper used by three pillars does not automatically belong in `shared`. If the helper contains domain semantics, it remains inside the owning pillar. Only domain-neutral infrastructure belongs in `shared`.

## Refactoring Rule

Every consolidation must preserve:

- observable behavior;
- error semantics;
- state transitions;
- persistence semantics;
- token accounting;
- benchmark semantics.

Characterization tests must be added when existing behavior is not already adequately covered.

## Deliverables

- `docs/architecture/duplication-audit.md` — inventory + classification + ownership decisions.
- Characterization tests for any consolidated behavior.
