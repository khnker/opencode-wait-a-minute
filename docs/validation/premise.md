# Validation Premise

## Premise

WAM's central proposition is that it can make control decisions from explicit
task state, reconstructed context and evidence, deterministically, instead of
depending on accumulated model conversation.

This document states the premise and the strategy used to validate it. It does
not assert that the premise is fully proven.

## Decomposition

The premise decomposes into properties, each of which can be perturbed:

1. **State gating** — illegal transitions and premature completion are rejected.
2. **Evidence gating** — completion requires verified requirements and no
   evidence gaps.
3. **Context integrity** — required context levels cannot be substituted.
4. **Evidence semantics** — conflicting evidence is not treated as support.
5. **Skill relevance** — relevant skills are selected, unrelated ones are not.
6. **Task isolation** — task state does not leak across task boundaries.
7. **End-to-end determinism** — the same state and inputs yield the same decision
   under real model execution.

## Validation strategy

Each property is validated by perturbation: hold the system fixed, vary the
relevant input, and observe whether the decision changes as specified.

- **PASS** — implemented and covered by an automated test that exercises the
  perturbation.
- **FAIL** — implemented but the observed behavior contradicts the expected
  effect.
- **NOT IMPLEMENTED** — no mechanism or no test exists for the perturbation.

The per-property results are in the
[Causal Decision Matrix](causal-decision-matrix.md).

## Scope and honesty

Properties 1–6 are covered by deterministic unit and isolation tests.
Property 7, and the release-level claim of a 60% task-relevant context reduction
under real model execution, are **NOT IMPLEMENTED**: the repository does not
contain a reproducible real-model harness with equivalent accounting on both
sides. See [Benchmark Limitations](../benchmarks/limitations.md).
