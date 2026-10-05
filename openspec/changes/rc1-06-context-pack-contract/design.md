# Design: Context Pack Contract

## Approach
Context selection tiers must be contractually stable and reproducible.

## Scope
- Golden fixtures for N0 mandatory, N1 domain, N2 mandatory, N3 opportunistic.
- Assert: N0 always when applicable; N2 always; N1 by domain; N3 only when it adds value; stable order; stable serialization; no duplication.
- Assert reproducibility for identical input.

## Validation Strategy
- N0/N2 inclusion rules hold.
- N1 depends on domain.
- N3 only when valuable.
- Stable order and serialization.
- No duplication.
- Identical input -> identical pack.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
