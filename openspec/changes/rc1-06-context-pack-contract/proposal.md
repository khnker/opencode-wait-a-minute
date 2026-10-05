# Change: Context Pack Contract

## Why
Context selection tiers must be contractually stable and reproducible.

## What Changes
- Golden fixtures for N0 mandatory, N1 domain, N2 mandatory, N3 opportunistic.
- Assert: N0 always when applicable; N2 always; N1 by domain; N3 only when it adds value; stable order; stable serialization; no duplication.
- Assert reproducibility for identical input.

## Non-goals
- Order-dependent or non-reproducible context packs.

## Expected Result
Context packs satisfy tier rules, are stably ordered/serialized, deduplicated and reproducible.

## Validation
- [ ] N0/N2 inclusion rules hold.
- [ ] N1 depends on domain.
- [ ] N3 only when valuable.
- [ ] Stable order and serialization.
- [ ] No duplication.
- [ ] Identical input -> identical pack.

## Program
- RC1 item: RC1-06 (C)
- Priority: P0
