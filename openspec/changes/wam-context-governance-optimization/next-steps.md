# WAM Context Governance Optimization — Next Steps (Implementation Plan)

## Phase 1: Governance Cache Module (T-01)

### Files to Create
- `src/context/governance-cache.js`

### Implementation
```javascript
// src/context/governance-cache.js
const fs = await import('node:fs');
const path = await import('node:path');

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedSummary = null;
let cacheTimestamp = 0;
let cacheSource = null;

export async function loadGovernanceSummary(repoRoot = process.cwd()) {
  const agentsFiles = [
    path.join(repoRoot, 'AGENTS.md'),
    path.join('/home/nicolas/.config/opencode', 'AGENTS.md')
  ].filter(f => fs.existsSync(f));

  let fullContent = '';
  for (const f of agentsFiles) {
    fullContent += fs.readFileSync(f, 'utf8') + '\n---\n';
  }

  // Distill to actionable rules only (≤ 200 tokens ≈ 800 chars)
  const distilled = distillGovernance(fullContent);
  cachedSummary = distilled;
  cacheTimestamp = Date.now();
  cacheSource = agentsFiles;
  return distilled;
}

function distillGovernance(content) {
  // Extract only actionable rules, tool patterns, hard constraints
  // Skip narrative, examples, rationale
  const lines = content.split('\n');
  const actionable = lines.filter(l => 
    l.match(/^(###|- \[\]|ALWAYS|NEVER|MUST|SHALL|Regla|Rule|Tool|Mandate)/i)
  );
  return actionable.join('\n').slice(0, 800);
}

export function getCachedSummary() {
  if (cachedSummary && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return { summary: cachedSummary, cached: true, ageMs: Date.now() - cacheTimestamp };
  }
  return { summary: null, cached: false };
}

export function invalidateCache() {
  cachedSummary = null;
  cacheTimestamp = 0;
  cacheSource = null;
}

export function getCacheInfo() {
  return { cached: !!cachedSummary, ageMs: Date.now() - cacheTimestamp, source: cacheSource };
}
```

### Integration Point
- In `src/integration/message-handler.js` pre-flight:
  ```javascript
  import { getCachedSummary, loadGovernanceSummary } from '../context/governance-cache.js';
  
  // At start of handleMessage:
  const { summary } = getCachedSummary() || await loadGovernanceSummary();
  ```

---

## Phase 2: Historical Case Store (T-02)

### Files to Create
- `src/context/history-store.js`

### Implementation
```javascript
// src/context/history-store.js
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const HISTORY_FILE = path.join(process.cwd(), '.wam', 'history-index.json');
let historyIndex = null;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function indexHistory(maxCommits = 30) {
  // 1. Git log: recent commits with messages
  const log = execSync(
    `git log --oneline -n ${maxCommits} --pretty=format:'%h|%s|%ad' --date=short`,
    { encoding: 'utf8', cwd: process.cwd() }
  ).trim().split('\n').map(l => {
    const [hash, ...rest] = l.split('|');
    const date = rest.pop();
    return { hash, message: rest.join('|'), date };
  });

  // 2. OpenSpec archived changes
  const specDir = path.join(process.cwd(), 'openspec', 'changes');
  let archived = [];
  if (fs.existsSync(specDir)) {
    archived = fs.readdirSync(specDir)
      .filter(d => fs.existsSync(path.join(specDir, d, '.openspec.yaml')))
      .map(d => {
        const meta = fs.readFileSync(path.join(specDir, d, '.openspec.yaml'), 'utf8');
        return { id: d, archived: meta.includes('archived: true') };
      });
  }

  historyIndex = { commits: log, archived, indexedAt: Date.now() };
  ensureDir(path.dirname(HISTORY_FILE));
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyIndex, null, 2));
  return historyIndex;
}

export function loadHistory() {
  if (historyIndex) return historyIndex;
  if (fs.existsSync(HISTORY_FILE)) {
    historyIndex = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    return historyIndex;
  }
  return indexHistory();
}

export function findRelevantCase(pattern) {
  const history = loadHistory();
  const keywords = pattern.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  const scored = history.commits.map(c => {
    const score = keywords.reduce((s, k) => s + (c.message.toLowerCase().includes(k) ? 1 : 0), 0);
    return { ...c, score };
  }).filter(c => c.score > 0).sort((a, b) => b.score - a.score);

  return scored.slice(0, 3);
}

export function recordOutcome(changeId, outcome) {
  const history = loadHistory();
  const entry = history.archived.find(a => a.id === changeId);
  if (entry) {
    entry.outcome = outcome;
    entry.recordedAt = Date.now();
    ensureDir(path.dirname(HISTORY_FILE));
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  }
}
```

---

## Phase 3: Trigram Index Manager (T-03)

### Files to Create
- `src/context/index-manager.js`

### Implementation
```javascript
// src/context/index-manager.js
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const TGREP_INDEX_DIR = '.tgrep';

export async function ensureIndexFresh(maxAgeMs = 60 * 60 * 1000) {
  // Check if tgrep is available
  try {
    execSync('tgrep --version', { stdio: 'ignore' });
  } catch {
    return { available: false, reason: 'tgrep not installed' };
  }

  // Check index age
  const indexPath = TGREP_INDEX_DIR;
  if (!fs.existsSync(indexPath)) {
    return await rebuildIndex();
  }

  const stat = fs.statSync(indexPath);
  const age = Date.now() - stat.mtimeMs;
  
  if (age > maxAgeMs) {
    return await rebuildIndex();
  }

  return { available: true, fresh: true, ageMs: age };
}

async function rebuildIndex() {
  try {
    execSync('tgrep index .', { stdio: 'inherit', cwd: process.cwd() });
    return { available: true, fresh: true, rebuilt: true };
  } catch (e) {
    return { available: true, fresh: false, error: e.message };
  }
}

export async function warmup() {
  // Fire and forget - don't block pre-flight
  const promise = ensureIndexFresh();
  // Return immediately; index will be ready when first search runs
  return promise;
}
```

---

## Phase 4: Tests and Benchmarks (T-04)

### Test Files
1. `tests/unit/context/governance-cache.test.mjs`
2. `tests/unit/context/history-store.test.mjs`

### Benchmark File
- `benchmarks/context/historical-cases.mjs`

### Real Historical Cases (from git log)
| Pattern | Expected Match | Commit |
|---------|---------------|--------|
| "integrate discovery" | `feat(wam): integrate discovery...` | 6b07ee1 |
| "add missing cqe" | `feat(wam): add missing cqe...` | 43e87f8 |
| "wire CQE runtime" | `feat(governance,cqe): add read-delegation...` | 61ce8ab |
| "add LLM task inference" | `feat: add LLM task inference...` | 1a5afeb |

---

## Phase 5: Validation (T-05)

### Commands
```bash
# Run all new tests
node --test tests/unit/context/governance-cache.test.mjs tests/unit/context/history-store.test.mjs

# Run historical cases benchmark
node benchmarks/context/historical-cases.mjs

# Full suite
node scripts/run-tests.mjs

# OpenSpec strict validation
openspec validate wam-context-governance-optimization --strict
openspec validate --all --strict
```

### Success Metrics
- Governance cache: returns ≤ 200 tokens summary
- History store: finds relevant case in < 100ms
- Index manager: warmup completes without blocking
- Full suite: 0 failures
- OpenSpec: 144+ specs pass