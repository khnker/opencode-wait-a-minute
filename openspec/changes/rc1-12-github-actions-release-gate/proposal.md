# Change: GitHub Actions Release Gate

## Why
RC1 must not depend on manually running the gates.

## What Changes
- `ci.yml`: install -> lint -> unit -> integration -> deterministic benchmark.
- `e2e.yml`: install -> package -> clean install -> OpenCode -> real E2E.
- `release-gate.yml`: all mandatory gates -> package validation -> E2E -> evidence validation.

## Non-goals
- Manual, undocumented release steps.

## Expected Result
CI enforces every mandatory gate on the relevant triggers.

## Validation
- [ ] All three workflows exist and run the specified gates.
- [ ] Failing gates block merge/release.
- [ ] No manual step required.

## Program
- RC1 item: RC1-12 (D)
- Priority: P0
