# WAM Architecture Taxonomy

## Why

The current repository structure does not clearly communicate ownership. Files are grouped primarily by implementation history rather than by the capabilities they provide, making it difficult to answer basic questions:

- Where does a new feature belong?
- Which module owns task state?
- Which code controls execution?
- Which code is shared infrastructure?
- Which modules may depend on each other?

RC1 requires an explicit architectural taxonomy before the repository is physically reorganized.

## What Changes

Define the canonical WAM architecture around major capabilities:

- `preflight`
- `context`
- `task`
- `execution`
- `verification`
- `skills`
- `runtime`
- `orchestration`
- `shared`

The taxonomy defines ownership and dependency rules.

## Non-Goals

- This change defines architecture; it does not perform the full physical repository migration.
- Do not create pillars for every small helper.
- Do not use `shared` as a generic miscellaneous directory.
- Do not introduce architectural layers without a concrete responsibility.

## Expected Result

Every significant production module has a clear semantic owner. A maintainer can determine where new code belongs without inspecting unrelated implementation details. Dependencies have an explicit direction. The taxonomy is usable as the basis for subsequent repository migration.

## Validation

- [ ] Every production module is assigned a semantic owner.
- [ ] Dependency direction documented and violations listed.
- [ ] `shared` contains only domain-neutral responsibilities.
- [ ] Taxonomy approved before physical migration.

## Program

- Order: 4 of 5
- Priority: P0
