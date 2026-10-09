# Change: Skill Lifecycle & Composition
## Why
WAM skills are isolated instruction blobs. There is no contract for how one skill's
output becomes the next skill's input, no declared dependencies between skills, and no
record of which skills participated in a task. This blocks any workflow abstraction
(CH-04) and any verifiable skill pipeline.
## What Changes
- Define an input/output contract for a skill (typed artifact + observation handle).
- Allow a skill to declare `required`, `optional` and `fallback` skills.
- Activate skills as a graph; detect and reject cycles before running anything.
- Record the executed-skill graph per task (which skill ran, in order, with what output).
- Preserve WAM state (task/contract/claims) across skill transitions.
- Distinguish `skill` (atomic capability/procedure) from `workflow` (composition, CH-04).
## Non-goals
- The workflow engine and its branching/retry semantics (CH-04).
- Pressure testing (CH-02) and the authoring protocol (CH-03).
- Changing on-demand skill scoring (`skill-loading`).
## Depends on
- `skill-loading` (existing): metadata, classification-based loading, on-demand scoring.
## Expected Result
A task can run >=2 skills in sequence, every hand-off produces a verifiable observation,
the runtime records the skill graph, and no dependency is inferred from prompt text alone.
## Validation
- [ ] `openspec validate skill-lifecycle-composition --strict` passes
- [ ] A task executes >=2 skills sequentially with a recorded graph
- [ ] A cyclic skill graph is rejected at activation time
## Program
- Program: Superpowers integration
- Order: 1 of 7
- Priority: P0
