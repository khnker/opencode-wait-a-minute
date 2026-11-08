# Design: Disable interactive tools in task agent passes

## Research

- OpenCode tool configuration: https://opencode.ai/docs/permissions/
  (per-tool booleans; a tool set to `false` is unavailable to the session).
- OpenCode agent/tools docs: https://opencode.ai/docs/agents/
- Current WAM role contract: `src/agents/invocation-adapter.js`
  (`buildAgentSystemPrompt`: one JSON object, no prose, JSON result shape).

## Alternatives

### A. Keep `question` enabled and answer it from WAM

Rejected: it turns every role pass into a nested human interaction, duplicates
the loop's `WAIT_USER` surface, and the adapter has no handler to map a child
question back to task state.

### B. Disable `question` and put unknowns in `openQuestions` (CHOSEN)

The role result already has an `openQuestions` field. WAM's loop owns user
interaction and surfaces `WAIT_USER` once, at the coordinator level. This keeps
child passes deterministic and avoids a 300 s wait.

### C. Increase `toolTimeoutMs`

Rejected: it only delays the block and burns tokens; the child is waiting for
input, not doing work.

## Decision

Add `question: false` to `READ_ONLY_TOOLS` so both read-only and builder roles
inherit it, and state the rule in the role system prompt:
"Do not ask the user questions; put unknowns in openQuestions."

## Risks

- A role that genuinely needs a decision must express it as an open question in
  its JSON result; WAM surfaces it at the loop boundary.
- If another interactive tool is added by OpenCode, the policy must be extended
  in `READ_ONLY_TOOLS`.
