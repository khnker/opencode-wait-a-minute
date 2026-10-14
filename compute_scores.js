const { selectRole } = require('./src/cognition/task-role-engine.js');
const fs = require('fs');
const path = require('path');
const FIXTURE_PATH = './benchmarks/task-conditioned-role-replacement/fixtures/scenarios.jsonl';
const data = fs.readFileSync(FIXTURE_PATH, 'utf8');
const scenarios = data.split('\n').filter(line => line.trim().length > 0).map(line => JSON.parse(line));

console.log('Scenario, Objective, Expected Role, Expected Conf, Actual Role, Score, Hits');
for (const sc of scenarios) {
  const res = selectRole({ objective: sc.objective, requirements: sc.requirements });
  console.log(`${sc.objective}, ${sc.expectedRole}, ${sc.expectedConfidence}, ${res.role}, ${res.score.toFixed(3)}, ${res.hits.length}`);
}
