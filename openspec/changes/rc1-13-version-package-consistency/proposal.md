# Change: Version / Package Consistency

## Why
Version drift across package.json, README, CHANGELOG, plugin manifest and git tag undermines releases.

## What Changes
- Assert equality of package.json version, README version, CHANGELOG version, plugin manifest version and git tag.
- Fail the gate on divergence.

## Non-goals
- Manually syncing versions without a check.

## Expected Result
All version sources agree, enforced by an automated check in the gate.

## Validation
- [x] A mismatch in any source fails the gate.
- [x] A matching set passes.
- [x] The check runs in CI and locally.

## Program
- RC1 item: RC1-13 (B)
- Priority: P0
