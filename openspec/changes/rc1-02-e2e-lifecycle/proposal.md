# Change: Full E2E Lifecycle

## Why
Loading the plugin is insufficient; the full lifecycle must be asserted.

## What Changes
- Cover: prompt -> task detection -> assessment -> context pack -> contract -> action -> observation -> evidence -> verification -> completion gate -> done.
- Assert: task created, task identified correctly, state persisted, context selected, completion gate executed, evidence recorded, task finished, final state consistent.

## Non-goals
- Asserting only that the plugin loaded.

## Expected Result
Each lifecycle stage is observable and asserted in the E2E run.

## Validation
- [ ] Task created and correctly identified.
- [ ] State persisted.
- [ ] Context selected.
- [ ] Completion gate executed.
- [ ] Evidence recorded.
- [ ] Task finished with consistent final state.

## Program
- RC1 item: RC1-02 (C)
- Priority: P0
