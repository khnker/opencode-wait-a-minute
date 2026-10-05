# Design: Deterministic State Serialization

## Approach
Identical logical state must canonicalize identically for hashing, evidence, benchmarks, continuation and debugging.

## Scope
- Canonicalize state serialization so the same logical state always yields the same representation.
- Use it for hashing, evidence, benchmarks, continuation and debugging.

## Validation Strategy
- Repeated serialization is byte-identical.
- Key order and formatting are stable.
- Hash matches across runs.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
