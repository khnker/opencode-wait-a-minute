# task-inference-logic Specification

## Purpose
TBD - created by archiving change task-inference-logic. Update Purpose after archive.
## Requirements
### Requirement: buildTaskInferenceDirective maps requirements to tasks deterministically
The function `buildTaskInferenceDirective` SHALL accept `objective`, `requirements = []`, `prompt = ""`, and optional `context`, and map every requirement into a task object carrying the flags `isService` and `dataIntensive`.

#### Scenario: Endpoint requirement maps to a service task
- GIVEN an objective "Habilitar endpoint /health" and a requirement titled "Habilitar endpoint /health"
- WHEN `buildTaskInferenceDirective` is called
- THEN the returned `inferred` array contains a task whose title references the endpoint
- AND that task has `isService: true`
- AND the task's criteria include `LOCAL_SERVICE_CHECK` and `VALIDATION`

#### Scenario: Data requirement maps to a data-intensive task
- GIVEN an objective with a requirement titled "Cargar 10k registros"
- WHEN `buildTaskInferenceDirective` is called
- THEN the returned `inferred` array contains a task with `dataIntensive: true`
- AND that task's criteria include `DATA_REVIEW`

#### Scenario: Empty requirements yield an empty directive
- GIVEN an objective with an empty requirements array
- WHEN `buildTaskInferenceDirective` is called
- THEN `lines` is an empty array
- AND `inferred` is an empty array
- AND the returned `objective` equals the input objective

### Requirement: Directive lines follow the contract format
The directive SHALL be emitted as an array of plain string lines that the host agent LLM can read directly.

#### Scenario: Directive includes objective, current tasks, inferred tasks, instruction and example
- GIVEN a non-empty requirements array
- WHEN `buildTaskInferenceDirective` is called
- THEN the first line contains the objective prefixed with "TASK INFERENCE DIRECTIVE"
- AND a line lists the current tasks
- AND each inferred task line includes its id, description and criteria
- AND a line contains the instruction to infer non-implicit tasks and not declare DONE
- AND a line contains the example "habilitar un endpoint → verificar el servicio en local + revisar 10% de los datos + validar"

#### Scenario: Directive is deterministic
- GIVEN identical inputs
- WHEN `buildTaskInferenceDirective` is called twice
- THEN both returned `lines` arrays are deep-equal
- AND both returned `inferred` arrays are deep-equal

### Requirement: Directive injection is guarded and idempotent
The productive flow in `src/integration/message-handler.js` SHALL inject the directive into the agent context exactly once per task lifecycle.

#### Scenario: Injection happens only when an objective exists and the phase is not DONE
- GIVEN `updatedState.contract.objective` is set and `updatedState.phase !== "DONE"`
- WHEN `handleMessage` assembles the context
- THEN the directive lines are pushed into the `inject` array
- AND `updatedState.inferenceDirectiveShown` is set to `true`

#### Scenario: Injection is skipped for trivial classifications
- GIVEN `updatedState.classification === "trivial"`
- WHEN `handleMessage` assembles the context
- THEN no directive lines are injected
- AND `updatedState.inferenceDirectiveShown` remains unchanged

#### Scenario: Injection is idempotent across messages
- GIVEN `updatedState.inferenceDirectiveShown === true`
- WHEN `handleMessage` runs again on the same task
- THEN no directive lines are injected a second time

### Requirement: Completion criteria are inferred and evaluated
The engine SHALL derive completion criteria per inferred task and evaluate whether a task satisfies them.

#### Scenario: evaluateCompletion respects the weighted threshold
- GIVEN a task with criteria whose normalized weights sum to 1
- WHEN `evaluateCompletion` is called with a minCompletionWeight of 0.6
- THEN it returns `true` when the achieved weight is exactly 0.6
- AND it returns `false` when the achieved weight is 0.5999

#### Scenario: normalizeWeights produces positive weights that sum to one
- GIVEN a task with three criteria (isService, dataIntensive and a deploy tag)
- WHEN `normalizeWeights` is applied
- THEN every weight is greater than 0
- AND the weights sum to exactly 1

### Requirement: Real LLM harness validates the directive end-to-end
The integration test `tests/integration/task-inference-real-llm.test.mjs` SHALL exercise the directive against a live LLM when configured.

#### Scenario: Test skips cleanly without configuration
- GIVEN the `WAM_BENCH_BASE_URL`, `WAM_BENCH_API_KEY` and `WAM_BENCH_MODEL` environment variables are unset
- WHEN the test runs
- THEN it is skipped and exits successfully

#### Scenario: Test asserts the LLM returns inferred tasks and completion checks
- GIVEN the environment variables are set to a reachable LLM endpoint
- WHEN the test sends the directive and parses the JSON response
- THEN the response contains a non-empty `inferredTasks` array
- AND the response contains a non-empty `completionChecks` array
- AND at least one completion check references local service or validation
- AND at least one completion check references data, sample, 10% or muestra

