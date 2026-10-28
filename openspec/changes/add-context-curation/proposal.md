# Proposal: Add context curation

## Why

WAM currently bounds its context pack, but it still:

- sends large tool outputs into the OpenCode session,
- re-injects identical context (skills, N1/N2) across turns,
- and lets OpenCode's generic compaction summarize without WAM's structured
  contract/evidence/decision model.

Evidence: a single session accumulated 89 WAM synthetic parts (top session:
249), and the OpenCode event log reached 1.65M `message.part.updated` events.

## What changes

- **Tool output reduction**: large tool outputs are stored raw under
  `.wam/tool-output/` and replaced with a bounded summary + reference.
- **Context dedupe**: identical context blocks are injected at most once per
  session; critical contract/gate blocks are always kept.
- **Context brief**: a structured, bounded brief (contract, open requirements,
  decisions, entities, evidence) is injected into
  `experimental.session.compacting` so compaction carries WAM's model.
- A benchmark proves token savings on a synthetic multi-turn session.

## Impact

- Fewer tokens per turn and fewer OpenCode parts/events.
- Compaction summaries keep the contract and evidence instead of a generic
  transcript summary.
- No destructive changes to OpenCode history.
