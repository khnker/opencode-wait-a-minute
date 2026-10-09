# Change: Workflow Engine
## Why
Skills describe capabilities; there is no first-class way to describe how capabilities
combine. Debugging and review are compositions, not single skills, and today they are an
open loop in text. A workflow must be declarative, persistent, and end in a verifiable state.
## What Changes
- Introduce workflows as explicit compositions of skills (`skill != workflow`).
- Declarative definition with step modifiers: `required | optional | conditional | parallel | retry | fallback`.
- Persistent workflow state with branching and controlled (bounded) retry.
- Record executed skills per workflow (reusing CH-01's graph).
- Every workflow ends in a verifiable state (CH-05).
- Workflows are opt-in: no universal mandatory workflow.
## Non-goals
- Authoring individual skills (CH-03) or composition primitives (CH-01).
- Making a specific debug/review workflow obligatory.
## Depends on
- `skill-lifecycle-composition` (CH-01), `skill-pressure-scenarios` (CH-02).
## Expected Result
Workflows are declarative, resumable across sessions, branch/retry deterministically, and
end verifiable.
## Validation
- [ ] `openspec validate skill-workflow-engine --strict` passes
- [ ] A debug workflow runs end-to-end and ends VERIFIED
- [ ] Retry is bounded and falls back on exhaustion
## Program
- Program: Superpowers integration
- Order: 5 of 7
- Priority: P1
