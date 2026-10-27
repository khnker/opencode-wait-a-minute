# Proposal: Add conversation memory and entity recall

## Why

Long sessions re-ask the same questions and lose entities (files, paths, decisions) across turns.

## What changes

- Rolling summary + entity table (files, paths, decisions, open questions).
- Retrieve entities by relevance, not by raw transcript.
- Compact on turn threshold; keep a hard cap.
- Research: Letta/MemGPT memory blocks and archival memory; rejected a full memory OS and kept a bounded file-based memory.
