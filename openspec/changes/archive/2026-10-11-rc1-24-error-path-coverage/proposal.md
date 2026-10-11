# Change: Error-Path Coverage

## Why
Reliability requires failing gracefully outside the happy path.

## What Changes
- Cover: malformed state, missing state, corrupted state, unknown task, invalid transition, missing evidence, invalid evidence, plugin initialization failure, OpenCode unavailable, filesystem permission error.

## Non-goals
- Testing only happy paths.

## Expected Result
Every listed error path is covered and fails closed.

## Validation
- [ ] Each case has a test.
- [ ] Each fails closed with a clear signal.
- [ ] No unhandled exception path.

## Program
- RC1 item: RC1-24 (G)
- Priority: P0
