# Proposal: Fix WAM Prompt Extraction and Hook Observability

## Why
`extractPrompt` currently only reads from `input.message.parts` or `input.parts`, but some OpenCode runtime payloads supply user messages in `output.message.parts` or `output.parts`. Furthermore, active task reads (`readActiveTaskIdFresh`) were not passing session and project ownership options, allowing potential task bleeding across sessions.

## What Changes
1. **Robust Prompt Extraction**: Extend `extractPrompt` to inspect `output.message.parts` and `output.parts` (while safely excluding WAM synthetic markers) to guarantee prompt capture across OpenCode payload variants.
2. **Session-Bound Active Task Resolution**: Pass `sessionId` and `projectRoot` options into `readActiveTaskIdFresh` within `effectiveTaskId` and message handlers to ensure strict session/project ownership validation.
3. **Observability & Diagnostics**: Ensure insertion outcomes and extraction steps are logged clearly.
