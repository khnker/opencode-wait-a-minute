# Verification

## Claim

WAM reduces unsupported "Done" claims by requiring evidence before completion.

## What this means

An agent might claim completion without:
- Running tests
- Checking build status
- Validating against requirements

WAM ties completion to verifiable evidence.

## How WAM does it

WAM's completion control requires:
- Test passes
- Build success
- Evidence collection (e.g., logs, artifacts)
- Explicit verification signal

## Evidence

- Implementation: `src/verification/verification.js`, `src/verification/verification-lifecycle.js`
- Unit tests: `tests/unit/verification.test.mjs`, `tests/unit/completion-gate.test.mjs`, `tests/unit/false-completion-prevention.test.mjs`

## Limitations

WAM can only verify what it is programmed to check. Novel project types may require additional verification steps.

## Related documentation

- [Less Guessing](less-guessing.md)
- [Task State](task-state.md)
