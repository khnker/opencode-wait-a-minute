# Design: RC1 Real Benchmark & Evidence Protocol

## Architecture
- **Protocol**: Immutable JSON schemas for real scenarios and manifest tracking under `benchmarks/real/`.
- **Providers**: Normalized fetch wrappers for OpenAI, Anthropic, and Gemini yielding standard token metrics (`inputTokens`, `outputTokens`, `cachedInputTokens`, `latencyMs`).
- **Paired Runner**: Strict control loop enforcing identical seeds, prompts, and toolsets while asserting outcome equality before computing input token / rebuild deltas.
- **Consolidation**: Common output envelope (`manifest.json`, `raw.json`, `metrics.json`, `report.md`) across all suites.
- **Corpus & Report**: Separates internal deterministic metrics, real empirical execution, and independent caching evidence.
