# Design: Subagent-Driven Skills
## Strategy
execution:
  strategy: subagent | direct | parallel
## Fan-out / fan-in
TASK -> { Agent A, Agent B, Agent C } -> synthesis -> verify
## Subagent output (structured, not free text)
CLAIM | ACTION | OBSERVATION | EVIDENCE
## Scope
Each subagent receives an explicit scope (files, paths, questions); out-of-scope work is
rejected or ignored.
## Evidence attribution
Every evidence item carries the producing subagent id.
## Synthesis rule
Synthesis may merge and rank evidence; it MUST NOT promote "no evidence" to "evidenced".
A missing subagent result stays MISSING in the synthesis.
## Partial errors
A failed subagent is recorded with its error; the workflow decides retry/fallback.
