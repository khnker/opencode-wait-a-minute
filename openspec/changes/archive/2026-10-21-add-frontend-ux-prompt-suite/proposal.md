# Add Frontend UX Prompt Suite

## Why

WAM has no structured, versioned prompt set for frontend UX tasks. This leads to ad-hoc prompting, inconsistent evidence quality, and no way to test or evolve UX-specific instructions independently of the core engine. A dedicated prompt suite gives WAM consistent, independently testable UX capabilities that integrate with the existing prompt catalog without creating a competing system.

## What Changes

- Create a versioned Markdown prompt suite under `prompts/frontend-ux/` with five prompts: `diagnose`, `design`, `refine`, `verify`, `review`.
- Create a `manifest.json` that catalogs every prompt with its stable id, version, intended use/activation, required inputs, expected outputs, constraints, evidence requirements, and failure/fallback behavior.
- Each prompt distinguishes observed defects from hypotheses and MUST NOT invent usability findings or quantitative improvements.
- Prompts follow WAM's existing conventions (`prompts/index.json` catalog, frontmatter keys) and are NOT a competing system.
- All five prompts and the manifest are independently testable against fixtures.

## Non-Goals

- Does not change WAM's core prompt catalog or index structure.
- Does not add runtime logic beyond consuming the prompt suite via the integration from `integrate-impeccable-frontend-ux`.
- Does not assert that a prompt output is correct; only that it conforms to the expected structural contract.
