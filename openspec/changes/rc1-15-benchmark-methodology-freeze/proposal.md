# Change: Benchmark Methodology Freeze

## Why
Deterministic and live-provider benchmarks must never be mixed.

## What Changes
- Formally separate deterministic vs live-provider benchmarks.
- Each result MUST include commit, version, scenario, baselineTokens, wamTokens, savingsTokens, savingsPercent, equivalent, and provider/model when applicable.

## Non-goals
- Merging deterministic and live percentages.

## Expected Result
Benchmark methodology is frozen and results carry full provenance, never mixed.

## Validation
- [ ] Deterministic and live outputs are separate.
- [ ] Every result has the required fields.
- [ ] No merged percentage is reported.

## Program
- RC1 item: RC1-15 (E)
- Priority: P1
