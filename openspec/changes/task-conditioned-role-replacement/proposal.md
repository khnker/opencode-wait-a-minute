# Task-Conditioned Role Replacement

Replace the generic role in the WAM context with a specialized role instruction based on the task's objective and requirements.

## Motivation
The current WAM context uses a generic role (e.g., "implementer") for all tasks. This change introduces a mechanism to dynamically select a more specialized role (e.g., "Database Performance Specialist") when the task signals a specific domain and operation, thereby improving the relevance and quality of the model's responses.

## Goals
- Improve task-specific reasoning without adding new agents or complex hierarchies.
- Maintain backward compatibility; the feature is disabled by default.
- Provide a benchmark to evaluate the impact of role specialization across the software lifecycle.

## Approach
1. Implement a pure function `selectRole` in `src/cognition/task-role-engine.js` that maps task signals to a role from a closed set.
2. Wire the role directive into the context assembly via `src/integration/message-handler.js`.
3. Create a benchmark to compare baseline, reference role, and WAM-selected role outcomes.
