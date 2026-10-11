# Change: Node / OpenCode Compatibility Matrix

## Why
Compatibility claims must be precise and testable, not implied by a single install.

## What Changes
- Document supported Node versions and OpenCode tested/minimum versions.
- Encode them as an E2E fixture/config.
- Avoid claiming OpenCode compatibility from a single concrete install.

## Non-goals
- Vague compatibility claims.

## Expected Result
Compatibility is explicitly documented and exercised by the E2E fixture.

## Validation
- [x] Matrix documented.
- [x] Fixture/config drives E2E.
- [x] Unsupported versions fail fast.

## Program
- RC1 item: RC1-14 (D)
- Priority: P1
