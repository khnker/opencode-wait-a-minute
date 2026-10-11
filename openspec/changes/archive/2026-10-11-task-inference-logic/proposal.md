schema: spec-driven
created: 2026-10-09
proposal.md:
  title: Task Inference Logic — Directive Builder and Injection
  description: |
    Add a pure function `buildTaskInferenceDirective` to map requirements → tasks, infer non‑implicit tasks, and emit a directive for the host LLM. Wire into the productive flow (message‑handler.js) to inject the directive once per task lifecycle when the contract objective exists, phase is not DONE, and classification is not trivial. Close unit‑test gaps for generation/validation/normalization/boundary.
  rationale: Enables deterministic non‑implicit task inference and provides the host LLM a structured prompt to continue work beyond explicit requirements, enforcing verifiable completion.
  acceptance: All new tests pass, integration flow injects directive, directive respects requirements mapping, includes example "habilitar un endpoint → verificar el servicio en local + revisar 10% de los datos + validar".

runner: |
  Summary of what this change does:
  1. Adds `buildTaskInferenceDirective` in `src/cognition/task-inference-engine.js`:
     - Maps requirements → tasks (flags: isService, dataIntensive)
     - Calls `inferNextTasks` to get deterministic inferred tasks
     - Builds directive lines (objective, current tasks, inferred tasks with criteria, instruction, example)
     - Returns `{ lines, inferred, objective }`
  2. Wires injection in `src/integration/message-handler.js`:
     - Adds import
     - Around line 567, before the `if (inject.length > 0)` gate, under the stated guard
     - Builds directive, pushes `lines` into `inject`
     - Persists `inferenceDirectiveShown` flag and conditionally sets it
  3. Closes unit‑test gaps:
     - `generateCompletionCriteria` with tag "breaking" → includes DOCUMENTATION
     - `evaluateCompletion` boundary: weight 0.6 → true at exactly 0.6, false at 0.5999
     - `normalizeWeights` via a 3‑criteria task → weights sum exactly 1, no zero weight
     - `buildTaskInferenceDirective` for endpoint requirement → service task + LOCAL_SERVICE + VALIDATION criteria
  4. Adds deterministic integration test (`tests/integration/task-inference-flow.test.mjs`):
     - Idempotency
     - Structure assertions (objective, lines, inferred)
     - 10% + local reference
    5. Adds optional real‑LLM integration test (`tests/integration/task-inference-real-llm.test.mjs`):
     - Skips if WAM_BENCH_* env vars missing
n     - Builds endpoint directive and sends to external LLM
     - Asserts inferred tasks list and completion checks mention local/service, 10%/data/sample/muestra/validation.
  6. Updates existing change directory `openspec/changes/task-inference-logic/`:
     - Refreshes `proposal.md`
     - Adds `tasks.md` with actionable tasks
     - Updates `.openspec.yaml` (or preserves stub)

MVP ✅

status: open
