# Design: Action Risk Envelope

## 1. Classification Model
Every tool action MUST resolve to: SAFE, GUARDED, or BLOCKED.

### SAFE
Read-only or negligible/reversible effects. May execute autonomously.
- Examples: read, search, grep, git status/diff, run tests, lint, typecheck, inspect logs.

### GUARDED
Mutating, bounded, reversible. May execute autonomously within scope, if no protected resources affected.
- Examples: edit, create temp file, run formatter, add instrumentation.

### BLOCKED
Destructive, irreversible, or sensitive. MUST require authorization.
- Examples: delete data, drop DB, production deploy, credential modification, irreversible external API calls.

## 2. Risk Evaluation Logic
A function `evaluateAction(action)` will determine the classification based on:
1. Tool type (e.g., `write` is GUARDED, `read` is SAFE).
2. Action arguments (e.g., `edit` on `src/` is GUARDED, `edit` on `/etc/` is BLOCKED).
3. Task scope (e.g., mutations outside declared scope are BLOCKED/GUARDED).
4. Blast radius (scope, reversibility, persistence, data impact).

## 3. Enforcement
The plugin will intercept tool calls. If `evaluateAction` returns BLOCKED, the action is rejected with an explanation. If GUARDED, additional checks (like scope validation) are performed.
## 4. Scope Boundary
WAM governs actions with **blast radius on the project** (mutations, destructive or sensitive operations). Agent runtime/meta tools that do not mutate the repository — context pruning (`compress`), delegation (`delegate_task`, `call_agent`) — are **out of scope** and bypass the envelope entirely. Fail-closed (`UNKNOWN → BLOCKED`) applies only within the governed domain; it MUST NOT be used to gate the agent's own runtime, which is not WAM's concern.
Rationale: the envelope was designed for project mutations. Applying it to every tool call caused legitimate runtime/MCP tools to be blocked by omission (not by risk), which is a mis-scoped policy.
