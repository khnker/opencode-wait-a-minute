export const RC1_SCENARIOS = [
  { id: "local", turns: [{ prompt: "Test local.", input: { taskId: "local", objective: "local" } }] },
  { id: "contextual", turns: [{ prompt: "Test context.", input: { taskId: "contextual", objective: "contextual", reqs: 5 } }] },
  { id: "continuation", turns: Array.from({length: 20}, (_, i) => ({ prompt: `Continuation turn ${i+1}`, input: { taskId: "continuation", objective: "continuation" } })) },
  { id: "mutation", turns: [
    { prompt: "Full", input: { taskId: "mut", objective: "mut" } },
    { prompt: "Fast", input: { taskId: "mut", objective: "mut" } },
    { prompt: "Fast", input: { taskId: "mut", objective: "mut" } },
    { prompt: "Partial", input: { taskId: "mut", objective: "mut" } },
    { prompt: "Fast", input: { taskId: "mut", objective: "mut" } },
    { prompt: "Full", input: { taskId: "mut", objective: "mut" } },
    { prompt: "Fast", input: { taskId: "mut", objective: "mut" } }
  ]},
  { id: "negative-control", turns: [{ prompt: "Overhead", input: { taskId: "neg", objective: "neg" } }] }
];

export function getRc1Scenario(id) {
  return RC1_SCENARIOS.find(s => s.id === id);
}
