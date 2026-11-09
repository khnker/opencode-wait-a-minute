# Proposal: Use CQE in the runtime retrieval path

## Why

The CQE adapter (`src/context/cqe-adapter.js`) is enabled by default, but the
runtime only calls it when `detectFileSearchIntent(promptText)` is true. That
detector is a small keyword regex (`find|search|grep|...|archivo|codigo`), so
ordinary analysis/implementation prompts never reach CQE and always fall back to
capsule/native retrieval. In practice WAM reports `mode: enabled` while CQE is
never exercised for most turns.

## What Changes

- `selectContextWithCqe` consults CQE whenever CQE is not explicitly disabled,
  instead of only for file-search-intent prompts.
- `message-handler` runs the CQE augmentation for every non-trivial turn when
  `cfg.disableCqe` is false, instead of behind `detectFileSearchIntent`.
- Remove the now-unused `detectFileSearchIntent` helper and its wiring in
  `index.js` / `selection.js` / `message-handler` deps.
- Update the README statement that described CQE as file-search-only.
- Add regression tests proving a non-search prompt retrieves CQE file context
  and that `disableCqe` still opts out.

## Out of Scope

- Changing CQE ranking, indexing, worker isolation or timeout behavior.
- Changing `/wam ctx get` capsule-first precedence (see
  `fix-wam-ctx-get-cqe-retrieval`).
- Making `assembleContext` async or changing the synchronous `selectContext`
  contract.
