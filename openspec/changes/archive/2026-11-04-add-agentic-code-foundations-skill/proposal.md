# Change: Add agentic-code-foundations skill

## Objective
Ship a bundled, on-demand skill that encodes minimal engineering rules for code that
humans and agents can read, maintain, and change safely.

## Why
The repo already routes skills per prompt, but has no general-purpose guidance on code
clarity, abstraction cost, and agent-readable context. Without it, refactor and review
prompts fall back to whatever generic behaviour the model has.

## What Changes
- New bundled skill `skills/agentic-code-foundations/SKILL.md` (on-demand, not base).
- Routing metadata in `builtinCapabilities` (`src/skills/engine.js`): capabilities
  `code-quality`, `maintainability`, `refactoring`; triggers for refactor/review/abstraction.
- Cross-layer constraint in `DEFAULT_CONSTRAINTS` (`src/skills/skill-routing.js`) allowing
  all four layers, because the rules are language/layer agnostic.
- Regression test `tests/unit/agentic-code-foundations.test.mjs`.

## Impact
- `skills/agentic-code-foundations/SKILL.md` (new)
- `src/skills/engine.js`
- `src/skills/skill-routing.js`
- `tests/unit/agentic-code-foundations.test.mjs` (new)

No change to `skills/registry.json`: that file only holds upstream catalog entries.

## Non-goals
- No base/always-on injection (token cost every turn).
- No semantic/embedding routing.
- No rewrite of existing skills or prompts.
- No new dependencies.
