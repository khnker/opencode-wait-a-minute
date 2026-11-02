# Enforce Task-Specific Quality Contracts

## Why

WAM can evaluate outcomes, but completion is still governed by a single
criterion shape. The evidence vocabulary already exists
(`TASK_EVIDENCE_TYPES`, `TASK_EVIDENCE_STRENGTH` in
`src/verification/outcome-evaluator.js`), yet nothing enforces that a research
task needs sources, a debugging task needs a reproduction, or a refactor needs
functional equivalence. The result is two symmetric failures:

- **False DONE**: a requirement is satisfied nominally with a narrative claim.
- **False block**: a well-evidenced task is held because the gate expects the
  wrong kind of proof.

This change makes evidence sufficiency depend on the expected outcome while
keeping the authority at the criterion level.

## Relationship to existing changes

This is a delta, not a replacement:

- `openspec/changes/task-quality-contract/` already defines the contract
  structure and the rule that strictness is criterion-specific. Its task 1.x
  work is the prerequisite for the templates added here.
- `src/verification/outcome-evaluator.js` remains the evidence evaluator; this
  change consumes its enums and verdicts instead of creating a second one.
- `src/integration/orchestration.js` remains the completion gate; this change
  feeds it an extra sufficiency signal behind a flag.

## What Changes

1. Add deterministic **task-kind profiles** for research, implementation,
   debugging, refactoring, review and documentation.
2. Add **evidence sufficiency evaluation**: required evidence types, minimum
   strength, minimum count and per-criterion coverage.
3. Add **stale evidence** detection using `sourceRef` + content hash, with an
   optional maximum age.
4. Add **contradiction** detection (failed evidence against a satisfied
   criterion, conflicting outcomes for the same source).
5. Integrate sufficiency into the completion gate behind
   `qualityContracts.enabled` (default `false` until benchmarked).
6. Emit a `quality.evaluated` record compatible with the Change 13 schema.

## Non-goals

- No LLM-as-judge and no self-grading.
- No reviewer role (Change 09) and no context isolation (Change 10).
- No autonomy-level policy (Change 11) and no historical learning (Change 12).
- No automatic mutation of user requirements or contracts.
- No change to the default behavior while the flag is off.

## Success Criteria

- A task with nominal but weak evidence cannot reach DONE when the flag is on.
- A task with the expected evidence for its kind is not blocked.
- Stale and contradictory evidence produce actionable, deterministic reasons.
- The flag off reproduces today's gate behavior exactly.
- Every evaluation is reproducible from persisted inputs (no wall-clock
  dependence except the explicit `now` parameter).
