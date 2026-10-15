# Design: Fix WAM Prompt Extraction and Hook Observability

## Architecture
- **Prompt Extraction (`extractPrompt`)**:
  - Primary sink sources: `input?.message?.parts || input?.parts || output?.message?.parts || output?.parts || []`.
  - Non-synthetic filtering (`!isWamSynthetic(p)`) prevents self-consumption re-entrancy loops.
- **Active Task Ownership (`effectiveTaskId`)**:
  - `readActiveTaskIdFresh(wamRoot, { sessionId: input?.sessionID, projectRoot: wamRoot })` ensures tasks created in one session are never adopted by another.
