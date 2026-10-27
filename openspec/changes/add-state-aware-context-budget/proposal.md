# Proposal: Add state-aware context budgets

## Why

All states compete for the same context budget; historical context can displace the current task and inflate tokens.

## What changes

- Per-state budgets: CONVERSATION minimal, CONTINUATION N2 + last decisions, TASK_NEW N1 project + N2 contract, VERIFYING evidence only.
- Progressive disclosure: summary first, details on demand.
- Deduplicate sources and drop stale entries.
- Research: Anthropic context engineering (minimal high-signal token set, just-in-time retrieval); rejected a fixed global budget.
