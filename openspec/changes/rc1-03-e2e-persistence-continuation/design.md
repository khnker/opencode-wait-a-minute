# Design: E2E Persistence / Continuation

## Approach
Persistence is central to WAM; interrupted tasks must resume without duplication or false completion.

## Scope
- Simulate: session 1 creates a task -> interrupt -> terminate process -> session 2 recovers state and continues.
- Assert NO: duplicated task, lost state, unnecessary restart, false DONE, new `.wam/tasks/*` for the same task.

## Validation Strategy
- Same task id after resume.
- No duplicate `.wam/tasks/*`.
- State preserved.
- No unnecessary rebuild.
- No false DONE.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
