# Specification: Enforce Outcome-Based Done

## ADDED Requirements

### Requirement 1: Strict Outcome Contract Validation
- Outcome contracts MUST validate: `taskId`, `objective`, and `acceptanceCriteria` with stable `id` fields.
- Each criterion MUST have a boolean `mandatory` field (default true).
- Evidence association MUST use stable IDs, not substring matching.

### Requirement 2: Mandatory vs Optional Criteria Evaluation
- Final outcome status MUST be derived from mandatory criteria only.
- Optional criteria MUST NOT block `ACHIEVED` if mandatory criteria are satisfied.
- Optional criteria status MUST be tracked and reported separately.

### Requirement 3: Verified Observations Only
- Observations MUST carry a `status` field (`VERIFIED`, `UNVERIFIED`, `FAILED`).
- Only `VERIFIED` observations can satisfy a criterion.
- Unverified observations MUST result in `UNVERIFIED` criterion status.

### Requirement 4: Temporal Evidence Resolution
- Evidence items MUST have a `timestamp` field.
- When evaluating a criterion, newer evidence (`timestamp` comparison) MUST supersede older evidence for the same criterion.
- Explicit invalidation markers MUST be respected.

### Requirement 5: Completion Gate Integration
- `canComplete(taskRoot, taskId)` MUST evaluate outcome before allowing completion.
- If outcome status is not `ACHIEVED`, or mandatory criteria are unmet/unverified, `canComplete` MUST return `allowed: false`.
- Blockers MUST include outcome-specific reasons.

### Requirement 6: Fail-Closed on Evaluator Errors
- Evaluator errors, malformed contracts, or missing evidence MUST result in `canComplete: false`.