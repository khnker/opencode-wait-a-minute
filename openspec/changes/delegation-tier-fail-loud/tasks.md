# Tasks: Fail loud on unknown subagent types

## Implementation

- [x] Add `resolveSubagentTier(subagentType)` → `{ tier, unknown }` in
      `src/skills/subagent-model-availability.js`.
- [x] Delegate `tierForSubagentType()` to it (same `"medium"` fallback, same string return).
- [x] `guardSubagentDispatch()`: derive `baseTier`/`unknownSubagentType` from
      `resolveSubagentTier` and add `unknownSubagentType: true` plus a `recommendation`
      naming the type and defaulted tier. `allowed` stays `true`.
- [x] `src/execution/runtime-guards.js`: return the guard result when it carries a
      `recommendation`; escalation and nudge untouched.

## Tests

- [x] `resolveSubagentTier`: known types (`fast`, `Heavy`, `planner`, `null`) unchanged.
- [x] `resolveSubagentTier`: unknown type → `{ tier: "medium", unknown: true }`.
- [x] `guardSubagentDispatch`: unknown type → `allowed: true`, `unknownSubagentType: true`,
      recommendation mentions the type and the tier.
- [x] `guardSubagentDispatch`: known type carries no flag and no recommendation.
- [x] `guardSubagentDispatch`: 2 consecutive failures still escalate `fast → medium`.
- [x] `guardSubagentDispatch`: unknown type never throws (empty registry).

## Validation

- [x] `node --test --test-force-exit src/skills/subagent-model-availability.test.mjs`.
- [x] `npx openspec validate --changes --strict`.
- [x] `npm run build` and load-check `dist/`.
