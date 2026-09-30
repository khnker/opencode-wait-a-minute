# Benchmark Report — token-savings-evidence

## Methodology

Deterministic trace replay of captured execution traces. Token counts are
derived from recorded per-turn measurements, not from scenario constants.
Baseline and WAM traces represent equivalent tasks; the only intended
difference is the presence or absence of WAM. Negative savings are valid.

## Claims Policy

Every measurement is classified as one of:

- `observed` — reported directly by the provider or execution trace
- `measured` — calculated from captured execution data
- `derived` — calculated from measured values
- `estimated` — inferred using a declared estimator

Claim levels: observed, measured, derived, estimated

## Provenance

- Benchmark version: 1.0.0
- Mode: trace-replay
- Git SHA: 8e4f07839c47ca1d00106bd51597e48235f570dc
- Dirty tree: true
- Timestamp: 2026-09-30T15:38:49.003Z

## Results

| Scenario | Condition | Claim | Input | Output | Total | Turns | Rebuilds | Verified Progress | Completion |
|---|---|---|---|---|---|---|---|---|---|
| S1 | baseline | measured | 4900 | 600 | 5500 | 2 | 1 | 1 | COMPLETED |
| S1 | wam | measured | 2820 | 600 | 3420 | 2 | 0 | 1 | COMPLETED |
| S2 | baseline | measured | 14450 | 1820 | 16270 | 6 | 2 | 1 | COMPLETED |
| S2 | wam | measured | 10400 | 1820 | 12220 | 6 | 1 | 1 | COMPLETED |
| S3 | baseline | measured | 22650 | 2400 | 25050 | 8 | 4 | 1 | COMPLETED |
| S3 | wam | measured | 14550 | 2400 | 16950 | 8 | 2 | 1 | COMPLETED |
| S4 | baseline | measured | 32300 | 3600 | 35900 | 12 | 5 | 1 | COMPLETED |
| S4 | wam | measured | 20650 | 3600 | 24250 | 12 | 2 | 1 | COMPLETED |
| S5 | baseline | measured | 26000 | 3000 | 29000 | 10 | 4 | 1 | COMPLETED |
| S5 | wam | measured | 18800 | 3000 | 21800 | 10 | 3 | 1 | COMPLETED |
| S6 | baseline | measured | 1500 | 300 | 1800 | 1 | 0 | 1 | COMPLETED |
| S6 | wam | measured | 9000 | 300 | 9300 | 1 | 0 | 1 | COMPLETED |

## Savings

| Scenario | Input Δ | Input Savings | Total Δ | Total Savings |
|---|---|---|---|---|
| S1 | 2080 | +42.45% | 2080 | +37.82% |
| S2 | 4050 | +28.03% | 4050 | +24.89% |
| S3 | 8100 | +35.76% | 8100 | +32.34% |
| S4 | 11650 | +36.07% | 11650 | +32.45% |
| S5 | 7200 | +27.69% | 7200 | +24.83% |
| S6 | -7500 | -500% | -7500 | -416.67% |

## Statistics (input savings %)

| Metric | Value |
|---|---|
| n | 6 |
| min | -500 |
| p25 | 27.775000000000002 |
| median | 31.895 |
| p75 | 35.9925 |
| max | 42.45 |
