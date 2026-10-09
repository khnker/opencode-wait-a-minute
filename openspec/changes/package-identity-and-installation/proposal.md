# Proposal: Package Identity & Installation (CHANGE 01)

## Problem

The plugin's package identity is split between the legacy `wait-a-minute` name (README, docs, sample code) and the published `opencode-wait-a-minute` name (used in `package.json`, tarball, and registry). This drift causes:

- README clone/install instructions resolve to the wrong repository or the wrong tarball name.
- New contributors ship scripts that `import` the legacy module name and fail in CI.
- Release-gate smoke tests cannot assert a single canonical identity because docs and code disagree.

## Solution

Unify the public identity on `opencode-wait-a-minute` everywhere a user-facing string references the package (README, docs, sample scripts, CI). Keep the legacy `wait-a-minute-test.mjs` filename in the test suite for historical continuity — that is an internal filename, not a package identity.

Add a tarball install verifier that:

1. Packs the current working tree into a `.tgz` via `npm pack --silent`.
2. Installs the tarball into a fresh `tmpdir()` (no network, `--ignore-scripts`).
3. Requires the installed package and asserts the resolved `name` is exactly `opencode-wait-a-minute`.
4. Exits non-zero on any mismatch.

Wire the verifier as `verify:tarball` in `package.json` and extend the release-gate so the assertion runs in CI before the existing smoke test.

## Scope

- OpenSpec proposal, design, specs, and tasks (this change).
- Identity unification in README (EN/ES), `docs/architecture-boundaries.md`, `docs/architecture/compatibility.md`, `docs/releases/RC1.md`, `docs/development/release.md`, `docs/RC1_VALIDATION.md`.
- Sample-script fix in `tests/e2e/opencode/smoke.mjs` and any of `scripts/verify-package.mjs`, `verify-published-package.mjs`, `check-compatibility.mjs`, `package-e2e.mjs` that assumes the old name.
- New `scripts/verify-tarball-install.mjs` and `package.json` script `verify:tarball`.
- Release-gate CI assertion of the installed tarball's `name` field.

## Out of scope

- Renaming internal files (e.g. `wait-a-minute-test.mjs`) — legacy filenames are allowed.
- Republishing to npm.
- Changing the CQE integration contract (tracked under `wam-cqe-integration`).

## Findings

- `package.json#name` is already `opencode-wait-a-minute@1.1.0` — that is the source of truth.
- `index.js`, `skills/registry.json`, and the `files` allowlist already use the new name.
- The drift is purely in documentation and one sample script. The verifier closes the loop so future drift fails fast.

## Constraint

No production behavior change beyond a single CI/release assertion and documentation unification. `npm test` must remain green (2854 pass / 0 fail).
