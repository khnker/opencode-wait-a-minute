# Tasks: Correction flows bypass the contract-approval gate

- [x] Add `isCorrectionFlow` and the correction bypass in `src/policy/governance-enforcement.js`.
- [x] Persist `flow: "correction"` and skip the blocking contract injection for `CORRECTION` lane in `src/integration/message-handler.js`.
- [x] Recognise Spanish correction markers in `src/quality/task-quality-contract.js`.
- [x] Add regression tests (governance + task kind).
- [x] `openspec validate --changes --strict`, `npm run build`, targeted tests.
