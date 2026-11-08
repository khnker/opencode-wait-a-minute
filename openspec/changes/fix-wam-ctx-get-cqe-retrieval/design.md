# Design: Fix `/wam ctx get` CQE fallback

## Research

- Existing CQE adapter and specs: `src/context/cqe-adapter.js`,
  `openspec/specs/context-query-engine/`, and the integration suite under
  `tests/integration/cqe/`. The adapter already exposes `retrieveWithCqe`,
  provenance (`source`), failure classification and a `wam-native` fallback.
- Anthropic, "Building effective agents" (workflow vs. autonomous agent;
  deterministic retrieval before model calls):
  https://www.anthropic.com/engineering/building-effective-agents
- Gao et al., "Retrieval-Augmented Generation for Large Language Models: A
  Survey" (retrieval grounding and avoiding hallucinated context):
  https://arxiv.org/abs/2404.16130
- Repo design rule: deterministic fallbacks first; never fabricate context.

## Alternatives

- **A — Keep capsule-only retrieval and fix the nudge wording.**
  Smallest change, but removes the advertised fast path from fresh projects and
  leaves the CQE index unused by the command. Rejected.
- **B — Capsules first, then CQE/native fallback (CHOSEN).**
  Keeps deterministic capsule behavior for existing projects while making the
  command useful in fresh projects. Capsule hits keep their current format;
  CQE is only consulted on a miss. Failure of CQE degrades to the original
  capsule message.
- **C — CQE first, capsules as fallback.**
  Maximizes file-index usage but changes existing behavior for projects that
  rely on curated capsules and can surface lower-quality file snippets over
  reviewed context. Rejected.

## Decision

Implement option B. `retrieveContextWithCqe` calls `retrieveContext` first and
returns capsule results unchanged (plus `source: "capsule"`). On a miss it calls
`retrieveWithCqe` with the repository root and `maxResults`, returning CQE items
tagged with `cqeRes.source` (`cqe` or `wam-native`). If CQE returns nothing or
throws, the original capsule failure result is returned with `cqeMeta` /
`cqeError`; the function never throws and never fabricates items.

`/wam ctx get` keeps the existing capsule rendering, renders CQE/native items as
one line each (path, start line, relevance, collapsed content capped at 120
chars), and falls back to the capsule failure message otherwise.

## Risks

- **CQE latency on a miss.** Bounded by the adapter's existing timeout and only
  paid when no capsule matches.
- **Lower-quality snippets versus curated capsules.** Mitigated by capsule-first
  ordering and the explicit `[cqe]` / `[wam-native]` tag.
- **Output growth.** Bounded by `maxResults = 5` and 120-character content.
- **Silent CQE failures.** Exposed through `cqeMeta.failureCode` / `cqeError`
  without changing the user-facing fallback message.
