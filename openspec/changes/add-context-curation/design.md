# Design: Add context curation

## Tool output reduction

`tool.execute.after` can mutate `output.output`. When the string exceeds
`MAX_TOOL_OUTPUT_CHARS` (default 2000), WAM:

1. stores the raw output under `.wam/tool-output/<taskId>/<hash>.txt`,
2. keeps a head/tail summary plus lines matching error/failure/exception,
3. replaces `output.output` with the summary and a raw reference.

The raw store is bounded (max 200 files / 50 MB) and pruned on write.

## Context dedupe

Each emitted block gets a normalized hash (strip `[wam]` prefix, collapse
whitespace, lowercase). Hashes are stored per session in
`.wam/context/injected-<session>.json` (max 500, TTL 24h). Blocks already seen
are dropped; blocks containing contract/gate/clarification markers are always
kept.

## Context brief

`buildContextBrief(taskState, { decisions, entities })` produces a bounded
markdown brief:

- task and phase
- objective
- open / verified requirements
- constraints and non-goals
- decisions
- entities (files, paths, URLs)
- evidence summary

It is injected via `experimental.session.compacting`:
`output.context.push(brief.text)`. OpenCode's prompt is kept by default; WAM can
replace it only when explicitly configured.

## Research / alternatives

- OpenCode compaction: source `packages/opencode/src/session/compaction.ts`
  (tail 2 turns, preserve 25% of usable window clamped 2k–8k, prune 40k
  protected tool tokens). WAM hooks `experimental.session.compacting`.
- Anthropic context engineering: minimal high-signal token set and
  just-in-time retrieval.
- Rejected: rewriting the full OpenCode message list (no public hook) and
  storing a second full transcript (would increase tokens).
