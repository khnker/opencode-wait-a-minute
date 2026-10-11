# Change: Continuation Fast-Path

## Why
Continuation must avoid re-paying full context discovery when valid state already exists.

## What Changes
- Case: existing task + existing valid context + existing evidence -> continuation with NO full rediscovery.
- Demonstrate WAM does not pay the full context cost again.

## Non-goals
- Full rebuild on every continuation.

## Expected Result
A valid continuation skips full rediscovery and reuses existing context/evidence.

## Validation
- [ ] Fast-path taken when preconditions hold.
- [ ] No full rediscovery executed.
- [ ] Measured cost below the full-rebuild path.

## Program
- RC1 item: RC1-07 (C)
- Priority: P0
