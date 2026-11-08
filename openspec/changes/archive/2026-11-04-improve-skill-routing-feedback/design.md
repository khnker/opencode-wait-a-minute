# Design: Improve skill routing with IDF and outcome feedback

## Decisions

- Weight keywords with IDF over the skill registry to penalize ubiquitous terms.
- Deduplicate by capability and cap skills per lane (3 conversation, 5 task, 8 strict).
- Record skill outcomes in .wam/skills/outcomes.json and apply a small success bonus / failure penalty.
- Research: BM25/IDF, MMR diversification and learning-to-rank; rejected an online bandit because the outcome volume is too low.

## Research

- Anthropic, Effective context engineering for AI agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Weaviate, Hybrid search: https://docs.weaviate.io/weaviate/search/hybrid
- ClarifyGPT: https://arxiv.org/abs/2310.10996
- Ragas metrics: https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
- Letta memory: https://docs.letta.com/
