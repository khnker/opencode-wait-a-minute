# Tasks: provider-safe WAM part provenance

- [x] 1. Add `wamMetadata()` and namespace `tagWamPart` metadata under `wam`.
- [x] 2. Update `isWamSynthetic` and `hasWamMarkerFor` to the nested shape.
- [x] 3. Update `src/execution/task-loop.js` to use `wamMetadata()`.
- [x] 4. Update tests asserting the old flat metadata.
- [x] 5. Add regression test: every top-level `metadata` value is a JSON object.
- [x] 6. Run affected suites, `openspec validate --changes --strict`, `npm run build`.
- [x] 7. Fresh-session `opencode web` verification (`npm run verify:web` + targeted two-turn check).
