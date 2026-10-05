# Change: E2E Persistence / Continuation

## Why
Persistence is central to WAM; interrupted tasks must resume without duplication or false completion.

## What Changes
- Simulate: session 1 creates a task -> interrupt -> terminate process -> session 2 recovers state and continues.
- Assert NO: duplicated task, lost state, unnecessary restart, false DONE, new `.wam/tasks/*` for the same task.

## Non-goals
- Treating interruption as a fresh task.

## Expected Result
A task interrupted mid-flight resumes in a new session with identical identity and preserved state.

## Validation
- [ ] Same task id after resume.
- [ ] No duplicate `.wam/tasks/*`.
- [ ] State preserved.
- [ ] No unnecessary rebuild.
- [ ] No false DONE.

## Program
- RC1 item: RC1-03 (C)
- Priority: P0
