# WAM Documentation Agent Instructions

## Objective

Rewrite and complete the WAM documentation so that it explains the actual
architecture, behavior, claims, validation strategy, and benchmark evidence of
the repository.

The documentation must describe the system that exists in the repository, not an
intended future architecture.

## Mandatory repository analysis

Before writing or modifying documentation:

1. Inspect the complete `src/` tree.
2. Inspect the complete `tests/` tree relevant to each claim.
3. Inspect:
   - `package.json`
   - benchmark runners
   - benchmark evaluation code
   - benchmark reports
   - existing architecture documentation
   - existing claims documentation
4. Trace every documented mechanism to its implementation.
5. Trace every behavioral claim to tests.
6. Trace every quantitative claim to the benchmark artifact that produced it.
7. Identify contradictions between documentation, implementation and tests.

Do not resolve contradictions by guessing.

If documentation says X but the implementation does Y:

- treat implementation as the behavioral source of truth;
- document Y;
- record the discrepancy;
- recommend or implement the required documentation correction.

## Evidence discipline

Every strong claim must have one of these statuses:

- `Implemented` — mechanism exists in production code.
- `Tested` — behavior is covered by automated tests.
- `Measured` — quantitative result is produced by a reproducible benchmark.
- `Observed` — behavior was observed in a specific execution but is not yet part
  of the reproducible release evidence.
- `Design target` — intended behavior exists conceptually but is not yet
  sufficiently demonstrated.

Never upgrade evidence status.

Do not convert:

- a unit test into a performance claim;
- a deterministic simulation into a real-model result;
- context reduction into token savings;
- token savings into monetary savings;
- external research into evidence that WAM itself achieved the same result.

## Core WAM model

The documentation should converge on this model:

WAM adds deterministic control, task-state management, context enrichment, and
token optimization to OpenCode agents by correlating tasks, skills, context,
evidence, and verified state to determine what should happen next.

The central architectural distinction is:

> Persistent task state is maintained separately from transient model context.

The model context sent to the agent is reconstructed from the state required for
the current decision.

Use the phrase:

> WAM keeps more state than it sends.

when explaining this principle.

## State vs context

Do not describe persistent WAM state as model context.

Persistent state may include:

- task identity
- task lifecycle state
- requirements
- verified progress
- evidence
- relevant files
- selected skills
- decisions
- assumptions
- verification state

Model context is the subset assembled for the current model interaction.

The documentation must explain:

```text
Persistent state
        ↓
Current task state
        ↓
Context selection
        ↓
Relevant skills/context
        ↓
Selected model context
        ↓
Agent decision
        ↓
Action / observation
        ↓
Evidence
        ↓
Updated persistent state
```

## Task isolation

Use this conceptual example where supported by the implementation:

Task A:

```text
Fix payment timeout
```

Relevant state:

```text
Stripe API
payment service
retry configuration
timeout logs
verification evidence
```

After Task A is completed, a new task starts:

Task B:

```text
Update README
```

Task A state remains persisted as Task A state. It must not automatically become
Task B model context.

Task B context should be reconstructed from Task B state and its relevant
repository/documentation context.

The agent must verify that the implementation actually enforces this boundary
before describing it as an implemented guarantee.

## Skill enrichment

Documentation should explain skills as part of context enrichment.

Example:

```text
Task:
Add PostgreSQL migration
```

Possible relevant skills:

```text
PostgreSQL
database migration
testing
```

Irrelevant skills:

```text
Angular UI
CSS
unrelated infrastructure
```

The agent must inspect the actual skill-selection implementation and tests before
claiming this behavior.

## Evidence-driven progression

Explain that evidence is part of task state. Evidence can change what happens
next.

```text
Implementation
      ↓
Verification
   ↙       ↘
failure    success
   ↓          ↓
investigate   next state / completion
```

The exact state names and transitions must be taken from the actual
implementation. Do not invent state transitions.

## Deterministic control

The documentation should establish the stronger technical proposition:

Given the same relevant state, inputs, policies and available capabilities, WAM
should produce the same control decision.

The agent must determine whether this is actually guaranteed by the current
implementation. If not, document the strongest proposition supported by the code
and identify what validation is missing.

## Causal validation

Do not validate the premise only by checking that a feature exists. The
validation suite should test controlled perturbations.

For each important input:

1. Hold all unrelated inputs constant.
2. Change one relevant variable.
3. Execute the decision mechanism.
4. Verify that the expected decision changes.
5. Change an irrelevant variable.
6. Verify that the decision remains unchanged.

This establishes causal relevance rather than simple correlation.

## Required premise validation

Create deterministic fixtures covering at least:

1. Same task state → same decision.
2. Task state change → expected decision change.
3. Relevant skill change → expected skill selection change.
4. Relevant context change → expected context selection change.
5. Evidence change → expected verification/completion decision change.
6. New task → isolated task context.
7. Completed task → persistent state retained without leaking into another task.
8. Missing evidence → completion blocked.
9. Sufficient evidence → completion allowed.
10. Irrelevant context change → decision remains stable.

If the current test architecture already provides equivalent coverage, document
and reference it rather than duplicating tests. If coverage is missing, add an
explicit TODO in the validation document.

## Context optimization

Do not use "60% smaller" without identifying exactly what is being measured.

The preferred claim is:

> WAM reduces task-relevant model context by at least 60% while preserving
> verified task state.

The agent must verify:

- what the baseline contains;
- what WAM sends;
- whether both sides are measured with equivalent accounting;
- whether the 60% figure is reproducible;
- which benchmark produced it;
- whether the comparison measures context, input tokens, or total tokens.

Do not silently convert:

```text
context reduction
```

into:

```text
token savings
```

or:

```text
provider cost reduction
```

These are separate metrics.

## Benchmark requirements

Benchmark documentation must distinguish:

### Context reduction

```text
baselineInputTokens - wamInputTokens
```

### WAM overhead

```text
wamOverheadTokens
```

### Net input savings

```text
baselineInputTokens
- wamInputTokens
- wamOverheadTokens
```

The agent must inspect the current benchmark implementation and ensure the
reported formulas correspond to the actual fields being aggregated. If a
benchmark aggregates input + output tokens where the documentation claims input
tokens, fix either the implementation or the documentation. Do not hide the
discrepancy.

## Current 60% claim

Treat 60% as a release/documentation threshold only if the current benchmark
evidence actually supports it.

The historical deterministic result of 69.6% must remain attributed to its actual
harness. Do not manufacture a new benchmark result merely to satisfy the README.

If the current reproducible benchmark cannot support the 60% claim, mark the
claim as requiring validation and update the README accordingly.

## README requirements

README must be readable in approximately five minutes. It should answer:

1. What is WAM?
2. What problem does it solve?
3. What is the core architectural idea?
4. How does state differ from context?
5. How are tasks isolated?
6. How are skills and context selected?
7. How does evidence affect the next action?
8. What measurable result exists?
9. Where is the technical evidence?

Do not overload README with implementation details.

Do not use defensive sections such as:

```text
"What WAM does not claim"
```

Instead, use positive precision:

```text
"How we validate this"
```

Detailed methodological boundaries belong in `docs/validation/` and
`docs/benchmarks/`.

## README terminology

Do not use "Cognitive Gate" as the primary architectural concept. Do not use
"pre-flight" as the primary description.

Do not describe WAM merely as:

```text
a prompt hook that checks the task before execution
```

Prefer:

> WAM adds deterministic control, task-state management, context enrichment, and
> token optimization to OpenCode agents by correlating tasks, skills, context,
> evidence, and verified state to determine what should happen next.

## Documentation architecture

Concept documents explain WHAT the conceptual model is. Architecture documents
explain HOW the implementation realizes it. Claim documents explain WHAT WAM
asserts and WHERE the evidence is. Validation documents explain HOW the premise
is tested. Benchmark documents explain HOW quantitative measurements are
produced.

Avoid duplicating the same explanation across all four layers. Use links instead.

## Required diagrams

Use Mermaid where a diagram materially improves comprehension. At minimum:

1. State/context separation.
2. Task lifecycle.
3. Context reconstruction.
4. Evidence-driven progression.

Diagrams must reflect the actual implementation.

## Existing documentation migration

Inspect all existing documentation for obsolete terminology, especially:

- pre-flight
- cognitive gate
- claims that imply stronger guarantees than the implementation
- token-saving claims unsupported by benchmark accounting
- duplicated architectural descriptions

Update links after renaming or moving documents.

## Broken references

Run the repository documentation checker (`node scripts/docs-check.mjs`). Every
relative Markdown link must resolve. Every referenced implementation file must
exist. Every referenced test must exist. Every benchmark path must exist.

## Final validation

Before considering the documentation complete:

1. Run documentation link validation.
2. Run the relevant unit tests.
3. Run the deterministic benchmark.
4. Generate the RC1 evidence bundle.
5. Compare documented numbers with generated numbers.
6. Search the repository for obsolete terminology.
7. Search the repository for quantitative claims.
8. Verify every quantitative claim against its source artifact.
9. Verify every implementation claim against source code.
10. Verify every test claim against actual tests.

## Required final agent report

At the end, report:

### Documentation completed

List every created/updated file.

### Verified claims

List claims backed by implementation + tests.

### Measured claims

List claims backed by reproducible benchmark artifacts.

### Unresolved discrepancies

List every mismatch between docs, code and benchmarks.

### Required code changes

List code changes needed to make the documentation fully true.

### Required benchmark changes

List benchmark changes needed to substantiate quantitative claims.

### Remaining analysis

List anything that requires human/product judgement rather than code inspection.

Do not declare RC1 documentation complete while unresolved contradictions remain
hidden.
