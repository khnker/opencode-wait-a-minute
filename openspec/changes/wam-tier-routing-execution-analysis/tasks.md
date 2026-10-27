# Tasks: WAM tier routing for execution vs analysis agents

- [x] 1. Map `backend-exec`, `frontend-exec`, `debugger` to `fast` in `SUBAGENT_TIER_MAP`.
- [x] 2. Keep `planner` and `arch-review` on `medium`.
- [x] 3. Update tier-escalation unit tests to the new mapping.
- [x] 4. Add regression tests for execution→fast and analysis→medium dispatch.
- [x] 5. Add escalation test: `backend-exec` fast → medium after 2 failures.
- [x] 6. `npm run build` and load-check `dist/src/skills/subagent-model-availability.js`.
