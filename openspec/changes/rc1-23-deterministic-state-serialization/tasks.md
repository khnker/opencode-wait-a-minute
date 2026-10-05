# Tasks

## Implementation
- [ ] Canonicalize state serialization so the same logical state always yields the same representation.
- [ ] Use it for hashing, evidence, benchmarks, continuation and debugging.
- [ ] Repeated serialization is byte-identical.
- [ ] Key order and formatting are stable.
- [ ] Hash matches across runs.

## Validation
- [ ] Run the change's objective validation and paste the output.
- [ ] `openspec validate rc1-23-deterministic-state-serialization --strict` passes.
