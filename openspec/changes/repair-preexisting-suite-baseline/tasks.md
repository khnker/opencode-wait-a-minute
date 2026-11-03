# Tasks: Repair pre-existing suite baseline

- [x] Regenerate prompt-eval baselines with `node benchmarks/quality/prompt-eval/freeze-baseline.mjs`
- [x] Verify the only baseline diff is the `injection.delegation` hash in `core.json` and `delegation.json`
- [x] Remove `"task"` from `OUT_OF_SCOPE_TOOLS` in `src/policy/action-capabilities.js`
- [x] Keep `compress`, `delegate_task`, `call_agent` and `skill` out of scope
- [x] Update `tests/zero-friction-injection.test.mjs` to the current advisory wording
- [x] Add regression coverage: `task` is GUARDED (catalog, effective, mutating, `evaluateAction`); meta-tools stay SAFE
- [x] Run targeted suites (`baseline`, `autonomy-behavioral`, `zero-friction-injection`, `risk-engine.failclosed`)
- [x] Run `npm run build` and `openspec validate --changes --strict`
- [x] Run `node scripts/run-tests.mjs` and confirm `fail 0`
