# Design: Full E2E Lifecycle

## Approach
Loading the plugin is insufficient; the full lifecycle must be asserted.

## Scope
- Cover: prompt -> task detection -> assessment -> context pack -> contract -> action -> observation -> evidence -> verification -> completion gate -> done.
- Assert: task created, task identified correctly, state persisted, context selected, completion gate executed, evidence recorded, task finished, final state consistent.

## Validation Strategy
- Task created and correctly identified.
- State persisted.
- Context selected.
- Completion gate executed.
- Evidence recorded.
- Task finished with consistent final state.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
