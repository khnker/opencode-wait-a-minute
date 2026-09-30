const filler = (tag, i, len = 400) => `${tag}[${i}] `.padEnd(len, "context");

const requirements = (n, prefix) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}R${i}`, title: filler(`${prefix}-requirement`, i) }));
const evidence = (n, prefix, sourceTask) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}E${i}`,
    content: filler(`${prefix}-evidence`, i),
    status: "valid",
    ...(sourceTask ? { sourceTask } : {})
  }));
const decisions = (n, prefix) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}D${i}`, summary: filler(`${prefix}-decision`, i) }));
const constraints = (n, prefix) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}C${i}`, description: filler(`${prefix}-constraint`, i) }));
const artifacts = (n, prefix) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}A${i}`, content: filler(`${prefix}-artifact`, i) }));
const observations = (n, prefix) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}O${i}`, content: filler(`${prefix}-observation`, i) }));

function context({
  taskId,
  objective,
  reqs = 0,
  evs = 0,
  decs = 0,
  cons = 0,
  arts = 0,
  obs = 0,
  dependsOn,
  evidenceSource
}) {
  const prefix = `${taskId}:`;
  return {
    taskState: {
      taskId,
      contract: { objective: filler(objective, 0), ...(dependsOn ? { dependsOn } : {}) },
      requirements: requirements(reqs, prefix)
    },
    runState: {},
    evidenceLineage: evidence(evs, prefix, evidenceSource),
    decisions: decisions(decs, prefix),
    constraints: constraints(cons, prefix),
    artifacts: artifacts(arts, prefix),
    observations: observations(obs, prefix),
    hypotheses: [],
    experiments: []
  };
}

const turn = (prompt, input) => ({ prompt, input });
const deep = (n) => ({ reqs: n, evs: n, decs: n - 2, cons: n - 2, arts: n - 2, obs: n - 2 });

export const REAL_SCENARIOS = [
  // S7–S16: Real-LLM local/contextual tasks
  {
    id: "S7",
    category: "local",
    description: "Multi-turn growth: rich context, state changes each turn",
    budget: 4000,
    turns: [
      turn("Turn 1: acknowledge the task.", context({ taskId: "S7", objective: "objective-v1", ...deep(6) })),
      turn("Turn 2: apply the first change.", context({ taskId: "S7", objective: "objective-v2", ...deep(8) })),
      turn("Turn 3: apply the second change.", context({ taskId: "S7", objective: "objective-v3", ...deep(10) }))
    ]
  },
  {
    id: "S8",
    category: "local",
    description: "Single-turn rich context",
    budget: 4000,
    turns: [turn("Complete the task.", context({ taskId: "S8", objective: "objective", ...deep(8) }))]
  },
  {
    id: "S9",
    category: "local",
    description: "Requirement-heavy single turn",
    budget: 4000,
    turns: [turn("Complete the task.", context({ taskId: "S9", objective: "objective", reqs: 16, evs: 2, decs: 2 }))]
  },
  {
    id: "S10",
    category: "local",
    description: "Evidence-heavy single turn",
    budget: 4000,
    turns: [turn("Complete the task.", context({ taskId: "S10", objective: "objective", reqs: 2, evs: 16 }))]
  },
  {
    id: "S11",
    category: "local",
    description: "Decision/constraint-heavy single turn",
    budget: 4000,
    turns: [turn("Complete the task.", context({ taskId: "S11", objective: "objective", reqs: 4, evs: 4, decs: 12, cons: 12 }))]
  },
  {
    id: "S12",
    category: "local",
    description: "Artifact/observation-heavy single turn",
    budget: 4000,
    turns: [turn("Complete the task.", context({ taskId: "S12", objective: "objective", reqs: 4, evs: 4, arts: 12, obs: 12 }))]
  },
  {
    id: "S13",
    category: "local",
    description: "Mixed medium context",
    budget: 4000,
    turns: [turn("Complete the task.", context({ taskId: "S13", objective: "objective", reqs: 8, evs: 8, decs: 6, cons: 6, arts: 6, obs: 6 }))]
  },
  {
    id: "S14",
    category: "local",
    description: "Tight budget forces optional dropping",
    budget: 1500,
    turns: [turn("Complete the task.", context({ taskId: "S14", objective: "objective", ...deep(12) }))]
  },
  {
    id: "S15",
    category: "local",
    description: "Very small budget",
    budget: 500,
    turns: [turn("Complete the task.", context({ taskId: "S15", objective: "objective", ...deep(14) }))]
  },
  {
    id: "S16",
    category: "local",
    description: "Very large context, default budget",
    budget: 4000,
    turns: [turn("Complete the task.", context({ taskId: "S16", objective: "objective", ...deep(20) }))]
  },

  // S17–S21: Continuation tasks
  {
    id: "S17",
    category: "continuation",
    description: "Two identical turns -> fast path",
    budget: 4000,
    turns: (() => {
      const c = context({ taskId: "S17", objective: "objective", ...deep(6) });
      return [turn("Turn 1: load context.", c), turn("Turn 2: same context.", c)];
    })()
  },
  {
    id: "S18",
    category: "continuation",
    description: "Three identical turns -> repeated fast path",
    budget: 4000,
    turns: (() => {
      const c = context({ taskId: "S18", objective: "objective", ...deep(8) });
      return [turn("Turn 1.", c), turn("Turn 2.", c), turn("Turn 3.", c)];
    })()
  },
  {
    id: "S19",
    category: "continuation",
    description: "Changed state between turns -> reconstruction",
    budget: 4000,
    turns: [
      turn("Turn 1.", context({ taskId: "S19", objective: "objective-v1", ...deep(6) })),
      turn("Turn 2.", context({ taskId: "S19", objective: "objective-v2", ...deep(6) }))
    ]
  },
  {
    id: "S20",
    category: "continuation",
    description: "Four-turn growth",
    budget: 4000,
    turns: [
      turn("Turn 1.", context({ taskId: "S20", objective: "objective-v1", ...deep(4) })),
      turn("Turn 2.", context({ taskId: "S20", objective: "objective-v2", ...deep(6) })),
      turn("Turn 3.", context({ taskId: "S20", objective: "objective-v3", ...deep(8) })),
      turn("Turn 4.", context({ taskId: "S20", objective: "objective-v4", ...deep(10) }))
    ]
  },
  {
    id: "S21",
    category: "continuation",
    description: "Alternating identical/changed turns",
    budget: 4000,
    turns: (() => {
      const a = context({ taskId: "S21", objective: "objective-a", ...deep(6) });
      const b = context({ taskId: "S21", objective: "objective-b", ...deep(6) });
      return [turn("Turn 1.", a), turn("Turn 2.", a), turn("Turn 3.", b), turn("Turn 4.", b)];
    })()
  },

  // S22–S26: Dependency tasks
  {
    id: "S22",
    category: "dependency",
    description: "Two-task chain A -> B",
    budget: 4000,
    turns: [
      turn("Consume prerequisite A.", context({ taskId: "S22-B", objective: "objective-b", ...deep(8), dependsOn: ["S22-A"], evidenceSource: "S22-A" }))
    ]
  },
  {
    id: "S23",
    category: "dependency",
    description: "Three-task chain A -> B -> C",
    budget: 4000,
    turns: [
      turn("Consume prerequisites A and B.", context({ taskId: "S23-C", objective: "objective-c", ...deep(10), dependsOn: ["S23-A", "S23-B"], evidenceSource: "S23-A/B" }))
    ]
  },
  {
    id: "S24",
    category: "dependency",
    description: "Diamond dependency A -> (B, C) -> D",
    budget: 4000,
    turns: [
      turn("Consume B and C.", context({ taskId: "S24-D", objective: "objective-d", ...deep(12), dependsOn: ["S24-B", "S24-C"], evidenceSource: "S24-B/C" }))
    ]
  },
  {
    id: "S25",
    category: "dependency",
    description: "Fan-out A -> (B, C, D, E)",
    budget: 4000,
    turns: [
      turn("Consume four prerequisites.", context({ taskId: "S25-F", objective: "objective-f", ...deep(14), dependsOn: ["S25-B", "S25-C", "S25-D", "S25-E"], evidenceSource: "S25-B/C/D/E" }))
    ]
  },
  {
    id: "S26",
    category: "dependency",
    description: "Deep chain with growing evidence",
    budget: 4000,
    turns: (() => {
      const inputs = [];
      for (let i = 1; i <= 4; i += 1) {
        inputs.push(turn(`Consume chain step ${i}.`, context({
          taskId: `S26-${i}`,
          objective: `objective-${i}`,
          ...deep(6 + i * 2),
          dependsOn: i > 1 ? [`S26-${i - 1}`] : undefined,
          evidenceSource: i > 1 ? `S26-${i - 1}` : undefined
        })));
      }
      return inputs;
    })()
  },

  // S27–S30: Negative controls (tiny contexts where WAM overhead exceeds savings)
  {
    id: "S27",
    category: "negative",
    description: "Task only, tiny objective: WAM overhead exceeds baseline",
    budget: 4000,
    turns: [turn("Complete the task.", { taskState: { taskId: "S27", contract: { objective: "obj" } } })]
  },
  {
    id: "S28",
    category: "negative",
    description: "Empty requirements array",
    budget: 4000,
    turns: [turn("Complete the task.", { taskState: { taskId: "S28", contract: { objective: "obj" }, requirements: [] } })]
  },
  {
    id: "S29",
    category: "negative",
    description: "Single tiny requirement",
    budget: 4000,
    turns: [turn("Complete the task.", { taskState: { taskId: "S29", contract: { objective: "obj" }, requirements: [{ id: "R0", title: "x" }] } })]
  },
  {
    id: "S30",
    category: "negative",
    description: "Requirement without title/content",
    budget: 4000,
    turns: [turn("Complete the task.", { taskState: { taskId: "S30", contract: { objective: "obj" }, requirements: [{ id: "R0" }] } })]
  }
];

export function getRealScenario(id) {
  return REAL_SCENARIOS.find((s) => s.id === id) || null;
}

export function getScenarioIdsByCategory(category) {
  return REAL_SCENARIOS.filter((s) => s.category === category).map((s) => s.id);
}
