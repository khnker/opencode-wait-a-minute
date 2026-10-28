## Why

Compaction currently always injects the semantic projection (`active`). We have no
evidence in production of how often the projection changes what the user would have
received, so a hard cutover to the new pipeline cannot be justified. The comparative
benchmark at commit `60a19c3` measured WAM 10/10 vs full-context 4/10 on large-state
tasks with WAM at 824 tokens, which justifies the projection but not blind adoption.

Shadow mode gives us the missing evidence: keep injecting today's legacy brief, compute
the projection in parallel, and record what would have been sent versus what was sent.

## What Changes

- Add a single enum config key `contextProjection`: `legacy`, `shadow`, `active`
  (default `active`, preserving current behavior when unset).
- In `shadow`, inject exactly the `legacy` brief and append one bounded JSONL
  telemetry record to `.wam/context-shadow.jsonl` (honoring `WAM_METRICS_DIR`).
- Telemetry is fail-soft: any write or serialization error is swallowed and never
  changes compaction output.
- Add unit and integration tests plus this OpenSpec change.

## Impact

- Affected specs: `shadow-context-mode` (new capability).
- Affected code: `src/context/context-shadow.js` (new), `src/context/context-brief.js`,
  `src/config/wam-config.js`, `index.js` compaction hook.
- No changes to `context-compaction.js`, `assembly.js` or the router.
- Risk: one extra projection computation per compaction while in `shadow`. Bounded by
  the existing caps; no new synchronous I/O beyond one small append.
