# Isolate Agent Context

## Why

The invocation adapter sends a role prompt, but nothing prevents WAM from
passing the coordinator's full conversation or every task artifact to a role.
That leaks context, inflates tokens and makes independent review weaker.

WAM must choose a bounded, role-specific context from explicit task sources and
deliver only references, constraints and findings allowed by the contract.

## What Changes

- Adds an `agent-context-isolation` capability with a deterministic role-context
  selector.
- Selects from explicit candidate lists: artifacts, evidence, constraints and
  prior findings.
- Applies role policies: item limits, finding severity filters and character
  budgets.
- Ranks artifacts, evidence and findings by deterministic token overlap with the
  objective; keeps constraints in declared order.
- Deduplicates references and reports omitted counts without changing the
  contract.
- Never accepts or forwards coordinator conversation text.

## Impact

- `src/agents/context-isolation.js` (new)
- `tests/unit/agent-context-isolation.test.mjs` (new)
- `openspec/changes/isolate-agent-context/**` (new)
- No invocation adapter or Task Loop changes.

## Non-Goals

- Routing or orchestrating roles (Change 04).
- Review feedback cycles (Change 05).
- Task Loop integration (Change 06).
- Multi-agent benchmarking (Change 07).
- Embeddings, vector search or a required CQE dependency.
- Reading the filesystem or expanding artifact references into file contents.
