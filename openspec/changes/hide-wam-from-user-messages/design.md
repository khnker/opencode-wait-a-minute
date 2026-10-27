# Design: Hide WAM Messages from User Chat Window

## Architecture & Seams

- **Message Injection Seam (`emitTextPart`)**: Currently appends or prepends synthetic parts with text starting with `[wam]` directly to `output.parts` or `output.message.parts`.
- **System vs User Separation**: Operational notices, contract prompts, and phase updates should be placed into system/metadata streams or hidden context rather than visible chat message parts (`output.parts` of type `text` visible to the end user).
- **Final Summary Exception**: Completion summaries and explicit audit logs requested by the user can still be rendered in final output summaries.

## Data Flow & Invariants

1. When WAM evaluates a message or state transition, it generates operational guidance.
2. Instead of prepending visible `[wam]` text to `output.parts`, route them to system prompt injection (`output.system` or model-only context) or keep them in internal telemetry/logs.
3. User chat window receives only assistant responses and final summaries.
