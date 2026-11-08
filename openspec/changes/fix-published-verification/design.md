# Design: Fix Published Package Verification

## Research

- Node.js recursive `readdirSync`: <https://nodejs.org/api/fs.html#fsreaddirsyncpath-options>
- npm `files` glob semantics: <https://docs.npmjs.com/cli/v10/configuring-npm/package-json#files>

## Alternatives

1. **Unpublish and republish `1.1.0`** — rejected: destructive, needs registry credentials locally, and a patch is safer.
2. **List every vendored file explicitly** — rejected: verbose and easy to drift.
3. **Recursive glob verification plus removing the stale entry, released as `1.1.1`** — chosen.

## Decision

`verifyExpectedFiles` walks the glob base recursively and matches the full relative path. `vendor/**/dist` is removed because no vendored package currently builds a `dist/` directory.

## Risks

- None to published runtime behavior; only release metadata/verification.
