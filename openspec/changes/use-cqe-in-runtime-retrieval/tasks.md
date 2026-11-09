# Tasks: Use CQE in the runtime retrieval path

## Implementation

- [x] Remove the intent gate from `selectContextWithCqe`.
- [x] Run the CQE augmentation in `message-handler` for every non-disabled turn.
- [x] Remove the unused `detectFileSearchIntent` helper and wiring.
- [x] Update the README CQE behavior statement.

## Tests

- [x] Non-search prompt augments the package with CQE file context.
- [x] `disableCqe` still suppresses CQE.
- [x] Runtime increments `cqeCalls` for a non-search prompt.
- [x] Existing CQE and message-handler suites pass.

## Validation

- [x] `node --test --test-force-exit` on affected suites.
- [x] `npm run build`.
- [x] `openspec validate --changes --strict`.
- [x] `npm run verify:web` (11/11 checks).
- [x] Isolated fresh `opencode web` probe: non-search prompt persists `cqeCalls=1`, `cqeStats.ok=1`.
