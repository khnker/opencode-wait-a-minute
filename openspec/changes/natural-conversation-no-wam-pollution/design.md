# Design: Natural Conversation and Zero WAM Pollution

## Architecture & Seams

- **`emitTextPart` function**: Already overridden to log internally rather than injecting visible `[wam]` text into user chat parts (`output.parts`).
- **Notice & Header suppression**: Review prompts and status handlers in `message-handler.js` and `index.js` to avoid prepending repetitive notice headers to chat outputs.
- **Silent operation**: WAM operates as a background supervisor rather than an intrusive chat interlocutor.
