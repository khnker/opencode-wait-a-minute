import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recordContextPack, listContextEvidence, readContextEvidence } from './context-pack-evidence.js';

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wam-pack-evidence-'));
}

const pack = {
  source: 'router',
  budget: 16000,
  budget_used: 1234,
  budget_violation: false,
  levels: { N0: 1, N1: 2, N2: 1, N3: 3 },
  lines: ['[wam N0 policy] x', '[wam N2 task] y'],
  admission: { droppedItems: ['admission: dropped N3 (OPTIONAL) — low utility'] },
  integrity: { selectedCount: 4, emittedCount: 3, omittedCount: 1, finalSufficiency: 'sufficient' },
  rationale: ['N3: using Context Router for selection'],
};

test('records the first pack with seq 1 and an ordered manifest', () => {
  const root = tempRoot();
  const res = recordContextPack({ taskId: 'task-a', prompt: 'hello', pack, root });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.seq, 1);

  const dir = path.join(root, '.wam', 'tasks', 'task-a', 'context');
  const files = fs.readdirSync(dir).sort();
  assert.strictEqual(files.length, 2);
  assert.match(files[0], /^0001-[0-9a-f]{12}\.json$/);
  assert.strictEqual(files[1], 'index.json');

  const record = JSON.parse(fs.readFileSync(res.file, 'utf-8'));
  assert.strictEqual(record.seq, 1);
  assert.strictEqual(record.prompt, 'hello');
  assert.deepStrictEqual(record.injected, pack.lines);
  assert.deepStrictEqual(record.dropped, pack.admission.droppedItems);
  assert.strictEqual(record.integrity.selectedCount, 4);
  assert.strictEqual(record.budget_used, 1234);

  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf-8'));
  assert.deepStrictEqual(index.entries.map((e) => e.seq), [1]);
  assert.strictEqual(index.entries[0].lines, 2);
  assert.strictEqual(index.entries[0].dropped, 1);
});

test('keeps monotonic ordering across turns', () => {
  const root = tempRoot();
  recordContextPack({ taskId: 'task-b', prompt: 'one', pack, root });
  const second = recordContextPack({ taskId: 'task-b', prompt: 'two', pack, root });
  assert.strictEqual(second.ok, true);
  assert.strictEqual(second.seq, 2);

  const dir = path.join(root, '.wam', 'tasks', 'task-b', 'context');
  const numbered = fs.readdirSync(dir).filter((f) => /^\d{4}-/.test(f)).sort();
  assert.deepStrictEqual(numbered.map((f) => f.slice(0, 4)), ['0001', '0002']);

  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf-8'));
  assert.deepStrictEqual(index.entries.map((e) => e.seq), [1, 2]);
});

test('survives a missing manifest without reusing sequence numbers', () => {
  const root = tempRoot();
  const first = recordContextPack({ taskId: 'task-c', prompt: 'x', pack, root });
  fs.unlinkSync(path.join(path.dirname(first.file), 'index.json'));
  const second = recordContextPack({ taskId: 'task-c', prompt: 'y', pack, root });
  assert.strictEqual(second.seq, 2);
});

test('prunes oldest records above WAM_CONTEXT_EVIDENCE_MAX', () => {
  const root = tempRoot();
  process.env.WAM_CONTEXT_EVIDENCE_MAX = '2';
  try {
    for (let i = 0; i < 3; i++) recordContextPack({ taskId: 'task-d', prompt: `p${i}`, pack, root });
  } finally {
    delete process.env.WAM_CONTEXT_EVIDENCE_MAX;
  }
  const dir = path.join(root, '.wam', 'tasks', 'task-d', 'context');
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf-8'));
  assert.deepStrictEqual(index.entries.map((e) => e.seq), [2, 3]);
  const numbered = fs.readdirSync(dir).filter((f) => /^\d{4}-/.test(f)).sort();
  assert.deepStrictEqual(numbered.map((f) => f.slice(0, 4)), ['0002', '0003']);
});

test('fails soft instead of throwing', () => {
  const root = tempRoot();
  const asFile = path.join(root, 'not-a-dir');
  fs.writeFileSync(asFile, 'x');
  const res = recordContextPack({ taskId: 'task-e', prompt: 'z', pack, root: asFile });
  assert.strictEqual(res.ok, false);
  assert.ok(res.reason);
  assert.strictEqual(recordContextPack({ pack, root }).ok, false);
});

test('archives the full candidate pool and exposes list/read APIs', () => {
  const root = tempRoot();
  const candidatePack = {
    ...pack,
    candidates: [{ id: 'req-1', type: 'requirement', content: 'do X', verified: false }],
  };
  recordContextPack({ taskId: 'task-f', prompt: 'q', pack: candidatePack, root });

  const dir = path.join(root, '.wam', 'tasks', 'task-f', 'context');
  const entries = listContextEvidence({ taskId: 'task-f', root });
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].candidates, 1);

  const record = JSON.parse(fs.readFileSync(path.join(dir, entries[0].file), 'utf-8'));
  assert.deepStrictEqual(record.candidates, candidatePack.candidates);

  const rec = readContextEvidence({ taskId: 'task-f', seq: 1, root });
  assert.strictEqual(rec.candidates[0].id, 'req-1');
  assert.strictEqual(rec.candidates[0].type, 'requirement');
  assert.strictEqual(rec.candidates[0].content, 'do X');
  assert.strictEqual(rec.candidates[0].verified, false);
});

test('records how many skill bodies were paid for versus deduped to refs', () => {
  const root = tempRoot();
  const skillPack = {
    ...pack,
    lines: [
      '[wam N3 skill] codebase-design\nbody',
      '[wam N3 skill] writing-for-agents\nbody',
      '[wam N3 skill-ref] codebase-design — already injected this session',
      '[wam N0 policy] x',
    ],
  };
  const res = recordContextPack({ taskId: 'task-skill', prompt: 'p', pack: skillPack, root });
  assert.strictEqual(res.ok, true);

  const record = JSON.parse(fs.readFileSync(res.file, 'utf-8'));
  assert.deepStrictEqual(record.injection, { skills: 2, refs: 1 });

  const [entry] = listContextEvidence({ taskId: 'task-skill', root });
  assert.deepStrictEqual(entry.injection, { skills: 2, refs: 1 });
});
