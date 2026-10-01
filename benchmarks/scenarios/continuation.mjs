/**
 * Empirical continuation scenarios used by Block 06 of the RC1 evidence plan.
 *
 * Each scenario is a sequence of identical turns that share the same
 * `taskId` and `taskState` so that, after the first turn, the snapshot
 * check returns VALID and the WAM arm can fast-path.
 *
 * - `id`:          `continuation-${n}` (matches the prefix matched by
 *                  `compareRuns` for break-even aggregation).
 * - `family` /
 *   `category`:    `"continuation"` so the report can group them.
 * - `turns`:       array of length `n`; each entry has the SAME
 *                  `taskId`/`objective` and an identical `taskState`,
 *                  which is what enables the fast-path after turn 0.
 */
export const CONTINUATION_SIZES = [1, 3, 5, 10];

const CONTINUATION_TASK_STATE = Object.freeze({
  phase: "PROPOSED",
  contract: { status: "DRAFT", requirements: [] },
  requirements: [],
  nextAction: null
});

export function buildContinuationScenarios(sizes = CONTINUATION_SIZES) {
  return sizes.map((n) => {
    const id = `continuation-${n}`;
    const turns = Array.from({ length: n }, (_, i) => ({
      prompt: `Continuation turn ${i + 1}/${n}`,
      input: {
        taskId: id,
        objective: id,
        taskState: CONTINUATION_TASK_STATE
      }
    }));
    return {
      id,
      family: "continuation",
      category: "continuation",
      name: `Continuation × ${n}`,
      description:
        `Empirical continuation workload: ${n} identical turns sharing the same ` +
        `taskId/taskState so the WAM arm can fast-path after turn 0.`,
      budget: { maxTokens: 64 },
      turns
    };
  });
}

export function getContinuationScenario(id) {
  return buildContinuationScenarios().find((s) => s.id === id) ?? null;
}
