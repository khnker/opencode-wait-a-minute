# Design: Skill Discovery & Context Budget
## Frontmatter
name | description | triggers | keywords
Rule: `description` states WHEN to activate, never the workflow itself.
## Layers
always-loaded  -> small metadata (name/description/triggers)
activated      -> SKILL.md body
needed         -> references/resources/scripts
## Roles
description -> discovery
SKILL.md    -> behavior
references  -> deep knowledge
scripts     -> execution
## Metrics
skill_context_tokens, reference_context_tokens, total_skill_cost, activation_frequency
## Budget
Cost is bounded via the existing admission mechanism (wam-context-budget-admission) and the
context budget reservation (context-assembly-layer).
## Overlap note
Extends `skill-loading` (On-Demand Skill Scoring, Skill Metadata Extension) and
`context-assembly-layer` (Context Budget Reservation) rather than replacing them.
