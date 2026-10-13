# Proposal: Centralize and Version WAM Prompts

Centralize the agent-directed strings WAM surfaces (nudges, warnings, suggestion notices, and injected guidance) into Markdown files under `prompts/`, so they are readable, reviewable via git diff, traceable to consumers and tests, and evolvable without editing logic.

> Scope narrowed after inventory (see design.md "Inventory"). Out of scope: `skills/**` (already Markdown, handled by skill-registry) and generic `src/context/prompt-engine.js` (an assembler with no embedded text). In scope: the ~20 literal agent-facing strings in `src/`.

## Goals
1. Treat agent-directed strings as versioned behavioral artifacts, not scattered code literals.
2. Preserve current behavior exactly (mechanical extraction; no semantic changes).
3. Track each prompt to its consumer and its tests via a machine-readable catalog.
4. Provide `prompts:check` / `prompts:list` validation compatible with the existing script conventions.
