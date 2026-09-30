# Design: Harden Production Release Gate

## 1. Production gate layers

The release gate should execute these layers:

```text
1. Static/package integrity
2. Runtime loading
3. Governance
4. Completion/evidence
5. Cognition lifecycle
6. Task/session isolation
7. Strategy capabilities
8. Audit contract
9. Continuation performance invariant
```

Each layer must have deterministic pass/fail behavior.

## 2. Package verification

The gate must verify the actual release artifact.

Recommended flow:

```text
npm pack
    ↓
temporary clean directory
    ↓
npm install generated tarball
    ↓
load plugin
    ↓
run smoke test
```

The test must not rely exclusively on the repository working tree.

This catches missing package files, incorrect `files` configuration and runtime dependencies that exist only in the repository.

## 3. Governance invariant

The gate must verify that:

```text
unapproved contract
    +
mutating operation
    =
BLOCK
```

and:

```text
approved contract
    +
allowed capability
    =
eligible
```

The gate must also verify that exceptions such as `ASKING`, sub-sessions and `DONE` cannot accidentally create a mutating bypass.

## 4. Completion invariant

The gate must verify:

```text
requirements
    ↓
implementation
    ↓
evidence
    ↓
verification
    ↓
completion
```

Completion without valid evidence must fail.

Evidence belonging to another task must not satisfy the requirement.

## 5. Audit contract

The production gate should execute deterministic audit-contract tests.

It should verify:

* invalid config fails;
* missing config fails;
* invalid baseline fails;
* missing baseline fails;
* regression has the expected regression status.

The heuristic quality of the audit classification is not a release gate.

## 6. Continuation invariant

A verified continuation path should not unnecessarily rebuild expensive context.

The gate should measure observable operations rather than rely solely on elapsed wall-clock time.

Preferred assertions include:

```text
continuation
→ no full context rebuild
→ no unnecessary registry scan
→ task state read remains bounded
```

A benchmark may additionally record elapsed time, but timing alone should not determine correctness.

## 7. Gate composition

The release gate should fail fast on deterministic invariant violations.

Suggested output:

```text
[PASS] package integrity
[PASS] plugin load
[PASS] governance
[PASS] completion/evidence
[PASS] cognition lifecycle
[PASS] task isolation
[PASS] strategy capabilities
[PASS] audit contract
[PASS] continuation invariant

PRODUCTION GATE: PASS
```

Failure should identify the exact layer.

## 8. Heuristic audit separation

`wam-audit` may continue producing classifications such as:

```text
NO_STRATEGY
DIVERGENT
LOOPED_NO_PROGRESS
AMBIGUOUS
FALSE_SUCCESS
```

These remain behavioral diagnostics.

They MUST NOT be treated as deterministic release failures unless a separate documented threshold contract exists.

This keeps release correctness independent from heuristic interpretation.
