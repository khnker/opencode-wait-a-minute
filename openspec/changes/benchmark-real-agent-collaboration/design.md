# Design: benchmark-real-agent-collaboration

## Research

- AgentBench: Evaluating LLMs as Agents — <https://arxiv.org/abs/2308.03688>
  motivates scenario-based evaluation with explicit, per-task success criteria
  and reproducible harnesses rather than ad-hoc prompting.
- OpenAI Evals — <https://github.com/openai/evals>
  establishes the eval registry pattern: a harness owns the scenario and
  metrics, while the evaluated model/adapter is injected at run time.
- NIST AI RMF Generative AI Profile —
  <https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence>
  recommends measuring generative systems with documented, repeatable
  evaluations and clear provenance for the configuration under test.

## Decisions and alternatives

### 1. Inject an `adapterFactory` instead of importing a model SDK (chosen)

The benchmark receives `adapterFactory({ scenario })` and returns an object with
`invoke(request)`, matching the existing orchestrator adapter contract. This
keeps the benchmark model-agnostic, lets tests inject a deterministic scripted
adapter, and keeps CI offline.

Rejected alternatives:

- **Import a concrete provider SDK in the benchmark.** Would add a network/model
  dependency to a repository whose CI must stay deterministic and offline, and
  would lock the benchmark to one vendor.
- **Accept a plain adapter instance instead of a factory.** A single adapter
  cannot be scoped per scenario, so scenario-specific behavior (for example a
  distinct seed or objective) would leak across runs. The factory receives the
  scenario and can build a fresh adapter for each one.

### 2. Reuse `runAgentFeedbackOrchestration` (chosen)

The benchmark only wraps the adapter to record requests/results and reads the
orchestrator outcome. Metrics therefore describe the real pipeline.

Rejected alternatives:

- **Reimplement the analyst → architect → builder → reviewer loop inside the
  benchmark.** Duplicates orchestration logic, drifts from production behavior,
  and would make the metrics meaningless as a measure of the real pipeline.
- **Instrument the orchestrator with benchmark-only callbacks.** Pollutes
  production code with evaluation concerns.

### 3. CLI via environment module path (chosen)

`WAM_AGENT_BENCH_ADAPTER` points to a module exporting
`createAdapterFactory` (preferred) or `default`. The CLI fails loud with a
helpful message when the variable or export is missing.

Rejected alternatives:

- **Interactive prompt for a provider/credentials.** Not scriptable and unsafe
  for automation.
- **Hard-coded fixture adapter as the CLI default.** Would silently report
  scripted numbers as if they were real model results.

### 4. Token estimate from serialized payloads (chosen)

Tokens are `ceil(chars / 4)` over serialized requests and results, matching the
existing benchmark. It is deterministic, provider-independent and explicitly an
estimate.

Rejected alternatives:

- **Provider tokenizer/billing APIs.** Requires network, credentials and a
  vendor-specific dependency; not available in offline CI.

## Scenario model

`DEFAULT_SCENARIOS` contains two deterministic scenarios:

- `accepted-first-pass` (seed `101`): the pipeline is expected to complete and
  accept on the first review with zero revisions and replans.
- `revision-accepted` (seed `202`): the first review returns
  `REVISION_REQUIRED`; after one revision the review accepts.

Each scenario has its own objective, revision/replan bounds and expected
outcome. A real adapter decides how to satisfy them; tests inject a scripted
adapter that follows the expected path.

## Report shape

```json
{
  "benchmark": "agent-collaboration-real",
  "scenarios": [
    {
      "scenario": "accepted-first-pass",
      "seed": 101,
      "objective": "...",
      "expected": { "completed": true, "accepted": true, "revisions": 0, "replans": 0 },
      "metrics": {
        "completed": true,
        "accepted": true,
        "revisions": 0,
        "replans": 0,
        "agentInvocations": 4,
        "handoffs": 3,
        "independentReviewArtifacts": 1,
        "estimatedTokens": 1234
      },
      "expectedMet": true
    }
  ]
}
```
