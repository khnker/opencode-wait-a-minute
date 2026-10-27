# Design: Add a state-aware intent router

## Decisions

- Four lanes: CONVERSATION, CONTINUATION, CORRECTION, TASK_NEW.
- Signals: classifyRequest, meta-only detection, continuation regex, correction markers, task verbs + concrete object.
- Confidence: high when >=2 independent signals agree; otherwise default to CONVERSATION for short/meta messages and TASK_NEW for action verbs with a concrete object.
- Integration: message-handler uses the lane to choose no-contract (CONVERSATION), fast-path (CONTINUATION), contract update (CORRECTION) or contract synthesis (TASK_NEW).
- Research: intent classification + explicit dialogue state machines; rejected an LLM-only router (offline/latency) and kept a deterministic fallback.

## Research

- Anthropic, Effective context engineering for AI agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Weaviate, Hybrid search: https://docs.weaviate.io/weaviate/search/hybrid
- ClarifyGPT: https://arxiv.org/abs/2310.10996
- Ragas metrics: https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
- Letta memory: https://docs.letta.com/
