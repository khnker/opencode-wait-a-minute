## Context

`buildSemanticProjection` feeds the compaction brief. Its decisions section
copied the legacy behavior (first eight live decisions) without considering
task scope, and the renderer repeated pending obligations and listed every
retrievable id.

Real data (`comparador-precios`, 2026-10-29): 127 decisions, of which 119
belonged to other sessions; shadow brief 1973 chars vs 973 injected.

## Goals

- The projection carries task-relevant decisions only.
- Every fact renders once.
- Retrieval handles stay bounded regardless of how many ids exist.

## Non-Goals

- Changing the shadow gate thresholds.
- Changing decision storage or ids.

## Research

- Liu et al., "Lost in the Middle: How Language Models Use Long Contexts"
  (arXiv:2307.03172): irrelevant context in the middle of a prompt degrades
  retrieval of the relevant parts.
  https://arxiv.org/abs/2307.03172
- Anthropic, "Effective context engineering for AI agents" (2025): context is
  a finite budget; include the smallest set of high-signal tokens.
  https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Fowler, "Event Sourcing" (projections are read models, not dumps).
  https://martinfowler.com/eaaDev/EventSourcing.html

## Alternatives Considered

1. Keep every live decision (status filter only). Rejected: status is
   `accepted` for auto-approved strategy decisions, so all 127 pass; the
   observed 1.81 ratio stays.
2. Rank by authority and recency only. Rejected: all offending decisions are
   `user-decided`, so authority does not separate them; recency picks other
   sessions' latest decisions.
3. Scope by id (`task-…`/`ses-…`) plus dedupe and one representation per fact
   (chosen). Ids already encode their scope; unscoped ids are project-wide
   decisions and remain visible. Dedupe removes repeated strategy approvals.
   Renderer emits obligations once and bounds retrieval handles.

## Decisions

- `decisionBelongsToTask` includes a decision when its id/text contains the
  task id or a requirement id, when the id has no scope marker, or when its
  text contains a requirement title of at least 8 characters.
- Decisions sort by embedded timestamp descending, then id, and dedupe by
  normalized text keeping the first (most recent).
- `projection.baseRefs` exposes canonical base refs so the renderer can show a
  bounded sample; `retrievableRefs` keeps the full merged list for tooling.

## Risks

- Unscoped decisions are still projected; if unscoped ids are used for
  cross-task noise the ratio can grow again. Mitigated by the 8-decision cap.
- Removing the pending lines from execution state changes brief text; covered
  by updated tests in `semantic-projection.test.mjs` and
  `tests/integration/semantic-pipeline.test.mjs`.
