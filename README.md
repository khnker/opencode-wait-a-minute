# Wait a Minute

Cognitive pre-flight and execution control for OpenCode agents.

Wait a Minute (WAM) helps agents understand before they act: it classifies the
task, loads only the relevant context, tracks verified progress, and requires
evidence before a task can be reported as done.

## What do I gain from using WAM?

- **Less guessing** — decisions are grounded instead of silently invented
- **Less lost work** — verified progress prevents rework
- **Fewer unsupported "Done" claims** — completion requires evidence
- **Less unnecessary context** — only relevant context is loaded
- **Task isolation** — terminal tasks do not leak state into new ones
- **Relevant skill loading** — skills are selected from task evidence

Each claim is backed by implementation, tests, and evidence:

1. [Less Guessing](docs/claims/less-guessing.md)
2. [Less Lost Work](docs/claims/task-state.md)
3. [Fewer Unsupported Done Claims](docs/claims/verification.md)
4. [Less Unnecessary Context](docs/claims/context-management.md)
5. [Task Isolation](docs/claims/task-isolation.md)
6. [Relevant Skill Loading](docs/claims/skill-selection.md)

## What changes after installing WAM?

- WAM runs as a prompt hook before skill resolution
- Task classification becomes explicit
- Skill selection is evidence-based
- Completion requires verification

## Installation

```bash
npm install wait-a-minute
```

## Evidence

Each claim is labeled with its evidence class:

| Claim | Evidence class | Reference |
| --- | --- | --- |
| Less Guessing | Design target | [less-guessing.md](docs/claims/less-guessing.md) |
| Less Lost Work | Measured | [task-state.md](docs/claims/task-state.md) |
| Fewer Unsupported Done Claims | Measured | [verification.md](docs/claims/verification.md) |
| Less Unnecessary Context | Measured | [context-management.md](docs/claims/context-management.md) |
| Task Isolation | Measured | [task-isolation.md](docs/claims/task-isolation.md) |
| Relevant Skill Loading | Design target | [skill-selection.md](docs/claims/skill-selection.md) |

- **Measured** — verified by the deterministic harness exercised in the release gate (snapshot equivalence, isolation E2E, completion-gate tests).
- **Estimated** — empirical real-harness numbers only; see [results.md](docs/benchmarks/results.md).
- **Design target** — mechanism implemented and unit-tested, outcome not yet benchmarked.

Measured and estimated claims are never mixed. For the underlying numbers see:

- [Claims index](docs/claims/README.md) — each claim with implementation and test references
- [Benchmark methodology](docs/benchmarks/methodology.md) — how evidence is collected
- [Benchmark results](docs/benchmarks/results.md) — measured numbers
- [Benchmark limitations](docs/benchmarks/limitations.md) — what the numbers do and do not show

## How WAM works

See [docs/architecture/overview.md](docs/architecture/overview.md) for the
architectural overview and [docs/architecture/](docs/architecture/) for
ownership, persistence, runtime, and invariants.

## Configuration

See [docs/development/](docs/development/) for development and configuration
guides.

## Commands

See [package.json](package.json) for available npm scripts. The two primary
entry points are:

- `npm run gate` — reproducible release gate (no external provider required)
- `npm run rc1` — full local RC1 validation (adds real benchmark + evidence)

## Limitations

Each claim documents its own limits; see the
[claims index](docs/claims/README.md). Benchmark-specific limits are collected
in [docs/benchmarks/limitations.md](docs/benchmarks/limitations.md).

## Compatibility

- OpenCode ≥ 1.18.0 (tested on 1.18.33)
- Node.js ≥ 20

## More detail

- Lifecycle and task state — [docs/architecture/task-lifecycle.md](docs/architecture/task-lifecycle.md)
- Context packs and selection — [docs/architecture/context-selection.md](docs/architecture/context-selection.md)
- Token savings and benchmarks — [docs/benchmarks/results.md](docs/benchmarks/results.md)
- Release record — [docs/releases/RC1.md](docs/releases/RC1.md)

## Development

See [docs/development/contributing.md](docs/development/contributing.md) and
[docs/development/testing.md](docs/development/testing.md).
