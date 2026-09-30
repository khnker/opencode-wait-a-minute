# Proposal: Enforce Runtime Task Isolation

## Problem

WAM maintains persistent task state while also supporting sessions, task switching and sub-sessions.

This creates a class of potential correctness failures where state, authorization or completion evidence from one task can accidentally influence another task.

The most dangerous case is not a simple state read failure. It is cross-task authorization:

```text
Task A
  APPROVED
      ↓
Task B
  mutating action
      ↓
Task A authorization accidentally reused
```

WAM's governance model requires the current task to be the unit of authorization and evidence.

## Goal

Make task identity explicit throughout runtime decisions.

A runtime action must be evaluated against the current task and session scope rather than ambient or stale state.

## Scope

This change covers:

* runtime task identity;
* session/task association;
* sub-session inheritance;
* authorization checks;
* task switching;
* state access;
* cross-task isolation tests.

## Non-goals

* Replacing the existing cognition store.
* Introducing distributed locking.
* Redesigning task persistence.
* Changing strategy semantics.

## Expected result

A state transition, authorization, completion record or mutating action from one task cannot be reused implicitly by another task.
