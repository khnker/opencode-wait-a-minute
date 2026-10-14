const { selectRole } = require('./src/cognition/task-role-engine.js');
const fs = require('fs');
const path = require('path');
const FIXTURE_PATH = './benchmarks/task-conditioned-role-replacement/fixtures/scenarios.jsonl';
const scenarios = fs.readFileSync(FIXTURE_PATH, 'utf-8')
  .split('\n')
  .filter(l => l.trim().length > 0)
  .map(l => JSON.parse(l));

function bucketFromConfidence(c) {
  if (c === 'high') return 0.6;
  if (c === 'med') return 0.4;
  return 0.0; // low
}
function toleranceFromConfidence(c) {
  if (c === 'high') return 0.15;
  if (c === 'med') return 0.1;
  return 0.2; // low
}

let pass = 0;
for (const sc of scenarios) {
  const res = selectRole({ objective: sc.objective, requirements: sc.requirements });
  const expectedBucket = bucketFromConfidence(sc.expectedConfidence);
  const tolerance = toleranceFromConfidence(sc.expectedConfidence);
  const inRange = Math.abs(res.score - expectedBucket) <= tolerance;
  if (inRange) pass++;
  console.log(`${sc.objective} | Exp:${sc.expectedRole}(${sc.expectedConfidence})[${expectedBucket}] | Act:${res.role}(${res.score.toFixed(3)}) | InRange:${inRange} | Hits:${res.hits.length}`);
}
console.log(`\nPassed: ${pass}/${scenarios.length}`);
