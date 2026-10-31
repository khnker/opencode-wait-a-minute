# Design: Frictionless delegation

## Goal

Maximize useful subagent delegation while keeping WAM zero-friction: propose, never
block; give each subagent the minimum context it needs and nothing more.

## Invariant

> Delegation and runtime/meta tools MUST bypass the action-risk envelope. Advisory
> surfaces return `allowed: true` plus a recommendation. Blocking remains reserved for
> irreversible/destructive effects (U1 hard delete) and corrupt state (C01 for known
> project tools).

## Research links

- OpenCode subagents/agents (Task delegation, agent config):
  https://opencode.ai/docs/agents
- OpenCode plugin hooks (`tool.execute.before`, `permission.ask`):
  https://opencode.ai/docs/plugins/
- Anthropic, *Building effective agents* (when to delegate, orchestration overhead):
  https://www.anthropic.com/research/building-effective-agents

Key findings used:

1. Delegation is worth it for independent, specialized or parallelizable subtasks;
   over-delegating trivial work adds latency and orchestration cost.
2. Passing only goal, constraints, relevant files and acceptance criteria ("least
   context") is both cheaper and more accurate than replaying the full transcript.
3. Non-destructive workflow guidance should be fail-open (advisory), not a hard gate.

## Alternatives considered

**A. Downgrade every `UNKNOWN` tool to `ADVISORY` in `risk-engine`.** Rejected: it breaks
the C01 invariant and `tests/unit/risk-engine.test.mjs` ("unknown tool defaults to
BLOCKED"), and it would let genuinely unknown mutating project tools run unclassified.

**B. Expand `OUT_OF_SCOPE_TOOLS` + align `index.js` with `guardAction` (chosen).** Meta
tools (`task`, `skill`, `compress`, `delegate_task`, `call_agent`) bypass the envelope
explicitly; unknown project tools still fail closed in the engine, and the injection
layer emits a recommendation instead of a block, matching `guardAction`'s existing
zero-friction behaviour. Smallest diff, preserves C01.

**C. Add a per-agent context-budget config.** Rejected: over-engineering for the token
saving requested. A deterministic prompt rule ("only req + domain + acceptance") is
sufficient and testable.

## Chosen approach

1. `OUT_OF_SCOPE_TOOLS` gains `task` and `skill`. They resolve to `SAFE`
   (`getEffectiveCapability`) and never reach the risk branch.
2. `index.js` risk branch: when `risk.reason` matches the fail-closed/uncatalogued case,
   queue a `Recomendación` directive and continue (no `RISK BLOCK`, no throw). Known
   destructive verbs keep the existing soft/strict path.
3. `prompts/injections/delegation.md` becomes a default, non-blocking directive:
   delegate each independent pending req in parallel; pass only the right-sized
   context; keep trivial tasks inline; inline mutation always allowed.
4. Keep `delegation-item.md` short (id → `Task(parallel)` + title + domain hint); the
   right-sized-context rule lives once in the header to avoid per-item token overhead.

## Testing

- `zero-friction.test.mjs`: `task`/`skill` are `SAFE`; the index-layer decision is
  advisory for uncatalogued tools; hard delete stays blocked.
- `characterization.test.mjs`: updated literal for `injection.delegation`.
- `tests/unit/risk-engine.test.mjs` and `action-capabilities-mcp.test.mjs` stay green
  (C01 unchanged).

## Risks

- `task`/`skill` are now unclassified by the risk envelope. Mitigation: both are
  non-mutating orchestration tools; repository mutations still go through `edit`/`write`
  (GUARDED) and remain governed.
- Prompt-only context sizing is advisory; a misbehaving agent could still over-share.
  Mitigation: the rule is explicit and covered by a characterization test.
