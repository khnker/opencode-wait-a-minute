# WAM Real LLM Experiment Protocol (RC1)

## Purpose
Define the experimental protocol for comparing WAM (Wait-a-Minute) context optimization against unoptimized Baseline execution across real Large Language Models, separating token reduction from provider-side prompt caching.

## Rules
1. **Identical Inputs:** Baseline and WAM receive identical prompts, tools, messages, fixtures, and generation parameters (temperature, max tokens, seed).
2. **No Cross-Contamination:** Baseline execution output must never be used as input for WAM execution. Both execute independently from the same scenario state.
3. **Outcome Parity:** A run is flagged as `INVALID_COMPARISON` if turn outcomes or semantic task completion do not match between Baseline and WAM. Token savings are only aggregated from verified valid comparisons.
4. **Metric Isolation:** Input token reduction and context rebuild count are primary metrics. Provider cache savings (`cached_input_tokens`) are tracked separately and never conflated with WAM algorithmic context reduction.
