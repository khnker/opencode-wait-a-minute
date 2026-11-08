# Proposal: Improve skill routing with IDF and outcome feedback

## Why

Skill routing is lexical and does not learn from outcomes; ubiquitous terms and duplicate capabilities still select irrelevant skills.

## What changes

- Weight keywords with IDF over the skill registry to penalize ubiquitous terms.
- Deduplicate by capability and cap skills per lane (3 conversation, 5 task, 8 strict).
- Record skill outcomes in .wam/skills/outcomes.json and apply a small success bonus / failure penalty.
- Research: BM25/IDF, MMR diversification and learning-to-rank; rejected an online bandit because the outcome volume is too low.
