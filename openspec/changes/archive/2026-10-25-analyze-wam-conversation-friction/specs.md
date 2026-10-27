# Specs: analyze-wam-conversation-friction

## Requirements
- R1: The system shall gracefully handle invalid base paths during `.wam` directory initialization to prevent ENOTDIR errors.
- R2: The system shall reduce conversational friction by preventing redundant task re-creations and simplifying contract confirmation steps for routine commands.
- R3: The system shall provide robust model provider fallback when encountering unknown or unconfigured models.
