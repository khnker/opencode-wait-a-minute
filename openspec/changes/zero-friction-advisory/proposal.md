# Proposal: Zero-friction WAM (advisory instead of approval)

## Why

WAM currently pauses or blocks the agent in several places: it asks `¿Apruebo este
contrato?`, gates delegation behind `/wam permissions approve`, blocks contract-gated
tools until a contract is `APPROVED`, blocks mutating tools during `ASKING`, and treats
an unresolved completion gate as a stop. Every one of those is a human-in-the-loop
checkpoint the user did not ask for: WAM must be the least intrusive layer in the loop.

## What changes

- **Recommendation injection replaces approval prompts.** Where WAM used to ask for a
  decision, it injects one line of advice and continues.
- **No approval state gates execution.** `PROPOSED` contracts auto-approve (status kept
  for display only); `permission.ask` returns `allow`; `delegationBlocked` never blocks.
- **Workflow guards become nudges.** Clarification gate, discovery classifier, completion
  gate, stale-buffer/unverified-hypothesis/repeated-read guards and governance checks
  all return `allowed: true` plus a `recommendation`.
- **Commands stay as optional escape hatches** (`/wam contract approve|reject`,
  `/wam permissions approve|deny`) with no blocking effect, so existing scripts and docs
  keep working.
- **Explicit exclusions (safety, not friction):** irreversible operations (hard delete /
  U1 soft-archive), corrupt-state validation and destructive-risk envelopes keep blocking.
  These protect the workspace, not the human's attention.

## Out of scope

- Removing evidence requirements or the completion *report* (only its blocking effect).
- Changing risk classification or the U1 soft-archive policy.

## Research

- OpenCode plugin hooks: `permission.ask` and `tool.execute.before` are the only blocking
  surfaces a plugin owns; returning `allow` is the supported way to remove host prompts.
  https://opencode.ai/docs/plugins/
- Predecessor change `add-clarification-policy` (ask-vs-assume): this change takes it to
  the limit for workflow questions — assume, record, continue.
- Agent-UX practice: interrupt-driven approval scales O(human) while advisory injection
  scales O(tokens); reserve interrupts for irreversible effects.
