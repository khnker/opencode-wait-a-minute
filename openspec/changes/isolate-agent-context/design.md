# Design: Agent Context Isolation

## Research

- Anthropic multi-agent research system: isolated subagents need bounded,
  purpose-specific context; sharing the full orchestrator transcript wastes
  tokens and contaminates independent review.
  https://www.anthropic.com/engineering/multi-agent-research-system
- OpenCode agents: roles are invoked with a system instruction and an explicit
  prompt, so the caller decides what context enters the child session.
  https://opencode.ai/docs/agents/
- Existing WAM selection precedent: `src/context/context.js` scores capsules by
  relevance and enforces a budget. This change applies the same deterministic
  posture to the four contract input categories without requiring capsules.

## Alternatives Considered

1. **Send the full task state and coordinator transcript.** Rejected: leaks
   unrelated work, weakens Reviewer independence and grows with every turn.
2. **Reuse `selectContext` capsules directly.** Rejected: capsules are a separate
   persistence pipeline, not guaranteed to contain the current role artifacts or
   evidence, and may still pass unrelated capsules.
3. **Deterministic selector over explicit candidate lists.** Chosen: WAM controls
   the candidates, the selector bounds and ranks them, and no host or embedding
   dependency is required.

## Selection Model

Inputs are four explicit arrays supplied by WAM:

- `artifacts`: string references.
- `evidence`: string references.
- `constraints`: string constraints.
- `priorFindings`: Change 01 `AgentFinding` objects.

The selector never accepts `conversation`, messages, model output or full task
state. Unknown input categories cannot enter `AgentRequest.input`.

### Role policies

| Source | Analyst | Architect | Builder | Reviewer |
| --- | --- | --- | --- | --- |
| artifacts | 16 | 12 | 20 | 20 |
| evidence | 16 | 12 | 8 | 30 |
| constraints | 20 | 20 | 20 | 10 |
| prior findings | 0 | 20 | 12 | 30 |
| finding severities | n/a | all | HIGH, CRITICAL | all |

The Analyst starts fresh. The Architect sees current findings. The Builder sees
only actionable high-severity findings. The Reviewer sees the widest evidence
and finding window and a smaller constraint window.

## Ranking

- Tokenize the objective and each candidate on lowercase word characters.
- Drop common stopwords.
- Score by the number of shared tokens.
- Sort by score descending, then original index ascending.
- Artifacts, evidence and findings are ranked.
- Constraints keep declared order because order often encodes precedence.
- Findings are filtered by role severity before ranking.
- Duplicate string refs and duplicate finding ids keep the first occurrence.

No dynamic model, network call or random tie-break is used.

## Budgets

Each source has an item limit and a character budget equal to one quarter of the
total character budget. Defaults: 6000 total characters, so 1500 per source.
Items are added greedily until the source limit or source character budget is
reached. Omitted counts are returned as metadata.

The selector returns:

```text
{
  input: { artifacts, evidence, constraints, priorFindings },
  metadata: {
    role,
    selected: { artifacts, evidence, constraints, priorFindings },
    omitted: { artifacts, evidence, constraints, priorFindings },
    budget: { maxChars, usedChars, maxCharsPerSource }
  }
}
```

Metadata stays outside `AgentRequest`.

## Failure Behavior

Invalid roles, non-array sources, non-string refs and malformed findings throw
`AgentContextError` with every detected issue. The selector does not coerce or
silently drop malformed findings.

## Risks

- Token overlap is lexical, not semantic; an artifact with different wording may
  rank low. WAM can include a stable artifact ref in the objective to compensate.
- A tight character budget can omit a relevant evidence ref. Omitted counts make
  the loss visible; Change 07 measures the quality trade-off.
- Role policies are constants; tuning them is a benchmark task, not a runtime
  decision.
