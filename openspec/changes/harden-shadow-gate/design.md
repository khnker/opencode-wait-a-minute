# Design: harden-shadow-gate

## Context

Shadow mode computes the semantic projection for measurement while injecting the
legacy brief. `buildContextBrief` returns `projection: null` whenever
`resolveProjection` cannot build a projection (missing execution ledger and
canonical base, or any thrown error). The record builder then extracts zero
projection counters, so the record still passes every gate except its honesty.

Reference material used for this change:

- OpenCode plugin hooks: https://opencode.ai/docs/plugins/
- JSON Lines format: https://jsonlines.org/
- Node.js `fs` API: https://nodejs.org/api/fs.html

## Goals / Non-Goals

**Goals**

- Make fallback telemetry self-describing in the record itself.
- Prevent fallback or pre-migration records from satisfying the promotion
  minimum.
- Preserve the projection text and all existing record fields.

**Non-Goals**

- Adding a production execution-ledger writer.
- Changing compaction output or mode resolution.
- Reclassifying historical records (they stay `unknown`).

## Decisions

### Decision 1: Availability is written by the producer, not inferred by the gate

`buildShadowRecord` emits `projectionAvailable: projection != null` and
`fallbackReason` (`null` when available). `buildContextBrief` returns
`fallbackReason: "no-ledger-and-no-base"` when an `active` projection resolves
to `null` (or `"legacy-mode"` when the caller explicitly requested legacy).

Chosen because the producer is the only component that knows whether a
projection was actually built. The gate only compares `=== true`, so unknown or
tampered values cannot accidentally promote.

### Alternatives considered

1. **Gate-side heuristic on `deltaChars`/`equivalent`/hash equality.** Rejected:
   a genuine projection can legitimately produce identical text, and a fallback
   can differ in future formats. The heuristic would infer intent from output
   instead of recording it at the source, and would keep historical records
   ambiguous.
2. **Separate fallback event file (e.g. `.wam/context-shadow-fallback.jsonl`).**
   Rejected: creates two streams to reconcile, doubles write/rotation code, and
   still leaves the main record lying about projection counts. A field on the
   existing line keeps JSONL one-record-per-line semantics
   (https://jsonlines.org/).
3. **Rejecting fallback records at write time.** Rejected: loses evidence that
   shadow mode ran without a projection, which is exactly the signal operators
   need to fix the missing base/ledger.

### Decision 2: Missing field means `unknown`

Records written before this change have no `projectionAvailable` field. The
gate classifies anything that is not `true` and not `false` as `unknown`;
`unknown` never counts toward the minimum. This keeps old files valid JSONL and
readable (https://jsonlines.org/) without a migration.

### Decision 3: Gate only changes counting

`parse`, `mode`, `budget`, `delta` and `selection` gates keep their semantics
and names. The `records` gate becomes availability-aware and its detail names
available/fallback/unknown counts so a failure is diagnosable.

## Risks / Trade-offs

- No production ledger writer exists yet, so live shadow records will report
  `projectionAvailable: false` until canonical state is seeded. That is the
  intended, honest outcome.
- Operators must re-run shadow collection after a base/ledger exists; old
  records remain `unknown` and cannot be retroactively promoted.
