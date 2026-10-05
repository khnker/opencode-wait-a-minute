# Design: RC1 Release Document

## Approach
Release detail must not be buried in the README.

## Scope
- Create `docs/releases/RC1.md` with scope, included features, known limitations, test matrix, benchmark evidence, compatibility, release gates, known risks and post-RC1 work.

## Validation Strategy
- File exists with all sections.
- Consistent with CHANGELOG and gates.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
