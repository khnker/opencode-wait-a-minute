# Tasks: fix-quality-benchmark-final-answer-injection
## 1. Fix the injection helper
- [x] 1.1 Append `ANSWER_INSTRUCTION` to the last user message via `findLastIndex` (remove the `lastIndexOf(number)` bug)
- [x] 1.2 Keep the helper pure (return a copy, never mutate the input)
- [x] 1.3 Export `appendFinalAnswerInstruction` for testing

## 2. Wire it into the run
- [x] 2.1 Wrap the resolved provider in `runQualitySuite` so both arms receive the instruction
- [x] 2.2 Preserve provider `this` binding (call the method on the real provider)
- [x] 2.3 Accept a provider object in `runQualitySuite` (in addition to `"mock"`/resolved)

## 3. Tests
- [x] 3.1 Unit: appends only to the last user message; earlier messages untouched; input not mutated
- [x] 3.2 Integration: `runQualitySuite` injects the instruction into BOTH arms

## 4. Validation
- [x] 4.1 `node --test benchmarks/quality/*.test.mjs` all green
- [x] 4.2 `openspec validate --changes --strict` passes
- [x] 4.3 `node scripts/prompts-check.mjs` stays OK
