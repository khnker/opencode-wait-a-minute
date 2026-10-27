# Design: WAM Comprehension and Alignment Fixes

## Architecture & Components
1. **Context Retention (`src/integration/message-handler.js`)**: Preserve full conversational history across state transitions to avoid dropping messages or intent.
2. **Pragmatic Alignment (`src/cognition/task-inference-engine.js`)**: Validate user intent against inferred goals before committing to task execution.
3. **Stage Recognition (`src/integration/orchestration.js`)**: Ensure deterministic stage loading and strict confirmation checkpoints.
