# Design: Architecture Documentation

## Approach
README explains what; architecture docs must explain how.

## Scope
- Create docs/architecture/{overview,lifecycle,context-packs,cognition,completion,persistence,evidence}.md.

## Validation Strategy
- All seven docs exist.
- Each explains its subsystem's mechanism.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
