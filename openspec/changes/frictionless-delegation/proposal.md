# Proposal: Frictionless delegation (maximize agents, right-sized context)

## Why

WAM already prefers advisory over approval (see `zero-friction-advisory`), but the
delegation surface still creates friction and does not actively push work to subagents:

- `task` and `skill` are not in the action catalogue, so `evaluateAction` classifies them
  as `UNKNOWN` and the `tool.execute.before` hook emits
  `RISK BLOCK (skill): fail-closed: herramienta no catalogada` — advisory in soft mode,
  but it reads as a block and forces the agent to stop and justify itself.
- The injected delegation block only says delegation "conviene" and leaves context
  sizing implicit. Agents are told *that* they may delegate, not *what* to delegate,
  *in parallel*, and *with which context*.
- Over-delegation is not discouraged, so token savings are not guaranteed.

## What changes

- **Delegation/meta tools are out of the risk envelope.** `task` and `skill` join
  `compress`, `delegate_task` and `call_agent` in `OUT_OF_SCOPE_TOOLS`: no risk
  evaluation, no `RISK BLOCK`, no friction.
- **Uncatalogued tools are advisory at the injection layer too.** `index.js` mirrors
  `guardAction`: `UNKNOWN` → recommendation, never a block. C01 fail-closed stays
  intact for known project tools (`risk-engine` test unchanged).
- **Delegation is the default proposal for independent pending requirements.** The
  injected line is a non-blocking default ("delegá cada req independiente en paralelo"),
  not a suggestion ("conviene").
- **Context is right-sized per subagent.** Each delegated requirement receives only:
  requirement goal, domain/files hint, and acceptance criterion — never the full
  conversation. Trivial tasks (≤1 edit) stay inline to avoid orchestration overhead.
- **Inline stays allowed.** Zero friction also means the main session may edit inline
  without asking; the fallback chain remains sequential → cheapest tier → inline.

## Non-goals

- No new agent types, no per-agent token-budget config, no changes to tier routing.
- No weakening of destructive-action blocking (hard delete, known dangerous verbs).
- No change to the contract `APPROVED` gate for delegation.

## Impact

- `src/policy/action-capabilities.js`, `index.js`, `prompts/injections/delegation.md`,
  `src/prompts/characterization.test.mjs`, `src/policy/zero-friction.test.mjs`.
- Behavioural: meta tools stop producing `RISK BLOCK`; pending reqs are proposed for
  parallel delegation by default with an explicit minimal-context contract.
