const { selectRole, ROLE, SIGNAL_RULES } = require('./src/cognition/task-role-engine.js');
const fs = require('fs');
const path = require('path');
const FIXTURE_PATH = './benchmarks/task-conditioned-role-replacement/fixtures/scenarios.jsonl';
const scenarios = fs.readFileSync(FIXTURE_PATH, 'utf-8')
  .split('\n')
  .filter(l => l.trim().length > 0)
  .map(l => JSON.parse(l));

console.log('Testing each scenario:');
for (const sc of scenarios) {
  const res = selectRole({ objective: sc.objective, requirements: sc.requirements });
  console.log(`Objective: ${sc.objective}`);
  console.log(`  Expected role: ${sc.expectedRole} (confidence: ${sc.expectedConfidence})`);
  console.log(`  Actual role: ${res.role} (score: ${res.score})`);
  console.log(`  Hits: ${res.hits.length}`);
  if (res.hits.length > 0) {
    console.log(`    Hit details: ${JSON.stringify(res.hits)}`);
  }
  console.log('---');
}
