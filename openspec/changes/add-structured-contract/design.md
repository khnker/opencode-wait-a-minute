# Design: Add structured contract extraction

## Decisions

- Contract schema: objective, deliverables[], constraints[], nonGoals[], acceptance[{criterion,evidence}].
- Requirements are derived only from deliverables; prose sentences are not requirements.
- Deterministic extraction: action verb + object, explicit file/module/endpoint references, constraints (do not, only, must), non-goals (not, outside scope).
- If no deliverable is found, return zero requirements and mark the contract NEEDS_CLARIFICATION instead of inventing requirements.
- Research: JSON-schema/structured-output contracts; rejected an LLM-only extractor and kept a deterministic fallback.

## Research

- Anthropic, Effective context engineering for AI agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Weaviate, Hybrid search: https://docs.weaviate.io/weaviate/search/hybrid
- ClarifyGPT: https://arxiv.org/abs/2310.10996
- Ragas metrics: https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
- Letta memory: https://docs.letta.com/
