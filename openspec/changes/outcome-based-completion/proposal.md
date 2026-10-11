# Outcome-Based Completion

## Why

WAM already tracks task state, evidence, verification, and outstanding work. However, completing the requested actions does not necessarily establish that the intended outcome was achieved.

A task can pass its tests and still fail its actual objective. An agent can modify code without fixing the behavior, complete an investigation without answering its question, or produce evidence that does not support its completion claim.

WAM must treat `DONE` as an evidence-backed assertion about the achieved outcome, not as an assertion that implementation or verification steps finished.

## What Changes

- Introduce an explicit outcome contract for each task.
- Record the initial state or baseline when the outcome requires comparison.
- Define an observable target state and acceptance criteria before execution.
- Connect observations and evidence to individual acceptance criteria.
- Evaluate the achieved outcome separately from execution progress.
- Gate `DONE` on verified outcome attainment.
- Preserve provenance for evidence, measurements, and verification decisions.
- Distinguish unsuccessful outcomes from outcomes that cannot be verified.
- Add a benchmark that measures the correctness of completion decisions.

## Core Invariant

`DONE` MUST mean that the requested outcome satisfies its acceptance criteria and that sufficient, traceable evidence supports this conclusion.

Completion of actions, code changes, tests, or tool calls MUST NOT independently establish `DONE`.

## Non-Goals

- Replace WAM's existing task lifecycle or evidence engine.
- Require every task to modify source code.
- Require every task to improve performance.
- Treat every successful local improvement as a state-of-the-art improvement.
- Require live LLM calls for deterministic unit tests.
- Claim general correctness from a single benchmark or experiment.

## Expected Result

WAM can distinguish between work performed and results demonstrated. Its completion decisions become auditable, testable, and measurable against independently established ground truth.
