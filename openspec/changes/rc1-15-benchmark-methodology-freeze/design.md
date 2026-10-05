# Design: Benchmark Methodology Freeze

## Approach
Deterministic and live-provider benchmarks must never be mixed.

## Scope
- Formally separate deterministic vs live-provider benchmarks.
- Each result MUST include commit, version, scenario, baselineTokens, wamTokens, savingsTokens, savingsPercent, equivalent, and provider/model when applicable.

## Validation Strategy
- Deterministic and live outputs are separate.
- Every result has the required fields.
- No merged percentage is reported.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
