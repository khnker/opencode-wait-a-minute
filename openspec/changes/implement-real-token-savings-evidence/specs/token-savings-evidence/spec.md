# Specification: Token Savings Evidence

## Requirement: Real execution evidence

The benchmark MUST derive token measurements from captured execution data rather than fixed scenario formulas.

### Scenario

Given a benchmark scenario with a baseline and WAM execution

When the benchmark completes

Then the resulting evidence MUST contain the measured token usage for both conditions.

## Requirement: Provider usage

When the model provider exposes token usage

Then provider-reported usage MUST be used as the authoritative token source.

## Requirement: Tokenizer fallback

When provider usage is unavailable

Then the benchmark MAY calculate tokens from captured request content using a declared tokenizer.

The evidence MUST identify the tokenizer used.

## Requirement: Negative savings

If WAM consumes more tokens than baseline

Then the benchmark MUST report negative savings.

It MUST NOT clamp the value to zero.

## Requirement: Verified progress

Every completed benchmark run MUST record whether the expected work was verified.

A token reduction MUST NOT be interpreted as successful optimization when the expected work was not verified.

## Requirement: Provenance

Every evidence bundle MUST contain the exact Git SHA, dirty-tree state, scenario version, runner version, and analyzer version.

## Requirement: Paired comparison

Baseline and WAM measurements MUST be paired under equivalent benchmark conditions.

## Requirement: Repeated execution

Real-model benchmarks MUST support at least five repetitions.

Ten repetitions SHOULD be supported as the default recommended sample size.

## Requirement: Statistical summary

Repeated benchmark results MUST expose:

- minimum
- p25
- median
- p75
- maximum

## Requirement: Raw evidence

The benchmark MUST retain raw execution evidence independently from the generated summary.

## Requirement: Claims classification

Every token measurement MUST identify whether it is:

- observed
- measured
- derived
- estimated

Estimated measurements MUST NOT be presented as observed measurements.

## Requirement: Deterministic CI

Deterministic trace replay MUST be executable without network access and MUST produce stable results from identical fixtures.

## Requirement: Real-model opt-in

Real-model execution MUST be explicitly opt-in and MUST NOT be required for the normal unit-test suite.
