# Tasks

## Implementation
- [ ] Cover: malformed state, missing state, corrupted state, unknown task, invalid transition, missing evidence, invalid evidence, plugin initialization failure, OpenCode unavailable, filesystem permission error.
- [ ] Each case has a test.
- [ ] Each fails closed with a clear signal.
- [ ] No unhandled exception path.

## Validation
- [ ] Run the change's objective validation and paste the output.
- [ ] `openspec validate rc1-24-error-path-coverage --strict` passes.
