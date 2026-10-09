/**
 * Optional LLM-as-judge adapter for the QUALITY A/B benchmark.
 *
 * The judge is intentionally separated from `run-quality.mjs` so that:
 *   - the benchmark defaults to fully deterministic fact scoring
 *   - the judge can be swapped without touching the scoring/runner code
 *   - providers remain the only I/O surface that sees real network calls
 */

import { parseJudgeJson } from "./scoring.mjs";

/**
 * Build the chat messages that will be sent to a judge model.
 *
 * @param {{task:string, response:string, rubric:{requiredFacts:Array<string|{any:string[]}>, idealPoints:string[]}}} args
 * @returns {Array<{role:string, content:string}>}
 */
export function buildJudgeMessages({ task, response, rubric }) {
  const requiredFacts = Array.isArray(rubric?.requiredFacts) ? rubric.requiredFacts : [];
  const idealPoints = Array.isArray(rubric?.idealPoints) ? rubric.idealPoints : [];
  const factsText = requiredFacts
    .map((fact, i) => {
      if (typeof fact === "string") return `${i + 1}. ${fact}`;
      if (fact && Array.isArray(fact.any)) return `${i + 1}. ANY OF: ${fact.any.join(" | ")}`;
      return `${i + 1}. (invalid fact)`;
    })
    .join("\n");
  const pointsText = idealPoints.map((p, i) => `${i + 1}. ${p}`).join("\n");

  const system = `You are an impartial evaluator. You will be given a task, a response, and a rubric. Score the response from 0 to 100 based on factual coverage and quality. Respond with ONLY a JSON object (no prose, no code fences) of the form {"score": <integer 0-100>, "pass": <boolean>, "reason": "<one short sentence>"}.

Rules:
- "pass" should be true when the score is >= 50, false otherwise.
- "reason" must be a single concise sentence (under 200 chars).
- "score" must be an integer 0..100.
- Judge ONLY factual coverage and correctness. Ignore verbosity, length, formatting, markdown, and any chain-of-thought or reasoning text. A terse answer that contains the required facts scores the same as a verbose one that contains them.
- Do not include any text outside the JSON object.`;

  const user = `TASK:
${task}

RUBRIC — required facts (the response should contain these tokens/substrings):
${factsText || "(none)"}

RUBRIC — ideal points (qualitative criteria):
${pointsText || "(none)"}

RESPONSE TO EVALUATE:
"""
${response}
"""

Reply with ONLY the JSON object.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user }
  ];
}

/**
 * Ask the judge provider to grade `response` against `rubric`.
 *
 * @param {{provider:Object, task:string, response:string, rubric:Object}} args
 * @returns {Promise<{score:number|null, pass:boolean, reason:string, raw:string}>}
 */
export async function judgeResponse({ provider, task, response, rubric }) {
  const messages = buildJudgeMessages({ task, response, rubric });
  if (!provider || typeof provider.complete !== "function") {
    return { score: null, pass: false, reason: "no_provider", raw: "" };
  }
  const result = await provider.complete({ messages });
  const raw = typeof result?.text === "string" ? result.text : "";
  const parsed = parseJudgeJson(raw);
  if (!parsed) {
    return { score: null, pass: false, reason: "unparseable", raw };
  }
  return { score: parsed.score, pass: parsed.pass, reason: parsed.reason, raw };
}
