# Design: Runtime Task Isolation

## 1. Runtime scope

Runtime operations should resolve an explicit scope:

```text
RuntimeScope
├── sessionId
├── taskId
├── parentSessionId?
└── parentTaskId?
```

The scope represents the identity against which runtime state and governance decisions are evaluated.

The implementation does not require a new persistent store.

The scope can be constructed from the existing runtime/session/task model.

## 2. Task identity

Every operation that can:

* mutate repository state;
* modify task state;
* record evidence;
* transition cognition;
* mark completion;
* invoke a governed tool;

MUST resolve a current task identity.

If no task identity can be resolved, the operation must fail closed where governance requires task ownership.

## 3. Authorization binding

Authorization MUST be bound to:

```text
sessionId + taskId
```

rather than merely to:

```text
sessionId
```

or ambient global state.

An approval from Task A cannot authorize a mutation belonging to Task B.

## 4. Task switching

When the active task changes:

```text
Task A → Task B
```

the runtime MUST resolve:

* B's cognition state;
* B's requirements;
* B's evidence;
* B's governance state;
* B's strategy context.

A cached authorization from A MUST NOT remain applicable to B.

## 5. Sub-sessions

A sub-session may inherit authorization only through explicit parent/child scope.

Inheritance must identify:

```text
parentSessionId
parentTaskId
childSessionId
childTaskId
```

A sub-session MUST NOT be treated as a generic bypass around task governance.

The child may inherit capabilities explicitly allowed by the parent policy, but the child's current task remains authoritative for task-specific evidence and completion.

## 6. State isolation

Task state access MUST be keyed by task identity.

The implementation must avoid using a mutable global `activeTask` as the sole authority for persistent state selection.

Ambient state may be used as a convenience for discovery, but not as the final authorization boundary.

## 7. Concurrency

Tests must model interleaved operations:

```text
A read
B read
A write
B write
A verify
B verify
```

The expected result is that each operation observes and mutates only its own task scope.

## 8. Failure behavior

When scope is ambiguous:

```text
unknown task
stale task
mismatched session/task
missing authorization
```

the runtime MUST fail closed for governed mutating operations.

It MAY continue for explicitly read-only diagnostic operations where no task mutation or authorization is involved.
