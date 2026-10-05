# Design: Fail-Closed Completion

## Approach
WAM must never convert an unknown/ambiguous/error condition into assumed success.

## Scope
- Rule: Unknown, Ambiguous, Missing evidence, Invalid state -> NOT VERIFIED.
- Never map an exception to assumed success.

## Validation Strategy
- Unknown -> NOT VERIFIED.
- Ambiguous -> NOT VERIFIED.
- Missing evidence -> NOT VERIFIED.
- Invalid state -> NOT VERIFIED.
- No exception maps to success.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
