# Proposal: harden-shadow-gate

## Why

The shadow activation gate counts every parseable JSONL record toward
`--min-records`. When `buildContextBrief` cannot resolve a projection it falls
back to the legacy brief, producing a record that is byte-identical to the
injected text (`delta 0`, `equivalent true`) and whose projection counters
(`requirements.included`, `requirements.pending`, `decisions.live`) are all
zero. Such a fallback record is indistinguishable from a real projection with
no content, so 20 fallback records could satisfy the promotion minimum without
the semantic projection ever running.

The empirical trigger is a repository with no `.wam/canonical/base.json` and no
`.wam/tasks/*/execution-ledger.json`: `buildContextBrief(..., projectionMode:
"active")` returns `projection: null`, and the shadow record still looks clean.

## What Changes

- `buildShadowRecord` emits `projectionAvailable` and `fallbackReason`.
- `buildContextBrief` reports `fallbackReason` when the projection resolves to
  `null`.
- `index.js` forwards `shadowBrief.fallbackReason` into the record.
- `scripts/context-shadow-report.mjs` counts availability and applies
  `--min-records` only to records with `projectionAvailable === true`.
  Fallback (`false`) and unknown (missing field) records are reported
  separately and never satisfy the minimum.
- Exit codes stay `0` pass, `1` gate failure, `2` telemetry missing/unreadable.

## Impact

- Telemetry schema gains two fields; all existing fields are unchanged.
- Old telemetry files remain parseable and are classified as `unknown`, never
  as available.
- No change to injected context or to the shadow brief text.
