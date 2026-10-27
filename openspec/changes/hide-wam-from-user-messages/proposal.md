# Hide WAM Messages from User Chat Window

## Why

WAM currently injects `[wam]` notices, prompts, and status updates directly into user-facing message parts during regular conversation turns. This pollutes the user chat window with operational messages that should remain hidden from the user and only be shown in developer logs, system context, or the final summary.

## What Changes

- Modify `emitTextPart` or message injection handling so that WAM operational notices, contract prompts, and status headers are routed to system context or developer logs rather than polluting the user's visible chat parts.
- Ensure user-facing chat output remains clean of `[wam]` conversational interruptions while preserving full state tracking, task lifecycle governance, and final completion summaries.

## Non-Goals

- Does not disable WAM state tracking, task inference, or completion validation gates.
