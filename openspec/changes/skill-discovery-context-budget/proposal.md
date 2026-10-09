# Change: Skill Discovery & Context Budget
## Why
A skill's `description` should describe WHEN to activate it, not summarize its workflow,
because the agent can take the shortcut of following the description and never read the
skill body. And richer workflows must not be achieved by flooding the context.
## What Changes
- Formalize frontmatter `name`, `description`, `triggers`, `keywords`.
- Rule: description -> discovery, SKILL.md -> behavior, references -> deep knowledge, scripts -> execution.
- Layered loading: always-loaded (small metadata) -> activated (SKILL.md) -> needed (reference/resource).
- Measure `skill_context_tokens`, `reference_context_tokens`, `total_skill_cost`, `activation_frequency`.
## Non-goals
- Replacing the loading/scoring engine (`skill-loading`).
- Re-defining the context budget (`context-assembly-layer`).
## Depends on
- `skill-lifecycle-composition` (CH-01), `skill-workflow-engine` (CH-04).
- Existing: `skill-loading`, `context-assembly-layer`, `wam-context-budget-admission`.
## Expected Result
Skills are discovered by intent (description), loaded in layers, and their context cost is
measured and bounded.
## Validation
- [ ] `openspec validate skill-discovery-context-budget --strict` passes
- [ ] Metrics computed per activation
- [ ] Over-budget activation handled by the admission policy
## Program
- Program: Superpowers integration
- Order: 7 of 7
- Priority: P1
