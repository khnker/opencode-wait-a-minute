# Tasks

## Implementation
- [x] Canonicalize state serialization so the same logical state always yields the same representation.
- [x] Use it for hashing, evidence, benchmarks, continuation and debugging.
- [x] Repeated serialization is byte-identical.
- [x] Key order and formatting are stable.
- [x] Hash matches across runs.

## Validation
- [x] Run the change's objective validation and paste the output.
- [x] `openspec validate rc1-23-deterministic-state-serialization --strict` passes.
