# Prompt Quality Benchmark

Deterministic evaluation of prompt artifacts.

## Usage
- `npm run prompts:eval -- --suite core --label baseline`
- `npm run prompts:compare -- --baseline <id> --candidate <id>`
- `npm run prompts:report -- --run <id>`

## Determinism Contract
Serialized run cores are byte-identical across repeats.
No timestamps or durations in `run.json` or `report.json`.

## Adding Scenarios
Add a JSON file to `benchmarks/quality/prompt-eval/suites/` following the `wam.prompt-eval.suite/1` schema.
