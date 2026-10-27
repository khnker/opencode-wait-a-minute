# Proposal: Add an ask-vs-assume clarification policy

## Why

WAM blocks tools in ASKING for any decision-critical uncertainty, even when history or context already resolves it.

## What changes

- Ask only if the uncertainty is decision-critical AND not resolved by history/context AND the cost of a wrong assumption is high.
- Otherwise record an assumption and continue.
- Risk classes: destructive, migration, security, external effect.
- Research: ClarifyGPT (ambiguity detection + targeted questions improves Pass@1); rejected always-ask and always-assume.
