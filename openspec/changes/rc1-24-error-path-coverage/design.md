# Design: Error-Path Coverage

## Approach
Reliability requires failing gracefully outside the happy path.

## Scope
- Cover: malformed state, missing state, corrupted state, unknown task, invalid transition, missing evidence, invalid evidence, plugin initialization failure, OpenCode unavailable, filesystem permission error.

## Validation Strategy
- Each case has a test.
- Each fails closed with a clear signal.
- No unhandled exception path.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
