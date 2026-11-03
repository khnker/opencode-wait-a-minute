# Change: Repair pre-existing suite baseline

## Objective

Restore a green full-suite baseline by fixing the three failures that pre-date this
change, each at its root cause rather than by weakening assertions:

1. Stale prompt-eval baselines: `benchmarks/quality/prompt-eval/baselines/core.json` and
   `delegation.json` still pin the pre-update `injection.delegation` hash.
2. `task` is catalogued as GUARDED but silently downgraded to SAFE because it is also
   listed in `OUT_OF_SCOPE_TOOLS`, contradicting the autonomy-runtime spec.
3. `tests/zero-friction-injection.test.mjs` still asserts the removed `PERMITIDA`
   wording instead of the current advisory phrasing.

## Scope

In scope:
- Regenerate prompt-eval baselines with the repo freezer.
- Remove `"task"` from `OUT_OF_SCOPE_TOOLS`, keeping the delegation meta-tools
  (`compress`, `delegate_task`, `call_agent`, `skill`) out of scope.
- Align the zero-friction assertion with the current prompt text.
- Add regression coverage for the capability boundary.

Out of scope:
- Any change to runtime guard semantics or prompt content.
- Classifying `task` as SAFE, or restoring legacy prompt wording.

## Success criteria

- Targeted suites pass with `fail 0`.
- Full suite (`node scripts/run-tests.mjs`) passes with `fail 0`.
- `npm run build` and `openspec validate --changes --strict` pass.
- Baselines remain byte-for-byte reproducible and only the delegation hash changes.
