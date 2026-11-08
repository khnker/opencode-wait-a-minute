# Proposal: add-release-e2e-gate

## Problem

The existing release gate proves that the checkout passes tests and that a
tarball can be installed, but it does not prove that the **installed** package
works in a fresh `opencode web` session driven the way a user drives it. A
regression in the published entry point, plugin discovery, bundled skills or
the web adapter could pass every current gate and still ship broken.

The user asked for a release base condition that packs the plugin, installs it
into an isolated test user, starts a separate `opencode web` instance, drives
the real UI with Playwright and verifies the task/contract state before any
tag, push or publish.

## What changes

- New `scripts/verify-release-e2e.mjs` and `npm run verify:release`.
- The script packs the working tree, installs the tarball into a throwaway app,
  creates an isolated HOME/XDG test user, starts a new `opencode web` process
  that loads only the installed package, and drives the UI with Playwright.
- `npm run gate` includes `verify:release` as a required gate outside GitHub
  Actions.
- `AGENTS.md` documents the release base condition: `npm run build` →
  `npm run verify:release` → `npm run gate`, with no tag/push/publish on failure.

## Alternatives considered

- **Reuse `verify:web`**: rejected. It starts the server from the checkout and
  talks to the HTTP API; it never installs the tarball and never renders the UI.
- **Reuse `tests/e2e/opencode/smoke.mjs`**: rejected. It runs `opencode run` and
  asserts adapter loading, but it does not exercise the web UI or the rendered
  assistant response.
- **Manual release checklist**: rejected. It is not reproducible and cannot be
  a gate.
- **Copy the real user config into the fixture**: rejected. The real config
  contains plaintext provider keys; the isolated test user must not copy
  credentials.
- **Require a model/provider key**: rejected. The default model works without
  credentials, which keeps the gate hermetic.

## Out of scope

- Automating the publish, tag or push itself. Those remain explicit,
  human-approved steps.
- Replacing the existing unit, smoke and HTTP web suites.
