# Design: Fix auto-compaction re-arm

## Context
`maybeAutoCompact(info)` runs on every `message.updated` assistant event. State
lives in the in-memory `sessionAutoCompact` map. The old guard compared the
current total against the previous total, which made the second compaction
unreachable.

## Research
- OpenCode plugin event API: `event` hook receives `message.updated` with
  `info.tokens`; `client.session.summarize({ path, body, query })` accepts
  `providerID` / `modelID`.
- Compaction-as-a-state-machine: a threshold alone cannot distinguish "crossed
  on the way up" from "still above after shrinking"; hysteresis (re-arm at a
  lower bound) is the standard fix for flapping thresholds.

## Alternatives considered
1. **Hysteresis re-arm (chosen).** After compacting, mark the session disarmed;
   re-arm only when the reported total is `<= threshold * 0.5`. Cheap, local,
   testable through the same event interface, and symmetric with the existing
   cooldown.
2. **Persist state to disk.** Rejected: unnecessary. A process restart starts
   with an empty map, which already re-arms every session safely; disk state
   would only add a corrupt-state surface for behaviour that is self-correcting.
3. **Model-window-relative threshold.** Rejected: the plugin has no verified
   access to `model.limit.input`, and adding a provider API call to discover it
   would introduce an unverified dependency for a tuned constant. The absolute
   threshold stays configurable via `WAM_AUTO_COMPACT_TOKENS` /
   `cfg.autoCompactTokens`.
4. **Drop the guard entirely / rely on cooldown only.** Rejected: the cooldown
   expires on its own and would re-compact sessions that are still near their
   post-compaction size, which is what the guard was protecting against.

## Decision
- State shape: `{ at, total, armed }`.
- Hysteresis check runs before the `total < threshold` gate so a sub-threshold
  event can still re-arm; otherwise re-arm could never be observed (re-arm
  bound is below the threshold by construction).
- `auto: true` in the summarize body makes OpenCode record the compaction as
  automatic.
- Single-flight `Set` prevents a duplicate summarize while one is in flight;
  cleared in `finally`.
- Errors are logged with `console.warn` unconditionally, because a silent
  compaction failure is exactly the failure mode this change fixes; the
  opt-in `wamLog` line stays for the success path.

## Risks
- If OpenCode never reports a sub-threshold total after compaction, the session
  stays disarmed until restart. Accepted: restart re-arms.
- The hysteresis factor (0.5) is not configurable; it is a safety margin, not a
  tuning knob.
