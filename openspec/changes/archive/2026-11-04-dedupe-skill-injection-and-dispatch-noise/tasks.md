# Tasks: Dedupe skill injection and quiet dispatch noise

- [x] 1. Accept `injectedSkills` in `assembleContext` and emit `[wam N3 skill-ref]`.
- [x] 2. Keep a per-session injected-skill set in `handleMessage`.
- [x] 3. Apply `minSkillScore` (default 4) to on-demand candidates.
- [x] 4. Skip prompt-slug task ids for subagent sessions.
- [x] 5. Add assembly test for the ref line and engine test for the threshold.
- [x] 6. Run affected suites, `npm run build`, and `openspec validate --changes --strict`.
