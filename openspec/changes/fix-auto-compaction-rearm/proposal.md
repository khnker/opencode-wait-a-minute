# Change: Fix auto-compaction re-arm

## Why
`maybeAutoCompact` recorded the pre-compaction token total and then skipped every
later event whose total was not strictly larger (`if (last && total <= last.total) return;`).
After the first compaction the total always drops, so compaction could only ever
fire once per process. The summarize call also omitted `auto`, so OpenCode recorded
the compaction as user-initiated.

## What Changes
- Replace the ever-increasing-total guard with an armed/disarmed state: after a
  compaction the session is disarmed and re-arms only when the reported total
  falls to half the threshold.
- Add a single-flight guard so concurrent events cannot summarize the same
  session twice.
- Send `auto: true` in the `session.summarize` body so the compaction is recorded
  as automatic.
- Log summarize failures unconditionally via `console.warn` (instead of only
  through the opt-in `wamLog`).

## Non-goals
- Changing the default threshold or the cooldown.
- Persisting compaction state to disk.
- Deriving the threshold from the model's context window.

## Expected Result
A session that crosses the threshold, compacts, drops to half the threshold and
crosses it again compacts a second time.

## Validation
- `node --test --test-force-exit tests/unit/auto-compaction.test.mjs`
- `npm run build`
- `openspec validate --changes --strict`
