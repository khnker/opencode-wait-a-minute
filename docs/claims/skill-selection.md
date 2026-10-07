# Skill Selection

## Claim

WAM selects task-relevant skills as part of context enrichment.

## Expected behavior

Given:

```text
task
+
available skills
```

WAM should select skills whose capabilities are relevant to the task.

## Mechanism

Selection is deterministic and lexical (no embeddings):

- `discoverSkills` (`src/policy/skill-routing.js`) discovers skills by
  filesystem precedence (project-local → user-global → bundled);
- `scoreSkill` (`src/skills/engine.js:648`) sums weighted matches against the
  prompt:

  ```js
  { name: 5, capability: 4, keyword: 3, description: 2, domain: 1 }
  ```

- `routeSkillsV2` (`src/skills/engine.js:715`) filters by approval status, always
  includes base skills (`writing_for_agents`, `codebase_design`) that bypass
  scoring, keeps candidates with `score > 0`, sorts by score, and applies a
  top-N limit: `MINIMAL → 0`, `STANDARD → 3`, `RIGOROUS → 5`.

## Validation

Controlled fixtures should test:

- relevant skill available → selected;
- unrelated skill available → not selected;
- relevant skill removed → selection changes appropriately;
- metadata changes → ranking/selection changes appropriately.

## Tests

- `tests/unit/skill-routing.test.mjs`
- `tests/unit/skill-loading.test.mjs`
- `tests/unit/skill-injection.test.mjs`

**Status: Implemented, Tested.**

## See also

- [Context Enrichment](../concepts/context-enrichment.md)
- [Context Management](context-management.md)
