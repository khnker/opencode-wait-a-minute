# Tasks — WAM injection block

## 1. Implementation

- [x] Add `WAM_BLOCK_START` / `WAM_BLOCK_END` and idempotent `wrapWamBlock` in
      `src/integration/message-handler.js`.
- [x] Add `contextInject` bucket and route pack, coupling and cqe file-context
      lines into it.
- [x] Assemble `[...contextInject, ...inject, ...budgetedAux]`, wrap it once and
      emit it after `presentValidation` so it lands at `parts[0]`.
- [x] Make `emitTextPart` in `index.js` skip the `[wam] ` prefix when the text
      already starts with `[wam]`.

## 2. Tests

- [x] Add regression test in `test/message-handler.test.mjs` asserting
      delimiters, index 0 placement, context-before-directives ordering, last
      line `[wam][end]`, and no double prefix.

## 3. Verification

- [x] `node --test --test-force-exit test/message-handler.test.mjs`
- [x] `node --test --test-force-exit tests/unit/plugin-load.test.mjs`
- [x] `npm run build`
