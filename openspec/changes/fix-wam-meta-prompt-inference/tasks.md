# Tasks: Fix meta-prompt inference

- [x] Add `isMetaOnlyPrompt` and meta patterns to `src/policy/request-classifier.js`
- [x] Return zero requirements for FAST/meta prompts in `src/skills/engine.js`
- [x] Skip the completion gate for trivial/FAST analyses in `src/integration/message-handler.js`
- [x] Add tests for the two live regressions
- [x] Rebuild dist and validate the change
