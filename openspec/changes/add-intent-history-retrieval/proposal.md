# Proposal: Add hybrid intent history retrieval

## Why

WAM stores decisions, task contracts and recent changes but injects them by recency, not relevance. Historical context is not used to disambiguate intent or reuse a previous contract.

## What changes

- Hybrid score: BM25 lexical score + recency decay + task similarity + outcome (success/failure).
- Retrieve top-k with a threshold; if nothing clears the threshold, inject nothing.
- Reuse a previous contract when similarity > 0.85 and the user confirms merge/reuse.
- Research: Weaviate hybrid search (BM25 + vector fusion) and Anthropic just-in-time context retrieval; rejected a vector DB dependency, kept lexical + deterministic features.
