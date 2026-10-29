## Why

Shadow telemetry on `comparador-precios` failed the delta gate at ratio 1.81
(shadow 1973 chars vs injected 973). The projection was re-rendering eight
session decisions from other sessions, plus a 431-char dump of retrievable
ids, on a task with a single requirement. Two defects:

1. Decision selection ignored task scope: 127 decisions existed, most from
   other sessions, and the alphabetical first eight were projected.
2. The same fact was rendered three times (pending obligation in execution
   state, open items, and next obligation) and retrieval handles were rendered
   as a comma list instead of a bounded sample.

## What Changes

- Project only decisions that are linked to the current task, or that are
  project-wide (no `task-…`/`ses-…` scope in the id). Decisions scoped to
  another task/session stay in `retrievableRefs` only.
- Deduplicate decisions by normalized text, keeping the most recent.
- Render each fact once: execution state shows requirement statuses and
  conflicts; pending obligations render in open items; next obligation stays.
- Render retrieval handles as a count plus up to four base-entry refs.

## Impact

- Affected specs: `semantic-projection`
- Affected code: `src/context/semantic-projection.js` and its tests
- No API or dependency changes; projection objects gain `baseRefs`.
