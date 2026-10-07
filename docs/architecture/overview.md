# Architecture Overview

WAM is an OpenCode prompt hook. It observes prompts, reconstructs task context,
gates completion, and persists task state. It does not modify OpenCode internals.

## Component map

```mermaid
flowchart TD
    U[User Prompt] --> H[OpenCode Host]
    H --> RA[Router Adapter<br/>src/integration/router-adapter.js]
    RA --> P[Policy Pillar]
    RA --> C[Context Pillar]
    RA --> S[State Pillar]
    RA --> V[Verification Pillar]
    RA --> E[Evidence Pillar]
    RA --> K[Cognition Pillar]

    P --> PSM[Policy State Machine<br/>policy-state-machine.js]
    P --> UNC[Uncertainty / Assumptions<br/>uncertainty.js]
    P --> RSK[Risk Engine<br/>risk-engine.js]
    P --> SKR[Skill Routing<br/>skill-routing.js]

    C --> CTX[Context Selection<br/>context.js]
    C --> ASM[Assembly N0-N3<br/>assembly.js]
    C --> BUD[Budget Manager<br/>context-budget-manager.js]

    S --> TS[Task State<br/>task-state.js]
    S --> SS[State Store<br/>state-store.js]
    S --> TKS[Task Store<br/>task-store.js]
    S --> LM[Lifecycle Manager<br/>lifecycle-manager.js]
    S --> TR[Task Runs<br/>task-runs.js]

    V --> VF[Verification<br/>verification.js]
    V --> VL[Verification Lifecycle<br/>verification-lifecycle.js]
    V --> VP[Verification Policy<br/>verification-policy.js]
    V --> VC[Verification Context<br/>verification-context.js]

    E --> EV[Evidence<br/>evidence.js]
    K --> OB[Observation Engine<br/>observation-engine.js]

    SKR --> SK[Skill Engine<br/>skills/engine.js]

    SS --> WAM[(.wam/ runtime state)]
    TKS --> WAM
    TR --> WAM
```

## Layer separation

- **Runtime adapters own host interaction** (`src/integration/router-adapter.js`
  and runtime adapters).
- **Pillars must not import orchestration**; `shared` must not import domain
  pillars (see `wam-architecture-taxonomy` and
  [Invariants](invariants.md)).
- **No network in runtime skill loading**: the skill catalogue is embedded at
  build time.
- **Runtime state** (`.wam/`) is never tracked in git nor published; see
  [State Persistence](state-persistence.md).

## Related documentation

- [Task Lifecycle](task-lifecycle.md)
- [Context Selection](context-selection.md)
- [State Persistence](state-persistence.md)
- [Invariants](invariants.md)
