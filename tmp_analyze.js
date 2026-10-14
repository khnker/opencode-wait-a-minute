const { selectRole } = require('./src/cognition/task-role-engine.js');
const fs = require('fs');
const path = require('path');
const FIXTURE_PATH = './benchmarks/task-conditioned-role-replacement/fixtures/scenarios.jsonl';
const scenarios = fs.readFileSync(FIXTURE_PATH, 'utf-8')
  .split('\n')
  .filter(l => l.trim().length > 0)
  .map(l => JSON.parse(l));
console.log('Scenario, Objective, Expected Role, Expected Conf, Actual Role, Score, Hits');
for (const sc of scenarios) {
  const res = selectRole({ objective: sc.objective, requirements: sc.requirements });
  console.log(`${sc.objective}, ${sc.expectedRole}, ${sc.expectedConfidence}, ${res.role}, ${res.score.toFixed(3)}, ${res.hits.length}`);
}
