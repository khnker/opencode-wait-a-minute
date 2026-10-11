# Design: CHANGELOG Final

## Approach
CHANGELOG must describe the release, not list commits.

## Scope
- Structure: RC1 -> Added / Changed / Fixed / Performance / Validation / Known limitations.

## Validation Strategy
- Sections present.
- No raw commit dump.
- Consistent with release doc.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
