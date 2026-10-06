# Design

## Extension Point Identification

An extension point is justified when the system has recurring variation in:

- strategy;
- policy;
- provider;
- validator;
- routing;
- execution mechanism;
- capability;
- integration.

One-off behavior should remain direct code.

## Contract Requirements

A contract should define:

- input;
- output;
- failure behavior;
- lifecycle;
- side effects;
- ownership;
- registration mechanism;
- ordering requirements, if any.

Contracts must be narrow enough that an implementation does not need to know about unrelated system internals.

## Registration vs Execution

Registration answers: *What capabilities exist?*
Execution answers: *Which capability should execute now?*

These concerns should not be coupled unnecessarily.

## Central Branching

Large `if`/`switch` structures should only be replaced when they represent stable recurring variation.

A conditional is acceptable when:

- there are only a few cases;
- the cases are intrinsic to the algorithm;
- introducing an abstraction would obscure logic.

## Human Extension Test

For each major extension point, create a representative test or fixture that demonstrates the expected extension workflow. The test must prove that adding a capability does not require changes to unrelated orchestration or domain code.

## Deliverables

- `docs/development/extension-contracts.md` — contract catalogue + workflow.
- Extension fixture(s) + tests under `tests/`.
