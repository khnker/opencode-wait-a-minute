# Tasks

## Implementation
- [ ] Golden fixtures for N0 mandatory, N1 domain, N2 mandatory, N3 opportunistic.
- [ ] Assert: N0 always when applicable; N2 always; N1 by domain; N3 only when it adds value; stable order; stable serialization; no duplication.
- [ ] Assert reproducibility for identical input.
- [ ] N0/N2 inclusion rules hold.
- [ ] N1 depends on domain.
- [ ] N3 only when valuable.
- [ ] Stable order and serialization.
- [ ] No duplication.
- [ ] Identical input -> identical pack.

## Validation
- [ ] Run the change's objective validation and paste the output.
- [ ] `openspec validate rc1-06-context-pack-contract --strict` passes.
