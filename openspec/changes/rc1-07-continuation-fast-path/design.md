# Design: Continuation Fast-Path

## Approach
Continuation must avoid re-paying full context discovery when valid state already exists.

## Scope
- Case: existing task + existing valid context + existing evidence -> continuation with NO full rediscovery.
- Demonstrate WAM does not pay the full context cost again.

## Validation Strategy
- Fast-path taken when preconditions hold.
- No full rediscovery executed.
- Measured cost below the full-rebuild path.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
