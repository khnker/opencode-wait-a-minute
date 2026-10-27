# Design: Add hybrid intent history retrieval

## Decisions

- Hybrid score: BM25 lexical score + recency decay + task similarity + outcome (success/failure).
- Retrieve top-k with a threshold; if nothing clears the threshold, inject nothing.
- Reuse a previous contract when similarity > 0.85 and the user confirms merge/reuse.
- Research: Weaviate hybrid search (BM25 + vector fusion) and Anthropic just-in-time context retrieval; rejected a vector DB dependency, kept lexical + deterministic features.

## Research

- Anthropic, Effective context engineering for AI agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Weaviate, Hybrid search: https://docs.weaviate.io/weaviate/search/hybrid
- ClarifyGPT: https://arxiv.org/abs/2310.10996
- Ragas metrics: https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
- Letta memory: https://docs.letta.com/
