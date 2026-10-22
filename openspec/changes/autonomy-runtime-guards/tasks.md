# Tasks: Autonomy Runtime Guards

- [x] 1. Create `runtime-guards.js` with `evaluateGuardedAction`.
- [x] 2. Wire cognitive state into risk evaluation.
- [x] 3. Add experiment-aware GUARDED authorization.
- [x] 4. Add failure-recording hook (post-action observation).
- [x] 5. Enforce DONE protection in completion gate.
- [x] 6. Add regression tests:
    - [x] GUARDED without experiment requires confirmation.
    - [x] GUARDED with active experiment passes.
    - [x] Failed mutation records observation, doesn't retry.
    - [x] DONE blocked when evidence missing.
