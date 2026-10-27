# Proposal: Add intent and context evaluation metrics

## Why

There is no offline metric for intent accuracy, clarification rate, contract acceptance or context quality; changes cannot be compared.

## What changes

- Offline metrics: intent accuracy, clarification rate, contract acceptance, false completion, context precision/recall, token cost.
- Use deterministic scenario fixtures first; optional LLM-as-judge later.
- Reuse benchmarks/evaluation and benchmarks/quality harnesses.
- Research: RAGAS (context precision/recall, faithfulness, answer relevancy); rejected LLM-judge as a hard gate due to cost.
