export const REAL_SCENARIOS = [
  {
    id: "S7",
    description: "Multi-turn, 3 turns",
    turns: [
      { prompt: "Turn 1: init", input: { taskState: { status: "start" }, artifacts: [{ content: "artifact1" }] } },
      { prompt: "Turn 2: step", input: { taskState: { status: "running" }, artifacts: [{ content: "artifact1" }, { content: "artifact2" }] } },
      { prompt: "Turn 3: done", input: { taskState: { status: "finished" }, artifacts: [{ content: "artifact1" }, { content: "artifact2" }, { content: "artifact3" }] } }
    ]
  },
  {
    id: "S8",
    description: "Single-turn rich context",
    turns: [
      { prompt: "Turn 1", input: { taskState: { id: "t1" }, decisions: [{ content: "Decide A" }], constraints: [{ content: "No B" }] } }
    ]
  },
  {
    id: "S9",
    description: "Continuation forcing rebuild",
    turns: [
      { prompt: "Turn 1", input: { taskState: { id: "t2", ver: 1 } } },
      { prompt: "Turn 2", input: { taskState: { id: "t2", ver: 2 } } }
    ]
  }
];

export function getRealScenario(id) {
  return REAL_SCENARIOS.find((s) => s.id === id) || null;
}
