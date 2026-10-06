# Documentation and Comment Quality

## Why

WAM contains non-obvious behavior around task state, completion, verification, evidence, context levels, persistence, continuation, and token accounting.

Comments should explain reasoning and invariants that cannot be inferred from code itself. Redundant comments create noise, while missing or stale comments create incorrect mental models for maintainers.

## What Changes

- Audit comments and JSDoc across the repository.
- Classify comments as:
  - C0: no comment required
  - C1: useful existing comment
  - C2: important explanation missing
  - C3: redundant/noise
  - C4: stale or misleading
- Document architectural invariants.
- Document lifecycle and state-transition rules.
- Document non-obvious algorithms.
- Document fail-closed behavior.
- Add JSDoc to architecturally important public/internal APIs.
- Remove redundant and stale comments.
- Document benchmark and token-accounting methodology.

## High-Risk Areas

The audit must explicitly inspect:

- task lifecycle/state;
- completion gates;
- evidence handling;
- CLAIM → ACTION → OBSERVATION → EVIDENCE → VERIFIED;
- N0/N1/N2/N3 context levels;
- continuation fast-path;
- persistence and recovery;
- OpenCode integration;
- token accounting;
- benchmark methodology.

## Non-Goals

- Do not comment obvious code.
- Do not add comments merely to increase comment coverage.
- Do not duplicate implementation details that are already obvious.
- Do not change behavior as part of documentation work.

## Expected Result

A maintainer can understand important invariants and architectural decisions without reverse-engineering implementation details. No C4 comments remain in production code; C3 comments are removed unless they carry meaningful context; important C2 gaps are documented.

## Validation

- [ ] No C4 comments remain in production code.
- [ ] C3 comments removed unless contextual.
- [ ] High-risk invariants (list above) documented.
- [ ] `npm test` exits 0 (documentation-only change).

## Program

- Order: 3 of 5
- Priority: P0
