# WAM injection block

## Why

WAM injects several synthetic parts per turn (context pack, skills, directives,
delegation, history/memory). Today those fragments are emitted as separate text
parts with a bare `[wam]` prefix, they have no machine-recognizable delimiters,
and because each part is prepended to the message, the visible order ends up
reversed relative to emission order. The result: the model can lose the
intention of the turn — context and skills compete with task directives instead
of framing them, and tooling cannot reliably locate the injected region.

## What Changes

- Every WAM injection for a turn is wrapped in a single recognizable block:
  first line `[wam][start]`, last line `[wam][end]`.
- The block is assembled in a deterministic order: context pack + coupling +
  cqe file context (context/skills) → task directives (objective, inference,
  role, pending reqs, completion, delegation) → auxiliary history/memory.
- The block is emitted last so that the existing prepend semantics place it at
  index 0 of the message parts; inside the block the order is preserved.
- `emitTextPart` no longer duplicates the `[wam]` prefix when the payload is
  already a WAM block.

## Impact

- `src/integration/message-handler.js`: block wrapper, ordered buckets, single
  emission after `presentValidation`.
- `index.js`: idempotent `[wam]` prefix in `emitTextPart`.
- `test/message-handler.test.mjs`: regression test for delimiters, order,
  placement and prefix.
- No public API, persistence or config changes. Pure injection presentation and
  ordering.
