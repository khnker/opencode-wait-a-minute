# Context Enrichment

Context selection is not limited to repository files. WAM can enrich task context
with capabilities and skills relevant to the current task.

## Selection model

```text
Task state
    ↓
Task characteristics
    ↓
Available capabilities / skills
    ↓
Relevant selection
    ↓
Context assembly
```

## Example

```text
Task:
Add a PostgreSQL migration
```

Expected relevant capabilities may include:

```text
PostgreSQL
database migration
testing
```

A skill unrelated to the task should not be selected merely because it is
available.

## Why enrichment matters

A model may know that a task requires database work without having the
repository-specific or workflow-specific instructions needed to perform it
correctly. Skill enrichment provides that additional context.

## Implementation

WAM's skill selection is **deterministic and lexical**, not semantic: there is
no vector database and no embeddings.

1. **Discovery** — `discoverSkills` (`src/policy/skill-routing.js`) walks search
   paths in deterministic precedence (project-local → user-global → bundled) and
   the first `SKILL.md` per name wins.
2. **Scoring** — `scoreSkill` (`src/skills/engine.js:648`) lowercases the prompt
   and sums weighted matches:

   ```js
   { name: 5, capability: 4, keyword: 3, description: 2, domain: 1 }
   ```

   A skill's name in the prompt adds `5`, each matching capability `4`, each
   keyword `3`, a matching description prefix `2`, each domain `1`.
3. **Routing** — `routeSkillsV2` (`src/skills/engine.js:715`) filters skills by
   approval status, always includes base skills (`writing_for_agents`,
   `codebase_design`) that bypass scoring, ranks the rest by score (only
   `score > 0` candidates survive), and applies a top-N limit driven by rigor:
   `MINIMAL → 0`, `STANDARD → 3`, `RIGOROUS → 5`.

Because selection is lexical and deterministic, the same task text and the same
available skills produce the same selection. See
[Skill Selection](../claims/skill-selection.md) and
[Context Selection](../architecture/context-selection.md).

## See also

- [State vs Context](state-vs-context.md)
- [Skill Selection](../claims/skill-selection.md)
