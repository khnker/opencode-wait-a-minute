# Change: Add craftsman skill

## Objective
Ship a bundled, on-demand skill that encodes a language-agnostic engineering execution
protocol: validated boundaries, justified abstraction, pure core, and the Craftsman
Ladder (EVALUATE → MATCH → ACTION → HALT) decision engine.

## Why
The repo already routes skills per prompt, but has no general-purpose protocol for
implementing or refactoring code across languages and layers. Without it, implementation
prompts fall back to whatever generic behaviour the model has, with no explicit
justification for abstractions, locality or scope decisions.

## What Changes
- New bundled skill `skills/craftsman/SKILL.md` (on-demand, not base).
- Routing metadata in `src/skills/engine.js` (capabilities/triggers, risk low).
- Cross-layer constraint in `src/skills/skill-routing.js`.
- Fix `pruneBySection` in `src/context/assembly.js` so retained sections keep their
  bodies and the synthetic `[wam N3 skill]` header.
- Remove the fixed 4000-char on-demand cap; inject the full skill body by default and
  bound it by the remaining skill token budget (80% of flex, 20% reserved) or explicit
  `skillsMaxChars`.
- Make full base-skill bodies the transversal default; opt back into cards with
  `skillBaseLoad: "card"`.
- Unit test `tests/unit/craftsman.test.mjs` plus an injection regression asserting the
  full ladder body reaches N3 without truncation.

## Impact
- Affected specs: `skill-loading`
- Affected code: `src/skills/engine.js`, `src/skills/skill-routing.js`,
  `src/context/assembly.js`, `tests/unit/craftsman.test.mjs`
