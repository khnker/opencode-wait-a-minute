# Design: WAM Conversation Friction Analysis

## Architecture & Flow
- **State & Session Robustness**: Guard against invalid base paths (`/dev/null`) when initializing `.wam/traces` and storage.
- **Friction Reduction**: Streamline task state transitions to avoid redundant session re-creations and command repetitions.
- **Provider Fallback**: Gracefully handle model provider resolution failures without crashing or blocking execution loops.
