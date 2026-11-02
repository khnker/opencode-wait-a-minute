# Design — Agent Role Contracts

## Research

- OpenCode agents and subagents, including per-agent permissions:
  https://opencode.ai/docs/agents/
- OpenCode plugin surface and `session.prompt` host API:
  https://opencode.ai/docs/plugins/
- Anthropic, "How we built our multi-agent research system" — orchestrator-worker
  design, token cost and when multi-agent is worth it:
  https://www.anthropic.com/engineering/multi-agent-research-system
- MetaGPT: structured role specifications and standardized operating procedures:
  https://arxiv.org/abs/2308.00352
- CAMEL: role-playing agent collaboration and the risk of role drift:
  https://arxiv.org/abs/2303.17760
- NIST CSRC, least privilege:
  https://csrc.nist.gov/glossary/term/least_privilege
- Existing WAM outcome criteria contract (`src/verification/outcome-evaluator.js`):
  criteria use `id`, `description` and `mandatory`.

The sources agree on three constraints: a single coordinator, explicit per-role
boundaries, and structured handoffs instead of free-form conversation. WAM
already has a compatible acceptance-criterion shape and string-based evidence
and artifact references.

## Problem

The Task Loop has one agent executing and verifying. A multi-agent design only
helps if responsibilities are separable and independently checkable. Contracts
must exist before invocation, or role behavior will be inferred accidentally
from prompts.

`task-conditioned-role-replacement` solves a different problem: it specializes
the instruction of the single agent. It is not reused here and remains as
implemented.

## Goals

- Stable role identities, responsibilities and limits.
- One provider-independent request contract and one result contract.
- Least-privilege capability matrix as declarative design data.
- Structured review outcomes with verifiable defects.
- Deterministic validation that refuses malformed or authority-expanding output.

## Non-Goals

- Host invocation, model routing, context isolation or permission enforcement.
- Proving that multi-agent beats a single agent; Change 07 measures that.

## Decisions

### D1 — On-demand invocation by WAM, not persistent OpenCode agents

Chosen: roles are WAM contracts invoked on demand; OpenCode is an execution host
behind an adapter.

Rejected: one persistent OpenCode agent per role. It couples role identity and
permissions to host configuration, duplicates rules per task and complicates a
future Plugin API V2 move.

### D2 — Provider-independent contracts

Chosen: `AgentRequest`, `AgentResult` and `ReviewResult` contain no OpenCode
types, session ids or model names.

Rejected: embedding `client.session.prompt` payloads in the contracts. It would
force every future adapter to emulate OpenCode.

### D3 — Declarative capabilities, enforcement later

Chosen: `ROLE_CAPABILITIES` declares the matrix. Change 01 exposes no
`assertRolePermission` or equivalent guard.

Rejected: implementing enforcement now. The user-facing scope is contractual;
Changes 02/03 own the adapter and isolation mechanisms that can enforce it.

### D4 — WAM owns state; agents are stateless executors

Chosen: agents return results; only WAM writes task state, approvals and
completion. Every role is declared with `modifyGlobalState: false` and
`approveCompletion: false`.

Rejected: agents updating task state or invoking each other. That creates
unbounded delegation cycles and destroys the single-coordinator invariant.

### D5 — Reviewer independence

Chosen: the Reviewer receives the original contract, approved strategy, raw diff
and original evidence, and produces its own verdict. It does not execute tests in
this iteration and does not inherit the Builder's conclusions as facts.

Rejected: reviewing the Builder's summary. It measures the narrative, not the
change.

### D6 — `ACCEPTED` is not completion

Chosen: `ACCEPTED` means the Reviewer found no defect that blocks acceptance
within the reviewed scope. It does not mean tests ran or all criteria are
verified. The Completion Gate keeps final authority.

Rejected: letting a Reviewer verdict set task completion. It would create a
second completion authority.

### D7 — Four roles now

Chosen: Analyst, Architect, Builder and Reviewer. Verifier starts as a Reviewer
responsibility; Integrator is deferred.

Rejected: six roles immediately. It multiplies token cost and coordination
surface before collaboration is validated.

### D8 — Strict top-level contracts

Chosen: request and result reject unknown top-level keys. A result containing
`done: true` or `status: "DONE"` is invalid.

Rejected: ignoring extra fields. It would let an agent smuggle completion or
authority claims past validation.

## Contract model

### AgentRequest

```text
{
  taskId, invocationId, role, objective,
  acceptanceCriteria: [{ id, description, mandatory, evidenceRequirements? }],
  input: { artifacts: string[], evidence: string[], constraints: string[],
           priorFindings: AgentFinding[] },
  expectedOutput: string[]
}
```

`ArtifactReference` and `EvidenceReference` are stable non-empty strings. This
matches the existing task model, which stores artifact paths and evidence ids or
source refs as strings.

### AgentResult

```text
{
  taskId, invocationId, role,
  status: COMPLETED | BLOCKED | NEEDS_INPUT | FAILED,
  summary,
  findings: [{ id, description, severity, evidence: string[], criterionId? }],
  decisions: [{ id, description, rationale }],
  artifacts: string[], evidence: string[],
  openQuestions: string[], recommendations: string[], limitations: string[],
  review?: ReviewResult
}
```

Recommendations are strings, not approved decisions. Findings are claims, not
evidence. `FAILED` results still require a summary and limitations.

### ReviewResult

```text
{
  verdict: ACCEPTED | REVISION_REQUIRED | REPLAN_REQUIRED | BLOCKED,
  findings: [{ criterionId?, severity, description,
               evidence: string[], correctiveAction }],
  limitations: string[]
}
```

`REVISION_REQUIRED` and `REPLAN_REQUIRED` require at least one finding. Review
findings require non-empty evidence. `ACCEPTED` requires status `COMPLETED`;
`BLOCKED` requires status `BLOCKED`. A failed Reviewer invocation may omit
`review`.

### Capability matrix

| Capability | Analyst | Architect | Builder | Reviewer |
| --- | --- | --- | --- | --- |
| `readContext` | yes | yes | yes | yes |
| `investigate` | yes | yes | yes | yes |
| `proposeDecisions` | yes | yes | no | yes |
| `modifyCode` | no | no | yes | no |
| `modifyGlobalState` | no | no | no | no |
| `approveCompletion` | no | no | no | no |

The matrix is declaration-only. No runtime guard is part of this change.

## Compatibility

- Acceptance criteria reuse the existing `id`, `description`, `mandatory` shape
  from the outcome contract, plus optional `evidenceRequirements`.
- Artifact and evidence references are strings, matching existing task artifacts
  and evidence refs.
- The result has no `phase`, `status: DONE` or completion write; it cannot move a
  task to `DONE`.

## Risks

- Declarative capabilities are not a sandbox until Changes 02/03 enforce them.
- The Reviewer cannot independently re-run tests in this iteration; Change 05 may
  add a WAM-mediated read-only test request rather than broadening permissions.
- The envelope adds tokens per invocation; Change 07 must measure the cost and
  quality trade-off.
- Strict contracts may reject useful adapter metadata; adapters should keep
  transport metadata outside `AgentRequest`/`AgentResult`.
