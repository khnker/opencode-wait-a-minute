# Design

## Comment Taxonomy

### C0 — No Comment Required
Code clearly expresses its behavior.

### C1 — Useful Existing Comment
Comment explains meaningful context, constraints, or reasoning.

### C2 — Missing Explanation
Behavior is non-obvious and its rationale is not documented.

### C3 — Redundant
Comment merely restates what the code does.

### C4 — Stale or Misleading
Comment no longer represents the implementation or current invariant.

## Documentation Priority

Documentation priority is based on risk, not code size. Highest priority:

1. state machines;
2. completion/verification gates;
3. persistence/recovery;
4. context-budget decisions;
5. fail-closed behavior;
6. external integration boundaries;
7. token accounting;
8. benchmark methodology.

## Invariant Documentation

Documentation should answer:

- What must always be true?
- What is intentionally forbidden?
- What happens when evidence is missing?
- What happens when persistence fails?
- Which transitions are legal?
- Why does this optimization exist?
- What behavior must not regress?

## API Documentation

JSDoc should describe contracts, not restate signatures. Useful JSDoc explains:

- semantic meaning;
- preconditions;
- postconditions;
- failure behavior;
- side effects;
- lifecycle constraints.

## Deliverables

- `docs/architecture/invariants.md` — high-risk invariants.
- `docs/benchmarks/methodology.md` — token-accounting + benchmark methodology.
- Inline C4 removal / C2 additions in production modules.
