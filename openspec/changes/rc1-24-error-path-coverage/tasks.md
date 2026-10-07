# Tasks

## Implementation
- [x] Cover: malformed state, missing state, corrupted state, unknown task, invalid transition, missing evidence, invalid evidence, plugin initialization failure, OpenCode unavailable, filesystem permission error.
- [x] Each case has a test.
- [x] Each fails closed with a clear signal.
- [x] No unhandled exception path.

## Validation
- [x] Run the change's objective validation and paste the output.
- [x] `openspec validate rc1-24-error-path-coverage --strict` passes.
