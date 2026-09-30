# Design: Token Savings Evidence Benchmark

## 1. Architecture

The benchmark is divided into six components:

```text
Scenario
   │
   ▼
Runner
   │
   ├──────────────► Baseline
   │
   └──────────────► WAM
                         │
                         ▼
                   Raw Measurements
                         │
                         ▼
                      Analyzer
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
         JSON Evidence           Graphs
              │                     │
              └──────────┬──────────┘
                         ▼
                    Report
```

The benchmark must not infer measurements from the final report.

The report and graphs must be generated exclusively from machine-readable benchmark results.

---

## 2. Benchmark levels

### Level 1 — deterministic trace benchmark

The benchmark uses controlled traces representing agent interaction.

Example:

```text
USER
ASSISTANT
TOOL
TOOL
ASSISTANT
VERIFICATION
CONTINUATION
TOOL
VERIFICATION
DONE
```

The same trace is evaluated under:

```text
baseline
WAM
```

The benchmark calculates context and token costs from the trace.

This level is deterministic and suitable for CI.

### Level 2 — real-model benchmark

The benchmark executes an identical scenario against a real model:

```text
Baseline
    model + OpenCode
    WAM disabled

WAM
    same model + OpenCode
    WAM enabled
```

The following must remain constant:

* model identifier;
* model version where available;
* repository;
* task;
* initial repository state;
* tool permissions;
* system-level benchmark configuration;
* temperature and sampling configuration where supported;
* maximum execution budget.

Provider-reported token counts take precedence over estimates.

If provider usage is unavailable, estimated counts must be explicitly marked as estimates.

---

## 3. Scenarios

The initial benchmark must contain at least five scenarios.

### S1 — Simple task

A short implementation task with limited context.

Purpose:

* establish baseline overhead;
* verify that WAM does not introduce significant overhead for short tasks.

### S2 — Multi-step implementation

A task involving:

```text
inspect
→ modify
→ test
→ modify
→ verify
```

Purpose:

* measure repeated context transmission.

### S3 — Failed implementation and retry

A task where the first implementation fails verification and requires another iteration.

Purpose:

* measure whether WAM avoids unnecessarily rebuilding context after failure.

### S4 — Long-running continuation

A task involving multiple continuation cycles:

```text
initial task
→ implementation
→ verification
→ continuation
→ verification
→ continuation
→ final verification
```

This is the primary context-reuse scenario.

### S5 — Multi-task/session switching

Multiple tasks are executed within related sessions.

Purpose:

* verify that context savings do not depend on incorrectly sharing state between tasks.

Task isolation must remain valid.

---

## 4. Baseline definition

Baseline means the same scenario executed without WAM-specific context lifecycle behavior.

Baseline MUST NOT receive additional context or restrictions that WAM does not receive.

The benchmark must document any OpenCode-native behavior that remains active in both runs.

The comparison is:

```text
WAM-specific behavior
vs
same environment without WAM-specific behavior
```

not:

```text
optimized configuration
vs
artificially degraded configuration
```

---

## 5. Measurements

Every execution records at least:

```text
scenario_id
run_id
mode
model
input_tokens
output_tokens
total_tokens
turns
tool_calls
context_rebuilds
registry_scans
continuations
verified_requirements
completion_status
```

Additional measurements may be recorded when available.

### Token measurements

The benchmark distinguishes:

```text
input_tokens
output_tokens
total_tokens
estimated_context_tokens
```

Provider-reported values must be marked as:

```text
source = provider
```

Estimated values:

```text
source = estimator
```

No estimate may be presented as provider-reported usage.

---

## 6. Token savings

For each paired execution:

```text
input_savings =
    baseline_input_tokens - wam_input_tokens

input_savings_pct =
    input_savings / baseline_input_tokens * 100
```

Likewise:

```text
total_savings =
    baseline_total_tokens - wam_total_tokens

total_savings_pct =
    total_savings / baseline_total_tokens * 100
```

Negative savings are valid and must be reported.

The benchmark MUST NOT clamp negative values to zero.

This is important because WAM may introduce overhead for short tasks.

---

## 7. Verified progress

Token efficiency must account for useful task progress.

Define:

```text
verified_progress =
    verified_requirements / total_requirements
```

The benchmark must record the completion status separately from token consumption.

The primary efficiency metric is:

```text
verified_progress_per_1k_input_tokens =
    verified_progress /
    (input_tokens / 1000)
```

For completed scenarios this can be interpreted as:

```text
1 / (input_tokens / 1000)
```

but the generalized metric must support partially completed scenarios.

A run that consumes fewer tokens but fails verification MUST NOT be represented as a successful efficiency improvement.

---

## 8. Paired real-model runs

Real-model benchmarks should use paired runs.

For each scenario:

```text
scenario S4
    ├── baseline run 1
    ├── WAM run 1
    ├── baseline run 2
    ├── WAM run 2
    └── ...
```

The preferred minimum sample size is:

```text
N >= 5
```

with:

```text
N = 10
```

recommended for published evidence when cost permits.

The report must include:

* minimum;
* median;
* p25;
* p75;
* maximum.

Mean may be included but MUST NOT be the only summary.

---

## 9. Statistical treatment

For real-model measurements, the primary comparison is paired:

```text
baseline_i
vs
wam_i
```

for the same scenario/run index where the experimental protocol permits pairing.

The report must show:

```text
median input savings %
median total savings %
```

and the distribution of observed savings.

Outliers must remain visible.

Runs may be excluded only when a documented infrastructure failure invalidates the run itself.

A run that represents legitimate model behavior must not be silently discarded because it produces an unfavorable result.

---

## 10. Graph generation

Graphs must be generated programmatically from benchmark JSON.

At minimum generate:

### Graph A — token consumption

Compare:

```text
Baseline
WAM
```

for each scenario.

### Graph B — token consumption across iterations

Show how context/token consumption evolves through a multi-step scenario.

This graph is intended to make WAM's continuation behavior visually understandable.

### Graph C — real-run distribution

Show the distribution of token usage or savings across repeated runs.

The graph must make variance visible.

### Graph D — efficiency

Show:

```text
Verified Progress / 1K Input Tokens
```

for baseline and WAM.

The graph must not imply that lower tokens are automatically better if verified progress differs.

---

## 11. Machine-readable evidence

Each benchmark produces a JSON artifact.

Example:

```json
{
  "benchmark": "token-savings-v1",
  "scenario": "long-running-continuation",
  "model": "example-model",
  "runs": 10,
  "baseline": {
    "input_tokens": {
      "median": 18240,
      "p25": 16400,
      "p75": 20100
    },
    "total_tokens": {
      "median": 21680
    },
    "verified_progress": {
      "median": 1
    }
  },
  "wam": {
    "input_tokens": {
      "median": 9410,
      "p25": 8700,
      "p75": 10300
    },
    "total_tokens": {
      "median": 12420
    },
    "verified_progress": {
      "median": 1
    }
  },
  "savings": {
    "median_input_pct": 48.4,
    "median_total_pct": 42.7
  }
}
```

Actual benchmark output must preserve raw observations in addition to aggregates.

---

## 12. Raw evidence

The benchmark must retain raw measurements before aggregation.

Recommended structure:

```text
benchmarks/
├── scenarios/
├── runner/
├── analysis/
├── reports/
└── results/
    └── <timestamp>/
        ├── raw.json
        ├── summary.json
        ├── report.md
        └── charts/
```

Raw evidence is immutable benchmark input.

Graphs must be reproducible from raw or normalized machine-readable results.

---

## 13. CI behavior

The deterministic benchmark MAY run in CI.

CI should detect regressions in deterministic token/context behavior.

For example:

```text
current_context_tokens
    >
baseline_context_tokens * allowed_regression
```

must fail the benchmark.

The exact threshold should be configurable.

CI MUST NOT require:

* external model credentials;
* network access to an LLM provider;
* provider-specific token accounting.

Real-model benchmarks are explicitly outside the default CI path.

---

## 14. Real-model execution

Real-model execution must be explicitly opt-in.

Example conceptual interface:

```text
npm run benchmark:tokens:real
```

The command must fail with a clear message if required credentials/configuration are absent.

It must not silently fall back to deterministic simulation.

The report must identify:

```text
real_model = true
```

and include model/provider metadata when available.

---

## 15. Reproducibility

Every benchmark result must record:

```text
benchmark_version
git_commit
timestamp
scenario
mode
model
configuration
```

For deterministic benchmarks, identical inputs and commit must produce equivalent measurements.

For real-model benchmarks, exact token results are not expected to be deterministic, but the experimental configuration must be reproducible.

---

## 16. Claims policy

Benchmark artifacts must distinguish:

### Observed

Measured directly from a benchmark execution.

### Estimated

Calculated from context/tokenization when provider usage is unavailable.

### Derived

Calculated from observed measurements.

Documentation MUST NOT convert a single benchmark execution into a universal claim.

For example:

```text
Observed:
"In 10 runs of scenario S4, median input-token consumption was X% lower with WAM."

Not supported:
"WAM reduces token usage by X%."
```

The latter requires broader evidence across models, tasks and environments.
