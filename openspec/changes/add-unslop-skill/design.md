# Design: add-unslop-skill

## Research

- Upstream skill and license: https://github.com/heydamir/unslop (CC BY 4.0),
  vendored at commit `a6f121eee5f29c2f74976b75456feae8b66afb3a`.
- WAM skill discovery: `src/policy/skill-routing.js` (`discoverSkills`,
  `getSkillSearchPaths`) scans `skills/<id>/SKILL.md`.
- WAM role injection: `src/agents/role-skills.js` (`resolveRoleSkills`) loads the
  role's preferred skills into the agent prompt under a character budget.
- opencode skill layout: YAML frontmatter is optional; the directory name is the
  skill id.

## Layout

```
skills/unslop/
  SKILL.md                     # condensed WAM base skill
  NOTICE.md                    # attribution + vendoring note
  LICENSE                      # upstream CC BY 4.0
  references/
    upstream-skill.md          # full upstream SKILL.md verbatim
    signs.md visuals.md tokens.md effects.md refs.md
    refs/*.webp                # upstream reference images
  scripts/snapshot.mjs story.mjs
  agents/openai.yaml           # upstream Codex manifest
```

## Budget

`DEFAULT_MAX_TOTAL_CHARS` goes from 18000 to 22000. Measured frontend role:
`angular-developer` (9547) + `frontend-boundary-protection` (5937) + `unslop`
(1787) + `web-design` (1228) = 18499, which fits only with the increase and keeps
`web-design` loaded. `UX_DESIGNER` fits well under the new cap.

## Risks

- The condensed `SKILL.md` is an adaptation; the full upstream text remains
  available on disk, and `NOTICE.md` documents the change (CC BY 4.0 allows it).
- Role prompts grow by at most ~4 KB (~1 K tokens) for roles that use many
  skills.
- The vendored scripts require Playwright/ffmpeg only for the optional story
  renderer; they are not executed by WAM.

## Verification

- `tests/unit/unslop-skill.test.mjs`: vendored files, discoverability, and role
  wiring.
- `node --test --test-force-exit tests/unit/unslop-skill.test.mjs tests/unit/agent-role-contracts.test.mjs tests/unit/agent-role-skills.test.mjs`
- `openspec validate add-unslop-skill --strict`, `npm run build`, fresh-session
  web E2E.
