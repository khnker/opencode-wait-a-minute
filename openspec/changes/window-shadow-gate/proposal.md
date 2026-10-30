## Why

`comparador-precios` now emits clean shadow records (ratio 0.97, 2 live
decisions, pending requirement included) after `fix-projection-decision-relevance`,
but the promotion gate still fails: `delta` reports `max ratio 1.812`. That
maximum comes from a single record written before the fix. Because every check
is computed over the whole telemetry file, one historical defect blocks
promotion forever; the only ways out today are deleting telemetry or hand-editing
it, both of which destroy evidence.

The gate is supposed to answer "is the current projection safe to activate?",
not "was the projection ever wrong?".

## What Changes

- Evaluate `mode`, `budget`, `delta` and `selection` over a **window of the last
  N records with `projectionAvailable === true`** (default `N = --min-records`).
- Keep `parse` over the whole file: corrupt telemetry must always fail loud.
- Add `--window <n>` to override the window size; reject non-positive values.
- Report the evaluated count (`records: <total> (evaluated <n>)`).
- Keep availability counts over the whole file for visibility, but the
  `records` gate counts the evaluated window.

## Impact

- Old bad records stop blocking promotion while remaining in the file.
- No change to telemetry schema, to the shadow brief, or to injected context.
- A regression inside the window still fails the gate.
