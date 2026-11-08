# Fix Published Package Verification

## Why

The release workflow published `1.1.0`, but the post-publish verifier failed. It only inspected the top level of each glob base and also expected `vendor/**/dist`, a path that does not exist in this repository. The published artifact itself is valid.

## What Changes

- Match nested glob entries recursively in `verify-published-package.mjs`.
- Remove the stale `vendor/**/dist` entry from `package.json`.
- Bump to `1.1.1` so the release workflow can publish a commit whose metadata verifies cleanly.

## Non-Goals

- Unpublishing or deprecating `1.1.0`.
- Changing the runtime contents of the package.
