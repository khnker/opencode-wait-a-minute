## Context

The semantic projection was validated offline, not in live sessions. The approved plan
calls for step 4, shadow mode: measure the projection without letting it reach the
prompt. This mirrors standard shadow/canary practice: run the new path on real traffic,
compare outputs, and only then promote it.

Measured baseline (commit `60a19c3`, comparative benchmark):

- large-state tasks: WAM 10/10 vs full-context 4/10
- WAM context cost: 824 tokens

That establishes the value of the projection but says nothing about per-session
divergence, which is exactly what shadow telemetry measures.

## Goals

- Observe the projection on real compactions without changing injected bytes.
- Keep the default behavior (`active`) unchanged when the key is unset.
- Keep telemetry bounded and fail-soft.

## Non-Goals

- Automatic promotion from `shadow` to `active`.
- Changing `context-compaction.js`, `assembly.js` or router behavior.
- A second logging stack: telemetry is one JSONL file with local rotation.

## Research

- Martin Fowler, Canary Release — run the new path in parallel, compare before promoting:
  https://martinfowler.com/bliki/CanaryRelease.html
- OpenFeature introduction — runtime-evaluated flags with safe defaults:
  https://openfeature.dev/docs/reference/intro

## Decisions

### Chosen: one enum key `contextProjection`

`legacy` = today's brief only. `shadow` = legacy brief injected + projection measured.
`active` = projection-backed brief (default). A single enum keeps the states explicit
and ordered, and makes rollout/rollback a config edit.

### Rejected: hard cutover to the projection

No live evidence of divergence or regression. The benchmark covers quality and tokens,
not per-session equivalence.

### Rejected: boolean `shadowMode`

A boolean cannot express rollback to the legacy path (`legacy`) once the projection is
the default; a third state is required.

## Telemetry shape

One JSON object per line: `schemaVersion`, `timestamp`, `sessionId`, `taskId`, `mode`,
`budgetChars`, `injectedChars`, `shadowChars`, `injectedHash`, `shadowHash`,
`injectedTokenEstimate`, `shadowTokenEstimate`, `deltaChars`,
`requirements {included, omitted, pending, conflicts}`, `decisions {live, dropped}`,
`constraints`, `retrievableRefs`, `equivalent`.

Destination: `WAM_METRICS_DIR || <root>/.wam`, file `context-shadow.jsonl`. Rotated
when the file exceeds 1 MB (keep the last 500 lines).

## Progressive activation

The projection moves through three phases; each promotion is a single config value.

- **legacy** (baseline): `contextProjection: "legacy"`. Current behaviour; projection is
  built but never injected. Also the rollback target.
- **shadow** (evidence): `contextProjection: "shadow"`. Legacy text is injected and one
  telemetry record appended per compaction. No user-visible change.
- **active** (opt-in): `contextProjection: "active"`. The projection is injected. Opt-in
  only; never the default.

Promotion from shadow to active is gated by a read-only report over the telemetry:

```bash
npm run context:shadow-report            # or: node scripts/context-shadow-report.mjs
```

Default destination matches the writer: `WAM_METRICS_DIR || <root>/.wam`, file
`context-shadow.jsonl`. All gates must hold:

- at least 20 records (`--min-records`);
- every line parses; a corrupt line fails the gate and names its line number;
- every record has `mode: "shadow"`;
- `shadowChars <= budgetChars` for every record;
- `|deltaChars| <= maxDeltaRatio * injectedChars` (`--max-delta-ratio`, default `1.0`);
- no id appears in both `requirements.included` and `requirements.omitted`;
- no lost pending/conflict ids (the report prints both counts for review).

Exit codes: `0` gate passed, `1` gate failure, `2` telemetry missing. The script never
writes: promotion evidence and activation stay separate decisions.

Rollback: set `contextProjection: "legacy"`. One config change, no data migration.
Telemetry on disk stays for inspection and is bounded by the existing 1 MB / 500-line
rotation.

## Risks

- Shadow doubles brief construction on compaction. Both calls are pure and bounded by
  `maxChars`; acceptable for an opt-in mode.
- Hash equivalence only proves text equality, not semantic equivalence. That is
  sufficient for promotion evidence and keeps the record cheap.
