# Design: Assumption / Decision-Critical Gate

## Approach
Unknown assumptions must block only when they are decision-critical; otherwise WAM must not add friction.

## Scope
- Unknown assumption that a decision depends on -> block unsafe continuation.
- Unknown assumption that is not decision-critical -> execution continues.

## Validation Strategy
- Decision-critical unknown -> blocked.
- Non-critical unknown -> continues.
- No indiscriminate friction.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
