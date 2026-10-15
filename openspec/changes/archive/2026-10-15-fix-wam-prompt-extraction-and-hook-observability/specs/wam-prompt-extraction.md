# Specification: WAM Prompt Extraction and Hook Observability

## Requirements
1. **Prompt Extraction**: `extractPrompt` must successfully extract the user prompt from input or output message parts across OpenCode runtime payload variations.
2. **Session Ownership**: Active task resolution must enforce session ID and project root validation to prevent cross-session state leakage.
3. **Re-entrancy Protection**: Synthetic WAM parts must be excluded from prompt extraction.
