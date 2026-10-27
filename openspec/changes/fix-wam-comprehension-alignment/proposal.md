# Proposal: Fix WAM Conversational Comprehension and Alignment

## Why
Analysis of `.wam` session traces across projects reveals conversational loss, pragmatic misinterpretations, goal deviations, and stage recognition failures. State updates in `selection-log.jsonl` and task engines often drop user intent when transitioning between phases (`Full` -> `Fast` -> `Partial`).

## What Changes
Implement strict conversation context retention, pragmatic alignment guardrails, and explicit stage confirmation in the WAM pipeline and core integration handlers.
