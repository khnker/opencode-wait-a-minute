# Proposal: Add structured contract extraction

## Why

synthesizeContract splits prose and produces unverifiable requirements. The contract needs objective, deliverables, constraints, non-goals and acceptance criteria before requirements are derived.

## What changes

- Contract schema: objective, deliverables[], constraints[], nonGoals[], acceptance[{criterion,evidence}].
- Requirements are derived only from deliverables; prose sentences are not requirements.
- Deterministic extraction: action verb + object, explicit file/module/endpoint references, constraints (do not, only, must), non-goals (not, outside scope).
- If no deliverable is found, return zero requirements and mark the contract NEEDS_CLARIFICATION instead of inventing requirements.
- Research: JSON-schema/structured-output contracts; rejected an LLM-only extractor and kept a deterministic fallback.
