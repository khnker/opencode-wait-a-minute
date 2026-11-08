# Design: Hermetic Release Tests

## Research

- Node.js test runner skip API: <https://nodejs.org/api/test.html#contextskipthe-test-is-skipped>
- npm local path dependencies: <https://docs.npmjs.com/cli/v10/configuring-npm/package-json#local-paths>

## Alternatives

1. **Install global skills or the sibling checkout in CI** — rejected: couples the release to unpublished personal state and credentials.
2. **Delete the environment-dependent tests** — rejected: loses local routing coverage.
3. **Use the vendored engine and skip only when skills are absent** — chosen: deterministic in CI, unchanged locally.

## Decision

Tests import `vendor/context-query-core` directly. Skill tests call `discoverSkills()` and skip with an explicit reason when a required skill is missing; when present, the original assertions run unchanged. `package.json` no longer declares the unused sibling dependency.

## Risks

- CI skips skill-routing coverage; the full gate still runs it locally where the skills exist.
