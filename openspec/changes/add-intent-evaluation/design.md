# Design: Add intent and context evaluation metrics

## Decisions

- Offline metrics: intent accuracy, clarification rate, contract acceptance, false completion, context precision/recall, token cost.
- Use deterministic scenario fixtures first; optional LLM-as-judge later.
- Reuse benchmarks/evaluation and benchmarks/quality harnesses.
- Research: RAGAS (context precision/recall, faithfulness, answer relevancy); rejected LLM-judge as a hard gate due to cost.

## Research

- Anthropic, Effective context engineering for AI agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Weaviate, Hybrid search: https://docs.weaviate.io/weaviate/search/hybrid
- ClarifyGPT: https://arxiv.org/abs/2310.10996
- Ragas metrics: https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
- Letta memory: https://docs.letta.com/
