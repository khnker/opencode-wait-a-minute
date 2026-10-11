title: Task Inference Logic — Directive Builder and Injection

## Tasks

- [x] 1. **src/cognition/task-inference-engine.js**
  - [x] Add `mapRequirementsToTasks` helper (pure, deterministic)
  - [x] Add `buildTaskInferenceDirective` exported function:
    * [x] Accepts `objective, requirements = [], prompt = ""` and optional `context`
    * [x] Maps requirements into task objects with flags (`isService`, `dataIntensive`)
    * [x] Calls existing `inferNextTasks` to get inferred non‑implicit tasks
    * [x] Builds directive lines array (objective, current tasks, inferred tasks with criteria, instruction, example)
    * [x] Returns `{ lines, inferred, objective }`
    * [x] Handles empty requirements (returns empty lines/inferred)
  - [x] Ensure all changes are pure and no I/O

- [x] 2. **src/integration/message-handler.js**
  - [x] Import `buildTaskInferenceDirective`
  - [x] In context assembly block after `assembleContext` catch, before the `gate.blocked` block:
    * [x] Guard: `updatedState.contract?.objective` exists, `updatedState.phase !== "DONE"`, classification not "trivial"
    * [x] Guard: `!updatedState.inferenceDirectiveShown`
    * [x] Call directive builder with `objective` and `requirements`
    * [x] If `lines.length > 0`, push `...lines` into `inject`
    * [x] Set `updatedState.inferenceDirectiveShown = true` and persist state
  - [x] Mirror `contractDisplayed` pattern for flag lifecycle

- [x] 3. **src/cognition/task-inference-engine.test.mjs**
  - [x] Add tests for `generateCompletionCriteria` with tag "breaking" → includes DOCUMENTATION
  - [x] Add test for `evaluateCompletion` boundary: weight 0.6 → true at exactly 0.6, false at 0.5999
  - [x] Add test for `normalizeWeights` via a task with three criteria (`isService` + `dataIntensive` + `deploy` tag) → weights sum exactly 1, all weights > 0
  - [x] Add test for `buildTaskInferenceDirective`: endpoint requirement → service task + LOCAL_SERVICE + VALIDATION criteria
  - [x] Add test for `buildTaskInferenceDirective`: no requirements → empty directive

- [x] 4. **tests/integration/task-inference-flow.test.mjs**
  - [x] Idempotency (two calls deep equal)
  - [x] Structure assertions (objective, lines, inferred)
  - [x] 10% + local reference present in directive

- [x] 5. **tests/integration/task-inference-real-llm.test.mjs**
  - [x] Skips if `WAM_BENCH_*` env vars missing
  - [x] Builds endpoint directive and sends to external LLM
  - [x] Asserts inferred tasks list and completion checks mention local/service, 10%/data/sample/muestra/validation
  - [x] Verified against omnirouter (`deepseek-v4.1-flash`) → 1/1 pass

- [x] 6. **openspec/changes/task-inference-logic/**
  - [x] Refreshes `proposal.md`
  - [x] Adds `tasks.md` with actionable tasks
  - [x] Adds `specs/task-inference-logic/spec.md` delta (ADDED Requirements with scenarios)
  - [x] `openspec validate task-inference-logic --type change` → valid

## Verification

- `node --check` passes for `src/cognition/task-inference-engine.js` and `src/integration/message-handler.js`
- `node --test src/cognition/task-inference-engine.test.mjs` → 23/23 pass
- `node --test tests/integration/task-inference-flow.test.mjs` → 3/3 pass
- `node --test tests/integration/task-inference-real-llm.test.mjs` → skips cleanly without env; 1/1 pass with `WAM_BENCH_*` set
- `openspec validate --changes` → change `task-inference-logic` valid