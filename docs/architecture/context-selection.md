# Context Selection

WAM reconstructs the context a task needs from persisted task state, rather than
accumulating the full conversation.

## Mechanism

Context selection is deterministic. There is no vector database and no
embeddings; matching uses a closed alias set.

- **Capsules** — context is stored as capsules under `.wam/capsules/<id>.json`
  (`src/context/context.js`). Each capsule carries a level (`L1`–`L4`), a
  lifecycle status (`candidate`, `active`, `superseded`, `stale`, `invalidated`)
  and provenance (`user_decided`, `observed`, `inferred`).
- **Session** — `.wam/session.json` records session state scoped to
  `(root, OpenCode sessionID)` via `getSessionId`.
- **Selection** — `selectContext` picks the highest-relevance items that fit the
  active budget. Relevance is computed from a deterministic alias set, not
  similarity search.
- **Assembly** — `src/context/assembly.js` builds the context pack across levels
  `N0`–`N2`; `context.js` handles `N3`.
- **Budget** — `src/context/context-budget-manager.js` enforces the token budget;
  `validateContextBudget` rejects packs where required levels are missing.

## Context levels

| Level | Meaning | Pack class |
| --- | --- | --- |
| N0 | Global / policy / task requirements | MANDATORY, tiny |
| N1 | Domain-specific verification knowledge | CONDITIONAL, selective |
| N2 | Current task state, evidence, observations | MANDATORY (live) |
| N3 | Opportunistic / session capsules | OPTIONAL |

Invariant: **N3 MUST NOT substitute missing N2 evidence.** `validateContextBudget`
emits `"N3 context used to substitute missing N2"` when N3 is present without N2,
and required levels that are absent make the budget invalid (`valid: false`).

## Relationship to the claim

The selection mechanism supports the [Context Management](../claims/context-management.md)
claim. The measured outcome of applying it is documented in
[Benchmark Results](../benchmarks/results.md).

## Related documentation

- [Architecture Overview](overview.md)
- [Task Lifecycle](task-lifecycle.md)
- [Context Enrichment](../concepts/context-enrichment.md)
