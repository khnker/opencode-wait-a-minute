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

- Implementation: `src/completion/`
- Unit tests: `tests/unit/completion/`
- E2E scenarios: `tests/e2e/completion-control/`

## Limitations

WAM can only verify what it is programmed to check. Novel project types may require additional verification steps.

## Related documentation

- [Less Guessing](less-guessing.md)
- [Task State](task-state.md)
