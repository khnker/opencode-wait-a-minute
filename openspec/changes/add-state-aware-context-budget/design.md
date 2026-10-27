# Design: Add state-aware context budgets

## Decisions

- Per-state budgets: CONVERSATION minimal, CONTINUATION N2 + last decisions, TASK_NEW N1 project + N2 contract, VERIFYING evidence only.
- Progressive disclosure: summary first, details on demand.
- Deduplicate sources and drop stale entries.
- Research: Anthropic context engineering (minimal high-signal token set, just-in-time retrieval); rejected a fixed global budget.

## Research

- Anthropic, Effective context engineering for AI agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Weaviate, Hybrid search: https://docs.weaviate.io/weaviate/search/hybrid
- ClarifyGPT: https://arxiv.org/abs/2310.10996
- Ragas metrics: https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
- Letta memory: https://docs.letta.com/
