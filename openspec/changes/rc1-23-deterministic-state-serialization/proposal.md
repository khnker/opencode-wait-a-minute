# Change: Deterministic State Serialization

## Why
Identical logical state must canonicalize identically for hashing, evidence, benchmarks, continuation and debugging.

## What Changes
- Canonicalize state serialization so the same logical state always yields the same representation.
- Use it for hashing, evidence, benchmarks, continuation and debugging.

## Non-goals
- Order-dependent or unstable serialization.

## Expected Result
The same logical state always serializes to the same canonical form.

## Validation
- [ ] Repeated serialization is byte-identical.
- [ ] Key order and formatting are stable.
- [ ] Hash matches across runs.

## Program
- RC1 item: RC1-23 (G)
- Priority: P0
