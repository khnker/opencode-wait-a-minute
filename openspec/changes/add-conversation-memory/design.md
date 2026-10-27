# Design: Add conversation memory and entity recall

## Decisions

- Rolling summary + entity table (files, paths, decisions, open questions).
- Retrieve entities by relevance, not by raw transcript.
- Compact on turn threshold; keep a hard cap.
- Research: Letta/MemGPT memory blocks and archival memory; rejected a full memory OS and kept a bounded file-based memory.

## Research

- Anthropic, Effective context engineering for AI agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Weaviate, Hybrid search: https://docs.weaviate.io/weaviate/search/hybrid
- ClarifyGPT: https://arxiv.org/abs/2310.10996
- Ragas metrics: https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
- Letta memory: https://docs.letta.com/
