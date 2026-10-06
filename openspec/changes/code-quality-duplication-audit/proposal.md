# Duplication Audit and Consolidation

## Why

Current WAM codebase contains repeated logic across production code, tests, benchmarks, and tooling. Some repetition is intentional, but other cases represent duplicated responsibilities that increase maintenance cost and make future changes harder to reason about.

Before restructuring the repository, duplication must be identified and classified. Refactoring duplicated code without first understanding ownership risks moving domain logic into generic utilities and creating a larger dependency problem.

## What Changes

- Audit production, test, benchmark, and tooling code for duplication.
- Classify duplication as:
  - D1: exact duplication
  - D2: structural duplication
  - D3: semantic duplication
  - D4: intentional duplication
- Identify semantic owner of duplicated responsibilities.
- Consolidate accidental duplication where doing so improves maintainability.
- Keep domain-specific helpers with their owning capability.
- Move code to `shared` only when it is genuinely cross-pillar and domain-neutral.
- Add characterization or regression tests before behavior-changing refactors.
- Document intentional duplication where consolidation would reduce clarity.

## Non-Goals

- Do not apply DRY mechanically.
- Do not change WAM behavior.
- Do not introduce a generic `utils` dumping ground.
- Do not move domain logic into `shared` merely because multiple modules use it.
- Do not perform repository-wide structural migration in this change.

## Expected Result

A duplication inventory with every finding classified (D1–D4), explicit ownership decisions for D3, documented D4, and consolidated accidental duplication backed by regression coverage.

## Validation

- [ ] No unexplained D1/D2 duplication remains in production code.
- [ ] D3 duplication has an explicit ownership decision.
- [ ] D4 duplication is documented when relevant.
- [ ] Consolidated code has regression coverage.
- [ ] `shared` contains only domain-neutral responsibilities.
- [ ] Existing tests and benchmarks preserve their behavior.

## Program

- Order: 1 of 5 (before taxonomy and physical migration)
- Priority: P0
