# RC1 Evidence Report

Generated: 2026-10-05T11:02:10.244Z

This report keeps three kinds of evidence strictly separate. They are **not** combined into a single number, and no section's numbers stand in for another's.

## A. Internal Deterministic

Source: `benchmarks/run-validation.mjs` — deterministic-simulation, no network.

### Snapshot correctness
- Cases: 10
- Passed: 10
- Failed: 0
- All passed: true

### Fast path
- Fast-path count: 34
- Fast-path rate: n/a

### Rebuild avoidance
- Context rebuilds: 8
- Full rebuilds: 5
- Partial rebuilds: 3

### Deterministic accounting
- Scenarios: 8
- Turns: 42
- Total reduction: 69.6%

## B. Empirical Real (dry-run)

Source: `benchmarks/run-real.mjs (runDryRun)` — provider `mock`, model `mock/dry-run`, no network.

- Input tokens (WAM): 870
- Input tokens (baseline): 195
- Total tokens: 1080
- Rebuilds: 30
- outcomeMatch: 0 / 30
- Non-equivalent: 30
- State equivalent: true
- Net input savings: -675

### Multi-turn breakdown

| scenario | turns | baseline input | wam input | rebuilds | net savings |
| --- | --- | --- | --- | --- | --- |
| local | 1 | 5 | 29 | 1 | -24 |
| contextual | 1 | 6 | 29 | 1 | -23 |
| continuation | 20 | 151 | 580 | 20 | -429 |
| mutation | 7 | 28 | 203 | 7 | -175 |
| negative-control | 1 | 5 | 29 | 1 | -24 |

### INVALID_COMPARISON markers

None.

## C. External Evidence

Corpus: `wam-rc1-external-evidence` v1.0.0 — 6 sources.

These are **mechanism precedents**, not measurements of WAM. They are listed so the reader can see the surrounding design space.

> **Cached tokens are reported separately and are not WAM evidence.**
> Provider prompt-caching figures below describe BILLING/THROTTLING behaviour, not context reduction: a cached prefix is still read by the model and still occupies the context window. They are NOT evidence of WAM context reduction. Cached tokens are reported separately and are never merged with, or substituted for, WAM's internal metrics.

| type | count |
| --- | --- |
| provider | 2 |
| academic | 2 |
| open-source | 2 |
| independent | 0 |

### `openai-prompt-caching-2024` (provider)

- Source: OpenAI — Prompt Caching (official documentation, 2024)
- Date: 2024-08
- Metric: discount on cached prompt tokens
- Population: all OpenAI API requests on supported models (gpt-4o, gpt-4o-mini, gpt-4-turbo)
- Relevance: Provider-side caching is structurally unrelated to WAM context selection. It does not shrink the context the model attends to and does not measure what the application chooses to send. Listed here only to ensure the RC1 report acknowledges the existence of provider caching and explains why it is not part of WAM evidence.
- Limitations: Provider caching reduces cost, not the amount of context processed. Cached tokens still count toward the model's effective context window. WAM's internal metrics (deterministic validation, empirical dry-run) measure selector behaviour, not cache hit rate. Conflating the two would invalidate any comparison.

### `anthropic-prompt-caching-2024` (provider)

- Source: Anthropic — Prompt Caching documentation (2024)
- Date: 2024-08
- Metric: cache_control breakpoint reuse rate; latency on cached prefixes
- Population: Claude API users opting in to cache_control
- Relevance: Same caveat as OpenAI caching: this is a billing/latency optimisation, not a mechanism for reducing the application's effective context. Useful as background context only.
- Limitations: Even with cache_control, the model still attends to the full prompt up to the cache hit. WAM operates one layer above: it chooses what to send. The two are complementary, not substitutes.

### `llmlingua-context-compression-2023` (academic)

- Source: Li, Yan, et al. — 'LLMLingua: Compressing Prompts for Accelerated Inference of Large Language Models' (EMNLP 2023)
- Date: 2023-10
- Metric: compression ratio vs. accuracy retention on QA benchmarks
- Population: NaturalQuestions, MS MARCO, TriviaQA, meeting summarisation; multiple LLM backbones (LLaMA, GPT-3.5)
- Relevance: Establishes that prompt compression is a viable mechanism for reducing LLM context cost. WAM uses selection (drop entire nodes/turns) rather than token-level compression, but the underlying motivation — that most context is not load-bearing — is the same.
- Limitations: LLMLingua works at the token level and may degrade on tasks that require exact phrasing or identifiers. WAM's mechanism is coarser-grained but verifiable. The two are not directly comparable without a shared task suite.

### `recomp-extractive-compression-2023` (academic)

- Source: Xu, Shi, et al. — 'RECOMP: Retrieval-Augmented Language Models for Compressive Passage Retrieval' (2023)
- Date: 2023-05
- Metric: QA accuracy vs. context length
- Population: HotpotQA, FEVER, StrategyQA
- Relevance: Another academic precedent for context compression, framed as a retrieval-plus-extraction pipeline. Useful for situating WAM's selection-only approach against the broader literature.
- Limitations: Different evaluation surface (QA accuracy) from WAM's accounting metrics (rebuilds avoided, fast-path hits, deterministic equivalence). Not directly commensurable.

### `agentbench-multi-turn-2023` (open-source)

- Source: Liu, Xiao, et al. — 'AgentBench: Evaluating LLMs as Agents' (2023)
- Date: 2023-08
- Metric: task success rate, total tokens consumed per task, cost per task
- Population: 8 environments, 27 LLM configurations, fixed prompt templates
- Relevance: Establishes a reproducible pattern for measuring token cost of multi-turn agent runs. WAM's empirical dry-run uses a similar scenario-driven, paired-baseline structure to estimate token cost on agentic trajectories.
- Limitations: AgentBench evaluates agents end-to-end, not context selectors. WAM's contribution is at the selector layer. The two layers can be combined but AgentBench's headline metric (success rate) is not the metric WAM reports.

### `locomo-multi-turn-context-2024` (open-source)

- Source: Maharana et al. — 'LoCoMo: Long Conversation Memory Benchmark' (2024)
- Date: 2024-04
- Metric: QA accuracy on long-conversation probes under different context regimes
- Population: LoCoMo synthetic conversations, multiple LLM backbones
- Relevance: Directly relevant: a public, reproducible benchmark for measuring how much context a long-conversation agent actually needs to answer correctly. Provides external grounding for the claim that long context is not always load-bearing.
- Limitations: LoCoMo focuses on conversational QA, not engineering tasks. WAM's empirical evidence is on engineering trajectories. The shared insight is that context selectivity does not destroy task performance, but the magnitudes are not directly comparable.

## Comparison notes

- internalDeterministic (validation harness) and empiricalReal (dry-run harness) are separate experiments. Their absolute values are reported side by side for transparency and are NOT a like-for-like comparison.

## Comparison issues

- `INVALID_COMPARISON`: internal deterministic reduction=69.6% but dry-run netInputSavings=-675 (negative). The dry-run mock provider shows WAM overhead exceeding baseline context. These do not contradict each other: they measure different things on different harnesses. No single net-savings number is claimed.
