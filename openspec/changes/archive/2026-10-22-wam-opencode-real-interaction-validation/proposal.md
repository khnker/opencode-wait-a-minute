# Proposal: WAM-OpenCode Real Interaction Validation
## Why
The WAM plugin must be validated end-to-end against a real OpenCode runtime using its packed artifact (not source checkout). The OpenCode compatibility contract in `docs/OPENCODE_COMPATIBILITY.md` declares required hooks, export signature, and `.wam/` state behavior, but there is no change tracking whether those hold across OpenCode versions and in real session execution.
## What Changes
- Refined `tests/e2e/opencode/smoke.mjs` with transient-failure handling, hook-registration validation, and `.wam/` state lifecycle assertions.
- Verified `check-compatibility.mjs` against `compatibility-matrix.mjs`.
- Documented discovered constraints in `docs/OPENCODE_COMPATIBILITY.md` (state root resolution, hook registration mechanism, `chat.message` behavior in OpenCode 1.19).
- Created spec `specs/wam-opencode-interaction/spec.md` with delta headers and SHALL/MUST acceptance criteria.
## Problem
We need to validate that the WAM plugin, when installed as an artifact (not running from source checkout), correctly hooks into the OpenCode lifecycle, maintains persistent state in `.wam/`, and that the E2E runner (which mimics this) correctly asserts plugin loading and state integrity.
## Goal
Verify the real interaction between the WAM plugin and the OpenCode runtime using a packed artifact to ensure no coupling on repository-specific paths or runtime assumptions exists, and validate the E2E harness's ability to reliably detect these interactions.
## Success Criteria
- [ ] Plugin loads correctly when installed via `npm pack`.
- [ ] Plugin hooks (`chat.message`, `tool.execute.before`, etc.) register and trigger in real OpenCode sessions.
- [ ] Persistent state correctly initializes in the runtime environment.
- [ ] E2E harness reliably detects and validates plugin loading and round-trip.
- [ ] Fail-fast mechanisms correctly handle environment variations (e.g., Node version).
