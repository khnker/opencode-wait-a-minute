# Design: Reproducible Experiment Harness

## Architecture
- Baseline runner: injects full context graph per turn.
- WAM runner: uses assembly layer and continuation checks.
- Harness runner: executes both arms against the same scenario sequence.
