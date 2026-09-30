# Design: Harden WAM Audit Gate Contract

## 1. Input semantics

Explicit command-line inputs are authoritative.

### `--config`

When supplied:

* file must exist;
* file must be readable;
* file must contain valid JSON;
* parsed configuration must satisfy the expected schema.

Failure must terminate the command with a non-zero command-error exit code.

The implementation must not silently replace an invalid explicit configuration with defaults.

### `--baseline`

When supplied:

* file must exist;
* file must be readable;
* file must contain valid JSON;
* parsed baseline must contain the expected audit metrics.

Failure must terminate the command with a non-zero command-error exit code.

An absent `--baseline` means that no historical comparison is requested.

## 2. Gate evaluation

Gate evaluation is independent from whether the caller explicitly supplied `--gate`.

The audit result should contain the calculated gate result whenever a gate configuration is available.

Therefore:

```text
wam-audit
wam-audit --gate
wam-audit --baseline baseline.json
wam-audit --gate --baseline baseline.json
```

must all have deterministic semantics.

The difference is whether the command should enforce the gate exit status.

Recommended model:

```text
audit metrics
    ↓
gate evaluation
    ├── threshold result
    └── baseline regression result
```

The JSON output represents the evaluation.

CLI enforcement determines the process exit code.

## 3. Exit codes

Use distinct meanings:

```text
0 = audit executed successfully and gate passed
2 = audit executed successfully but gate failed
non-zero other than 2 = command/input/runtime error
```

A regression is therefore not treated as a malformed command.

Examples:

```text
invalid config       → command error
missing baseline     → command error
valid audit, no gate → 0
valid audit, gate pass → 0
valid audit, gate regression → 2
```

## 4. Baseline comparison

Baseline comparison must occur only after successful baseline parsing.

The comparison must never mutate the baseline.

The output should identify:

* current metrics;
* baseline metrics;
* detected regressions;
* threshold violations;
* final gate result.

## 5. Tests

Add tests for:

* missing explicit config;
* invalid JSON config;
* valid config;
* missing explicit baseline;
* invalid JSON baseline;
* valid baseline;
* baseline without `--gate`;
* gate with baseline;
* threshold failure;
* baseline regression;
* command-error versus gate-failure exit codes.

Tests must assert both JSON output and process exit code.

## 6. OpenSpec reconciliation

The existing `wam-audit-regression-gate` task list must be reconciled against the actual implementation.

Tasks are marked complete only when:

1. implementation exists;
2. automated tests cover the behavior;
3. the behavior is verified by the release gate where applicable.

The task file must not be used merely as a documentation mirror of source files.
