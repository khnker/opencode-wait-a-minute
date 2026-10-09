# Design: Skill Lifecycle & Composition
## Model
discovery -> activation -> execution -> artifact/observation -> next skill
## Skill contract (SKILL.md frontmatter)
- `inputs`: artifact kinds consumed
- `outputs`: artifact kinds produced (each carries an observation id)
- `requires`: skills that MUST have produced their outputs before this skill runs
- `optional`: skills that MAY have run (enrichment, never blocking)
- `fallback`: skill to run when this skill cannot produce its declared output
## Activation
- Build a DAG from `requires`; topological sort; reject cycles before execution.
- Precondition = "all `requires` produced their declared outputs".
- Missing `optional` skills never block; recorded as absent.
## State continuity
- Task/contract/claims live in the WAM store keyed by taskId, not inside the skill.
- Transitions pass artifacts by reference (artifact id), never by prompt text.
## Decisions
- Skill != workflow: a skill is atomic, a workflow (CH-04) is a composition.
- The graph is recorded even when partially executed (evidence/provenance).
## Recorded graph
`{ taskId, nodes: [{skill,status,outputArtifactId,startedAt,endedAt}], edges: [{from,to,kind}] }`
## Risks
- Over-declared dependencies could deadlock; mitigated by topological sort + explicit missing-dependency error (never silent).
