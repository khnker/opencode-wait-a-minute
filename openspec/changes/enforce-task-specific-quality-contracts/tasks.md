# Tasks

## Phase 1: Profiles and contract resolution

- [x] 1.1 Add pure `src/quality/task-quality-contract.js` with `TASK_KINDS`
- [x] 1.2 Define per-kind evidence templates reusing `TASK_EVIDENCE_TYPES` and `TASK_EVIDENCE_STRENGTH`
- [x] 1.3 Implement `resolveQualityContract(state)` with precedence: criterion > kind > global
- [x] 1.4 Handle `unknown` kind without blocking and name the profile in reasons

## Phase 2: Deterministic evaluation

- [x] 2.1 Implement `evaluateEvidenceSufficiency(contract, evidence, { now })`
- [x] 2.2 Implement `detectStaleEvidence(evidence, { hashes, now, maxAgeMs })`
- [x] 2.3 Implement `detectContradictions(contract, evidence)`
- [ ] 2.4 Unit tests for all six kinds, weak evidence, stale evidence and contradictions
- [ ] 2.5 Property tests: malformed evidence never throws; evaluator is pure

## Phase 3: Gate and loop integration

- [x] 3.1 Add `qualityContracts: { enabled: false }` to `wam-config.js`
- [x] 3.2 Extend the adapter snapshot with `quality`
- [x] 3.3 Map `missing`/`stale` to `VERIFY` and `contradiction` to `REPLAN` in `task-loop.js`
- [x] 3.4 Require `quality.sufficient !== false` in the completion gate when enabled
- [x] 3.5 Regression tests: flag off is unchanged; flag on blocks nominal DONE
- [ ] 3.6 Test that a well-evidenced task per kind is not blocked

## Phase 4: Observability

- [ ] 4.1 Emit `quality.evaluated` records compatible with the Change 13 schema
- [ ] 4.2 Document the evidence model and the flag in the change README

## Phase 5: Validation

- [x] 5.1 Run affected suites with `node --test --test-force-exit`
- [x] 5.2 Run `npm run build` and load-check `dist/`
- [x] 5.3 Run `openspec validate --changes --strict`
- [ ] 5.4 Smoke the evaluator with one fixture per task kind
