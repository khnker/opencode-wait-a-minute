# Change: Assumption / Decision-Critical Gate

## Why
Unknown assumptions must block only when they are decision-critical; otherwise WAM must not add friction.

## What Changes
- Unknown assumption that a decision depends on -> block unsafe continuation.
- Unknown assumption that is not decision-critical -> execution continues.

## Non-goals
- Blocking on every unknown.

## Expected Result
WAM blocks exactly when an unknown assumption is decision-critical and proceeds otherwise.

## Validation
- [ ] Decision-critical unknown -> blocked.
- [ ] Non-critical unknown -> continues.
- [ ] No indiscriminate friction.

## Program
- RC1 item: RC1-05 (C)
- Priority: P0
