# Fix Context Graph Runtime Wiring

## Problem

The Context Graph Engine (CGE) reconstructs only the task and requirement
layers in production. `message-handler.js` calls `assembleContext()` without
run state, evidence lineage, cognition, decisions, constraints, observations,
hypotheses, or experiments, so `buildRuntimeContextGraph()` receives empty
defaults. Even when those layers are supplied, the router only traverses
evidence attached to `output` nodes, while runtime evidence is attached to
requirements. The persisted dependency graph is not merged either.

The result is a graph with three nodes (`task`, `requirement`, shadow
`output`) and an N3 block that contains only the task and requirement. The
loop can produce hundreds of evidence records, observations, and decisions,
but the router never sees them.

## Goal

Make the runtime graph reflect the persisted task state and make causal
evidence/decision support for mandatory requirements reach N3, without
breaking token bounds or deterministic selection.

## Scope

- Load bounded runtime layers before context assembly.
- Map run-state actions, observations, and decisions in the graph builder.
- Include evidence and decisions supporting mandatory requirements in the
  router closure, independently of prompt keyword matching.
- Add regression tests for the loader, builder, router, and assembly.
- Keep the previous `wam-context-graph-reconstruction` contract intact.

## Out of Scope

- Merging the legacy persisted `task-dependencies` graph in this change.
- Removing the deprecated `buildGraphFromTaskState()` helper.
- Changing N0/N1/N2 policy or prompt formats.

## Success Criteria

- A task with persisted evidence yields a graph containing evidence nodes.
- `assembleContext()` injects at least one evidence line for a requirement
  with supporting evidence, even when the prompt does not mention
  "evidence".
- Loader output is bounded and deterministic.
- Existing context, router, and assembly suites keep passing.
