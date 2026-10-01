# Proposal: Establish Reproducible Experiment Harness

Establish the baseline vs WAM experimental runner architecture to support rigorous RC1 validation without new architectural heuristics.

## Goals
1. Reproducible benchmark runner separating baseline (full context) and WAM (delta/assembly) arms.
2. Standardized scenario descriptors (local, contextual, continuation, negative-control).
3. Metric collection for token efficiency, context reduction, and task success.
