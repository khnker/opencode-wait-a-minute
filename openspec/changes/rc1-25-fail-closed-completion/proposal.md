# Change: Fail-Closed Completion

## Why
WAM must never convert an unknown/ambiguous/error condition into assumed success.

## What Changes
- Rule: Unknown, Ambiguous, Missing evidence, Invalid state -> NOT VERIFIED.
- Never map an exception to assumed success.

## Non-goals
- Optimistic completion on error.

## Expected Result
Every ambiguous or error condition resolves to NOT VERIFIED, never success.

## Validation
- [ ] Unknown -> NOT VERIFIED.
- [ ] Ambiguous -> NOT VERIFIED.
- [ ] Missing evidence -> NOT VERIFIED.
- [ ] Invalid state -> NOT VERIFIED.
- [ ] No exception maps to success.

## Program
- RC1 item: RC1-25 (G)
- Priority: P0
