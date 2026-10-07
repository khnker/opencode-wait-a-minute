# Less Guessing

## Claim

WAM makes relevant uncertainty and assumptions explicit before decisions that
depend on them.

## Mechanism

The uncertainty and assumption mechanisms live in `src/policy/uncertainty.js`:

- `classifyUncertainty(item)` — classifies a statement as known/unknown;
- `buildUncertainties(assumed, unknown)` — assembles uncertainties;
- `classifyAssumption(statement)` — classifies an assumption;
- `buildAssumptions(assumed)` — builds the assumption list;
- `escalateAssumptions(state, taskText)` — escalates significant assumptions
  into a gate.

These are surfaced by the assumption gate, blocking-questions and
clarification-gate policies before execution proceeds.

## Validation

Test at least:

- known information;
- explicit unknown;
- significant assumption;
- clarification required;
- clarification provided.

## Tests

- `tests/unit/assumption-gate.test.mjs`
- `tests/unit/assumption-tracking.test.mjs`
- `tests/unit/blocking-questions.test.mjs`
- `tests/unit/clarification-gate.test.mjs`

**Status: Implemented, Tested** for the implemented uncertainty policies. The
broader outcome ("less guessing" in agent behavior) is a **Design target** and is
not measured by the current benchmark suite.

## See also

- [Context Enrichment](../concepts/context-enrichment.md)
- [Verification](verification.md)
