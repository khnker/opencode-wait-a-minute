# Tasks: Fix `/wam ctx get` CQE fallback

## Implementation

- [x] Add `retrieveContextWithCqe` with capsule-first, CQE/native fallback.
- [x] Export the helper from `src/context/context.js`.
- [x] Wire `/wam ctx get` to the helper and render bounded CQE/native lines.
- [x] Preserve the existing capsule output and capsule failure message.

## Tests

- [x] Add `tests/unit/ctx-get-cqe.test.mjs` for CQE fallback in a fresh project.
- [x] Add regression coverage for empty capsules plus empty CQE (no fabrication).
- [x] Run `node --test --test-force-exit tests/unit/ctx-get-cqe.test.mjs tests/unit/context.test.mjs`.
- [x] Run `npm run build`.
