# Tasks

## 1. Implement and Wire Model Guard

- [x] 1.1 Create `src/skills/subagent-model-availability.js` to resolve models from router/preset config.
- [x] 1.2 Wire validation into `src/skills/subagent-execution.js` pre-dispatch. (Fulfilling via guardAction integration)
- [x] 1.3 Wire guard gate into `src/execution/execution-engine.js:120`. (Fulfilling via guardAction integration)
- [x] 1.4 Implement `src/skills/subagent-model-availability.test.mjs` to test available / fallback / none / depth-limit scenarios. Run with `node --test src/skills/subagent-model-availability.test.mjs`.
