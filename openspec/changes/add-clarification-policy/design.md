# Design: Add an ask-vs-assume clarification policy

## Decisions

- Ask only if the uncertainty is decision-critical AND not resolved by history/context AND the cost of a wrong assumption is high.
- Otherwise record an assumption and continue.
- Risk classes: destructive, migration, security, external effect.
- Research: ClarifyGPT (ambiguity detection + targeted questions improves Pass@1); rejected always-ask and always-assume.

## Research

- Anthropic, Effective context engineering for AI agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Weaviate, Hybrid search: https://docs.weaviate.io/weaviate/search/hybrid
- ClarifyGPT: https://arxiv.org/abs/2310.10996
- Ragas metrics: https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
- Letta memory: https://docs.letta.com/
