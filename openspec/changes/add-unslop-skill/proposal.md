# Proposal: add-unslop-skill

## Problem

Frontend/UI work in WAM has `web-design` and `no-slop-ui`, but no single base
skill that turns vibecoded, AI-looking screens into a deliberate design pass by
pass. The user asked to add Damir Sokolovsky's `unslop` skill
(https://github.com/heydamir/unslop) as a base skill for UI/frontend work.

## Analysis

- Curated skills live in `skills/<id>/SKILL.md` and are discovered by
  `discoverSkills`; they are not generated from `skills/registry.json`.
- `resolveRoleSkills` injects a role's `skills` list with a per-role character
  budget (`DEFAULT_MAX_TOTAL_CHARS`, previously 18000).
- The upstream `SKILL.md` is ~31 KB; injected verbatim it would exceed the budget
  and starve the other frontend skills.
- Upstream is CC BY 4.0: attribution and license must ship with the copy.

## Decision

1. Vendor the skill at `skills/unslop/` (references, images, scripts and Codex
   manifest verbatim; `LICENSE` + `NOTICE.md`).
2. Ship a condensed `SKILL.md` (~1.8 KB) that captures the method and points to
   the references; keep the full upstream text at
   `references/upstream-skill.md`.
3. Add `unslop` to the `FRONTEND_ENGINEER` and `UX_DESIGNER` role skill lists.
4. Raise the role skill budget from 18000 to 22000 chars so `unslop` fits
   alongside `web-design` instead of displacing it.

## Alternatives considered

- **Registry-only entry** (`skills/registry.json`): rejected. The registry is
  generated from upstream clones and embeds full content; it does not provide a
  role base skill and would bloat the registry.
- **UX-only wiring**: rejected. Frontend implementers are the main audience for
  the anti-slop redline.
- **Keep 18000**: rejected. 15484 (angular + boundary) + 1787 (unslop) + 1228
  (web-design) > 18000, so `web-design` would be silently dropped.

## Out of scope

- Rewriting the upstream skill content.
- Auto-installing Playwright/ffmpeg for the optional story renderer; the skill
  instructs the user when those are missing.
