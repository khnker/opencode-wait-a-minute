# Make Release Tests Hermetic on Clean CI

## Why

The tag-triggered release workflow runs `npm run gate` on a clean GitHub runner. Three tests assume the developer machine:

- `context-query-core` is imported as a package from a sibling checkout, but the runtime uses the vendored copy.
- The skill-routing accuracy benchmark expects globally installed skills.
- The skill-audit test expects the global `shadcn` skill.

These assumptions fail in CI and block publishing even when the code is correct.

## What Changes

- Import the vendored `context-query-core` in the CQE nonfunctional test and drop the unused package dependency.
- Skip environment-dependent skill tests when their required skills are not discoverable; keep them enforced on developer machines.
- Add regression coverage that the suite behaves deterministically with an empty `HOME`.

## Non-Goals

- Bundling third-party personal skills into the repository.
- Weakening routing assertions when the required skills are installed.
