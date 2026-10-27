# Context Pack Evidence — Tasks

## Implementation
1. [x] `src/context/context-pack-evidence.js`: `recordContextPack({taskId, prompt, pack, root})`
2. [x] Hook in `src/integration/message-handler.js` right after `assembleContext`
3. [x] Tests: `src/context/context-pack-evidence.test.mjs`

## Verification
4. [x] `node --test --test-force-exit src/context/context-pack-evidence.test.mjs`
5. [x] `openspec validate --changes --strict`
6. [x] `npm run build`
7. [x] Archive full candidate pool
8. [x] `/wam ctx evidence [list|show <seq>]`
9. [x] Fix stale token-savings test
