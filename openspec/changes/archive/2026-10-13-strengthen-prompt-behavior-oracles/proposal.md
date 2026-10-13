# Proposal: strengthen-prompt-behavior-oracles

## Why

`deterministic.mjs` decides each criterion by substring-matching the literal
`check` text. But the suite `check` values are natural-language descriptions
("must identify the specific checks that are missing…"), so a real answer only
passes by echoing that sentence, while a genuinely compliant answer phrased
differently fails. This cannot distinguish complying from restating the rule.

## What Changes

- Replace literal phrase matching with **structured, observable oracles**:
  `includes-all`, `includes-any`, `excludes-any`, `matches` (regex), and
  `not-matches` (regex). Each oracle is deterministic and offline.
- Move human intent from `check` into a non-evaluated `description` field, so
  repeating the rule text is never sufficient to pass.
- Update criterion schema validation to require a well-formed oracle.
- Rewrite the shipped suite criteria (`verify`, `scope`, `simplify`,
  `delegation`) to observable oracles instead of prose fragments.
- Add adversarial fixtures/tests: a correct answer with different wording must
  pass; an answer that restates the rule without the observable evidence must
  fail; insufficient evidence must be not-evaluable.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `prompt-quality-benchmark`: criteria are evaluated by structured observable
  oracles (with a non-evaluated human description), not by literal matching of
  rule prose.

## Impact

- Code: `benchmarks/quality/prompt-eval/{schema,deterministic}.mjs`, the four
  `suites/*.json`, `outputs/*` fixtures, and the evaluator tests.
- No new dependencies, no network, no LLM judge. No second catalog or gate.
- Prompt content (`prompts/**`) is unchanged.
