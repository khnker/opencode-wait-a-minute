/**
 * Intent/context evaluation metrics.
 *
 * Deterministic metrics for comparing router/context changes:
 * intent accuracy, clarification rate, contract acceptance, context token cost.
 */

export function intentAccuracy(cases = []) {
  const total = cases.length;
  if (!total) return 1;
  const correct = cases.filter((c) => c.actual === c.expected).length;
  return correct / total;
}

export function clarificationRate(cases = []) {
  const total = cases.length;
  if (!total) return 0;
  return cases.filter((c) => c.asked).length / total;
}

export function contractAcceptanceRate(cases = []) {
  const total = cases.length;
  if (!total) return 1;
  return cases.filter((c) => c.accepted).length / total;
}

export function averageContextTokens(records = []) {
  if (!records.length) return 0;
  const total = records.reduce((sum, r) => sum + (Number(r.tokens) || 0), 0);
  return Math.round(total / records.length);
}

export function evaluateIntentSuite({ lanes = [], clarifications = [], contracts = [], contexts = [] } = {}) {
  return {
    intentAccuracy: intentAccuracy(lanes),
    clarificationRate: clarificationRate(clarifications),
    contractAcceptanceRate: contractAcceptanceRate(contracts),
    averageContextTokens: averageContextTokens(contexts),
    samples: {
      lanes: lanes.length,
      clarifications: clarifications.length,
      contracts: contracts.length,
      contexts: contexts.length,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fixtures = {
    lanes: [
      { expected: "CONVERSATION", actual: "CONVERSATION" },
      { expected: "TASK_NEW", actual: "TASK_NEW" },
      { expected: "CONTINUATION", actual: "CONTINUATION" },
    ],
    clarifications: [{ asked: false }, { asked: true }, { asked: false }],
    contracts: [{ accepted: true }, { accepted: true }, { accepted: false }],
    contexts: [{ tokens: 800 }, { tokens: 1200 }, { tokens: 400 }],
  };
  console.log(JSON.stringify(evaluateIntentSuite(fixtures), null, 2));
}
