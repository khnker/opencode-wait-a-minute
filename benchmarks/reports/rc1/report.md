# RC1 Evidence Report

Generated: 2026-10-05T11:33:56.266Z

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

## B. Empirical Real (live provider)

Source: `benchmarks/run-real.mjs (live provider)` — provider `openai-compatible`, model `auto/best-fast`, live network.

- Input tokens (WAM): 35053
- Input tokens (baseline): 225077
- Total tokens: 155288
- Rebuilds: 54
- outcomeMatch: 0 / 39
- Non-equivalent: 39
- State equivalent: true
- Net input savings: 95357

> **Live-run caveat:** `outcomeMatch`/`Non-equivalent` compare the exact normalized text of two independent stochastic LLM generations (baseline vs WAM). For live provider runs these are expected to be ~0 and are NOT a correctness signal. The authoritative live signals are `State equivalent`, the deterministic internal suite, and `Net input savings`.

### Multi-turn breakdown

| scenario | turns | baseline input | wam input | rebuilds | net savings |
| --- | --- | --- | --- | --- | --- |
| S7 | 3 | 17228 | 2863 | 6 | 9407 |
| S8 | 1 | 5417 | 954 | 1 | 2813 |
| S9 | 1 | 4583 | 1889 | 1 | 1322 |
| S10 | 1 | 3457 | 261 | 1 | 1441 |
| S11 | 1 | 5205 | 495 | 1 | 2514 |
| S12 | 1 | 5193 | 495 | 1 | 2502 |
| S13 | 1 | 6041 | 963 | 1 | 2983 |
| S14 | 1 | 7995 | 1431 | 1 | 4585 |
| S15 | 1 | 8967 | 495 | 1 | 6276 |
| S16 | 1 | 11883 | 2367 | 1 | 7769 |
| S17 | 2 | 10299 | 1458 | 2 | 4535 |
| S18 | 3 | 16021 | 2889 | 3 | 6292 |
| S19 | 2 | 8269 | 1458 | 2 | 2257 |
| S20 | 4 | 19234 | 3384 | 10 | 4626 |
| S21 | 4 | 18143 | 2916 | 4 | 3695 |
| S22 | 1 | 6874 | 971 | 1 | 3070 |
| S23 | 1 | 7855 | 1207 | 1 | 3851 |
| S24 | 1 | 8839 | 1443 | 1 | 4577 |
| S25 | 1 | 7823 | 1679 | 1 | 3476 |
| S26 | 4 | 31909 | 5300 | 10 | 15701 |
| S27 | 1 | 3454 | 27 | 1 | 359 |
| S28 | 1 | 3454 | 27 | 1 | 359 |
| S29 | 1 | 3469 | 42 | 1 | 467 |
| S30 | 1 | 3465 | 39 | 1 | 480 |

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

- internalDeterministic (validation harness) and empiricalReal (live provider harness) are separate experiments. Their absolute values are reported side by side for transparency and are NOT a like-for-like comparison.

## Comparison issues

None.
