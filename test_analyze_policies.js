import { analyze } from "./src/skills/engine.js";

const testCases = [
  { prompt: "hola mundo", expectedPolicies: ["scope", "verify", "simplify"] },
  { prompt: "Implementa un endpoint REST", expectedPolicies: ["scope", "verify", "simplify"] },
  { prompt: "Refactoriza la arquitectura", expectedPolicies: ["scope", "verify", "simplify", "decision-gate"] },
];

async function run() {
  for (const { prompt, expectedPolicies } of testCases) {
    console.log(`Testing prompt: "${prompt}"`);
    const result = await analyze({ prompt, projectPath: "." });
    const applied = result.persistentPolicies.map(p => p.policy);
    console.log(`  Applied policies: ${applied.join(", ")}`);
    const missing = expectedPolicies.filter(p => !applied.includes(p));
    if (missing.length > 0) {
      console.log(`  ❌ Missing expected policies: ${missing.join(", ")}`);
      process.exit(1);
    } else {
      console.log(`  ✅ All expected policies present`);
    }
  }
  console.log("All tests passed!");
}

run().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
