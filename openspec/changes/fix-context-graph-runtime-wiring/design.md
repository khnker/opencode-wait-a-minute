# Design

## Research

- Microsoft Research, *From Local to Global: A Graph RAG Approach to
  Query-Focused Summarization* (2024): graph-based retrieval must carry
  explicit entity and relationship semantics; a graph with only the root
  entity degenerates to plain retrieval.
  https://arxiv.org/abs/2404.16130
- Anthropic, *Building effective agents*: retrieval should expose the
  evidence needed to act, while keeping the working set bounded.
  https://www.anthropic.com/engineering/building-effective-agents
- Existing WAM contract
  `openspec/changes/wam-context-graph-reconstruction/spec.md`: canonical
  reconstruction MUST preserve task dependencies, decision history,
  evidence lineage, and artifact producers.
- Existing WAM router contract: category nodes are conditional and the N3
  budget is capped; the router is the canonical selection authority.

## Alternatives

1. **Load runtime layers inside `assembleContext()` for every caller.**
   Rejected: it adds filesystem I/O to pure unit tests and every benchmark
   caller, and makes the assembly function less predictable.
2. **Load runtime layers in `message-handler.js` through a dedicated
   loader.**
   Chosen: production has one integration point, the loader is testable in
   isolation, and callers that already pass explicit layers keep working.
3. **Link evidence to shadow `output` nodes instead of changing the router.**
   Rejected: it encodes a router implementation detail in the graph builder
   and still leaves decisions attached to requirements invisible.
4. **Include every category node regardless of prompt.**
   Rejected: unbounded token growth and noise; the budget contract would be
   broken.

## Decision

### 1. Runtime input loader

Add `src/context/runtime-context-inputs.js`:

- Normalize `taskState` with the resolved `taskId`.
- Load the current/last run, evidence lineage, compact cognition state,
  decisions (run decisions, or `agentRun.results` / `agentHistory` when no
  run files exist), observations, hypotheses, experiments, and contract
  constraints.
- Truncate long evidence/observation content.
- Bound each layer deterministically (most recent first, valid evidence
  first).
- Fail soft per source: a corrupt or missing file returns an empty layer.

`message-handler.js` calls the loader once per assembly and spreads the
result into `assembleContext()`.

### 2. Run state in the canonical builder

`buildContextGraph(taskState, runState, evidenceLineage)` maps:

- `runState.actions` -> `action` nodes related to the task.
- `runState.observations` -> `observation` nodes related to the task or
  requirement.
- `runState.decisions` -> `decision` nodes supporting the task or
  requirement.
- Requirement nodes carry `status` metadata and `verified`.

Explicit arrays passed to `buildRuntimeContextGraph()` still win by node id;
`ContextGraph` de-duplicates edges by `(from, to, type)`.

### 3. Router closure for mandatory requirements

After the existing dependency expansion, `resolveContext()` collects
supporting category nodes for every mandatory requirement:

- `supports` edges whose source is `evidence` or `decision`.
- Evidence: valid/verified first; if none are valid, latest evidence is
  still surfaced so the graph shows the verification gap.
- Cap per requirement (3 evidence, 3 decisions).
- These nodes remain `CONDITIONAL` for budget admission, so token pressure
  can still drop them.
- Task-level category nodes stay behind the existing prompt-aware gate;
  only mandatory-requirement causal support bypasses it.

This is intentionally independent of the prompt-aware gate used for loose
category nodes: evidence needed to verify a mandatory requirement is causal,
not optional background.

### 4. Bounds

Loader limits: 30 evidence, 20 decisions, 20 observations, 10 hypotheses,
10 experiments, 10 actions, 500 characters per text field. Graph and router
add smaller per-requirement caps.

## Risks

- Loading all lineage files can be slower on very large tasks. The loader
  bounds the output; a future change can add a recent-file index.
- Evidence content is tool output and may contain noisy text. Truncation and
  per-requirement caps reduce prompt pollution.
- The legacy dependency graph remains unwired; tracked as follow-up.
