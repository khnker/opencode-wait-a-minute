# Evidence Corpus: External Sources for RC1

## Overview

The evidence corpus (`benchmarks/evidence/sources.json`) is a curated collection of public, reproducible sources that provide external grounding for the RC1 report. It is NOT a comprehensive literature review, but a representative sample of the broader landscape of context‑optimization mechanisms used by LLMs and cloud providers.

## Evidence Taxonomy

| Type        | Description                                                                 | Example Sources                                           |
|-------------|-----------------------------------------------------------------------------|-----------------------------------------------------------|
| **Provider** | Official documentation, billing specs, or engineering posts from API vendors (OpenAI, Anthropic, Google, etc.). They describe built‑in caching or token‑discount mechanisms. | `openai-prompt-caching-2024`, `anthropic-prompt-caching-2024` |
| **Academic** | Peer‑reviewed research papers from conferences and journals. These may introduce new compression algorithms, retrieval strategies, or benchmarks. | `llmlingua-context-compression-2023`, `recomp-extractive-compression-2023` |
| **Open‑Source** | Reproducible benchmarks, open‑source projects, or community‑maintained test suites. These provide empirical data on multi‑turn or long‑context behaviour. | `agentbench-multi-turn-2023`, `locomo-multi-turn-context-2024` |
| **Independent** | Third‑party blog posts, exploratory studies, or technology surveys not covered above. | *(future additions)* |

## Inclusion Criteria

1. **Public & Citable** – The source must be available for free or through a reputable publisher and must include a DOI or URL.
2. **Quantitative Metric** – A clear, numeric metric (e.g., token cost, success rate, compression ratio) reported on a well‑defined population.
3. **Reproducible Methodology** – The experimental setup is described in enough detail that an external researcher could repeat the work.
4. **RC1 Relevance** – Directly or indirectly addresses one of the following RC1 themes:
   - Prompt‑caching or provider‑side token discounts.
   - Context‑compression (token‑level or passage‑level).
   - Multi‑turn agent memory or long‑context retention.
   - Reproducible benchmarking of context‑size trade‑offs.

## Warning about Provider Caching

Provider caching (e.g., OpenAI *prompt caching*, Anthropic *cache_control*) is a **cost‑optimisation** technique: when the same prompt prefix is sent repeatedly, the API vendor may bill at a reduced rate and/or serve from a faster path. This is **not** evidence that the WAM context selector reduces the amount of context a model attends to.

In the RC1 report, cached‑token savings are reported **separately** (under `externalEvidence`) to avoid conflating billing savings with WAM’s internal metrics (deterministic validation, empirical dry‑run). Any comparison must explicitly acknowledge that provider caching does not shrink the effective context window of the LLM.

## How the Corpus Is Used in RC1

The `sources.json` corpus is loaded by `benchmarks/evidence/index.mjs`. The RC1 report generator (`benchmarks/reporters/rc1-report.mjs`) extracts entries by type when building the **External Evidence** section. The `relevance` field is rendered as plain text to give readers context without mixing it into the quantitative metrics.

## References

All entries are listed in `sources.json` with a stable `id` field that can be referenced in the RC1 report’s footnotes. The `limitations` field highlights why a source cannot be directly compared with WAM’s internal results.
