# Task-specific quality contracts

This change makes completion evidence depend on the kind of task instead of a
single generic checklist. The evaluator is deterministic: it never calls an LLM
and never transitions task state by itself.

## Evidence model

Every requirement (or acceptance criterion) is resolved to a quality contract:

1. **Criterion declaration** — `evidenceRequirements` wins when present.
2. **Kind profile** — otherwise the task kind supplies the defaults:
   - `research`: one observation at `L2_OBSERVATION` or stronger.
   - `implementation`: a `TEST_RESULT` at `L4_VERIFICATION` plus a `DIRECT` or
     `DERIVED` artifact at `L3_DIRECT` or stronger.
   - `debugging`: a `DIRECT`/`NEGATIVE`/`TOOL_OUTPUT` observation plus a
     `TEST_RESULT` at `L4_VERIFICATION`.
   - `refactoring`: a `TEST_RESULT` at `L4_VERIFICATION` plus a `DIRECT` or
     `DERIVED` artifact at `L3_DIRECT` or stronger.
   - `review`: one observation at `L2_OBSERVATION` or stronger.
   - `documentation`: a `DIRECT` or `DERIVED` artifact at `L2_OBSERVATION` or
     stronger.
   - `unknown`: no kind default; only criterion-level requirements apply.
3. **No requirement** — an unknown kind with no criterion declaration does not
   block the task.

Each evidence item carries a `type`, a `strength`, a `status` (`pass`/`fail`),
an optional `timestamp`, and optional `sourceRef`/`hash`/`supersedes` fields.
The evaluator reports:

- `missing`: the criterion and the required evidence types/count.
- `stale`: expired evidence or a hash that no longer matches the current file.
- `contradictions`: failed mandatory evidence or unresolved conflicting hashes.
- `reasons`: stable `missing:`/`stale:`/`contradiction:` codes suitable for logs.

`evaluateEvidenceSufficiency(contract, evidence, options)` is pure and rejects a
contract without resolved criteria (`TypeError`); malformed evidence is ignored
rather than thrown.

## Flag

The behavior is opt-in:

```json
{
  "qualityContracts": { "enabled": false }
}
```

When disabled, the gate and the task loop are unchanged. When enabled, the
adapter snapshot includes `quality`, a `VERIFY` decision is emitted for
`missing`/`stale` evidence, a `REPLAN` decision for `contradictions`, and the
completion gate requires `quality.sufficient !== false`.

## Observability

`recordLoopDecision` appends a `quality.evaluated` event alongside the decision
event. The event contains `taskId`, `kind`, `sufficient`, `missingCount`,
`staleCount`, `contradictionCount` and `reasons`. It carries no `state` field,
so event replay ignores it for state reduction.
