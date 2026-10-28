import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
process.env.CQE_CATALOG_DB = path.join(os.tmpdir(), 'cqe-rel-' + process.pid + '.db');
import {
  CodeRelationshipProvider, RELATIONSHIP_TYPES, relationshipConfig,
  enrichWithRelationships, relationshipToCandidate, safeStatus
} from '../src/code-relationships.js';
import { createDefaultProvider, isExcludedPath } from '../src/repograph-provider.js';
import { LexicalRetriever, hybridRetrieval } from '../src/retriever.js';

class FakeProvider extends CodeRelationshipProvider {
  constructor({ symbols = [], rels = [], available = true } = {}) {
    super();
    this.symbols = symbols;
    this.rels = rels;
    this.available = available;
  }
  async getStatus() { return { available: this.available, reason: this.available ? undefined : 'disabled' }; }
  async findSymbols() { return this.symbols; }
  async getRelationships() { return this.rels; }
}

test('relationshipConfig defaults to disabled and bounded', () => {
  const cfg = relationshipConfig({});
  assert.strictEqual(cfg.enabled, false);
  assert.strictEqual(cfg.depth, 1);
  assert.ok(cfg.maxExtra > 0);
  assert.deepStrictEqual(cfg.categories, []);
});

test('relationshipConfig reads CF_REPOGRAPH_* overrides', () => {
  const cfg = relationshipConfig({
    CF_REPOGRAPH_ENABLED: '1', CF_REPOGRAPH_DEPTH: '2',
    CF_REPOGRAPH_CATEGORIES: 'calls, extends', CF_REPOGRAPH_DIRECTION: 'in'
  });
  assert.strictEqual(cfg.enabled, true);
  assert.strictEqual(cfg.depth, 2);
  assert.deepStrictEqual(cfg.categories, ['calls', 'extends']);
  assert.strictEqual(cfg.direction, 'in');
});

test('base CodeRelationshipProvider is inert and reports unavailable', async () => {
  const p = new CodeRelationshipProvider();
  assert.deepStrictEqual(await p.findSymbols('x'), []);
  assert.deepStrictEqual(await p.getRelationships('id'), []);
  assert.strictEqual((await p.getStatus()).available, false);
  assert.ok(RELATIONSHIP_TYPES.includes('calls'));
});

test('safeStatus degrades a throwing provider to unavailable', async () => {
  const s = await safeStatus({ getStatus() { throw new Error('boom'); } });
  assert.strictEqual(s.available, false);
  assert.strictEqual(s.reason, 'status-error');
});

test('RepographProvider reports unavailable when the vendored core is absent', async () => {
  const p = createDefaultProvider({ repoRoot: process.cwd(), coreDir: '/nonexistent/repograph/dist/index.js' });
  const st = await p.getStatus();
  assert.strictEqual(st.available, false);
  assert.match(String(st.reason), /not found|unavailable/);
  assert.deepStrictEqual(await p.findSymbols('retriever'), []);
  assert.deepStrictEqual(await p.getRelationships('id'), []);
});

test('RepographProvider becomes available when the vendored core is present', async (t) => {
  const corePath = path.resolve('vendor/repograph/dist/index.js');
  if (!fs.existsSync(corePath)) return t.skip('vendored core not present');
  const p = createDefaultProvider({ repoRoot: process.cwd(), autoIndex: false });
  const st = await p.getStatus();
  assert.strictEqual(st.available, true);
  assert.strictEqual(st.runtime, process.versions.node);
});

test('isExcludedPath rejects vendored, generated, and build paths', () => {
  for (const p of [
    'node_modules/x/y.js', 'vendor/a.js', 'dist/b.js', 'build/c.js',
    '.git/config', 'src/coverage/x.js', 'packages/app/dist/main.js'
  ]) {
    assert.strictEqual(isExcludedPath(p), true, p);
  }
  assert.strictEqual(isExcludedPath('src/retriever.js'), false);
  assert.strictEqual(isExcludedPath('index.js'), false);
});

const loadCore = async () => {
  const corePath = path.resolve('vendor/repograph/dist/index.js');
  if (!fs.existsSync(corePath)) return null;
  return import(pathToFileURL(corePath).href);
};

test('RepographProvider scopes its index to the repository by default', async (t) => {
  const core = await loadCore();
  if (!core) return t.skip('vendored core not present');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'cqe-scope-'));
  const p = createDefaultProvider({ repoRoot: repo, autoIndex: false });
  await p.getStatus();
  assert.strictEqual(p.dbPath, core.defaultDatabasePath(repo));
});

test('RepographProvider detects staleness and reindexes on demand', async (t) => {
  const core = await loadCore();
  if (!core) return t.skip('vendored core not present');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'cqe-stale-'));
  fs.writeFileSync(path.join(repo, 'a.js'), 'export function alpha() { return 1 }\n');
  const db = core.defaultDatabasePath(repo);
  fs.mkdirSync(path.dirname(db), { recursive: true });

  const p1 = createDefaultProvider({ repoRoot: repo, dbPath: db, staleCheckMs: 0 });
  await p1.findSymbols('alpha');
  const st1 = await p1.getStatus();
  assert.strictEqual(st1.index.present, true);
  assert.strictEqual(st1.index.fresh, true);
  assert.ok(st1.revision);

  await new Promise((r) => setTimeout(r, 1100));
  fs.writeFileSync(path.join(repo, 'b.js'), 'export function beta() { return 2 }\n');
  const p2 = createDefaultProvider({ repoRoot: repo, dbPath: db, staleCheckMs: 0 });
  const st2 = await p2.getStatus();
  assert.strictEqual(st2.index.present, true);
  assert.strictEqual(st2.index.fresh, false);

  await p2.findSymbols('beta');
  const st3 = await p2.getStatus();
  assert.strictEqual(st3.index.fresh, true);
});

test('enrichWithRelationships is a no-op when disabled', async () => {
  const provider = new FakeProvider({
    symbols: [{ id: 's' }],
    rels: [{ path: 'a.js', line_start: 1, line_end: 2, type: 'calls', resolution: 'resolved' }]
  });
  assert.deepStrictEqual(await enrichWithRelationships([], provider, relationshipConfig({})), []);
});

test('enrichWithRelationships is a no-op when the provider is unavailable', async () => {
  const provider = new FakeProvider({ available: false, symbols: [{ id: 's' }] });
  const cfg = { ...relationshipConfig({}), enabled: true };
  assert.deepStrictEqual(await enrichWithRelationships([], provider, cfg), []);
});

test('enrichWithRelationships bounds output and dedups against existing candidates', async () => {
  const rels = [
    { path: 'src/a.js', line_start: 1, line_end: 5, type: 'calls', resolution: 'resolved', confidence: 0.8 },
    { path: 'src/a.js', line_start: 1, line_end: 5, type: 'references', resolution: 'resolved' },
    { path: 'src/b.js', line_start: 2, line_end: 4, type: 'implements', resolution: 'unresolved' },
    { path: 'src/c.js', line_start: 3, line_end: 9, type: 'extends', resolution: 'resolved' }
  ];
  const provider = new FakeProvider({ symbols: [{ id: 's' }], rels });
  const cfg = { ...relationshipConfig({}), enabled: true, maxExtra: 2 };
  const existing = [{ path: 'src/b.js', line_start: 2, line_end: 4 }];
  const out = await enrichWithRelationships(existing, provider, cfg);
  assert.strictEqual(out.length, 2);
  assert.ok(!out.some((c) => c.path === 'src/b.js'));
  assert.strictEqual(out[0].source, 'repograph');
  assert.ok(out[0].match_type.startsWith('relationship:'));
});

test('relationshipToCandidate marks provenance and score', () => {
  const c = relationshipToCandidate({
    type: 'calls', source_id: 'a', target_id: 'b', path: 'x.js',
    line_start: 1, line_end: 2, resolution: 'resolved', confidence: 0.5
  });
  assert.strictEqual(c.source, 'repograph');
  assert.strictEqual(c.score, 0.5);
  assert.strictEqual(c.match_type, 'relationship:calls');
});

test('hybridRetrieval output is unchanged when enrichment is disabled', async () => {
  const retrievers = () => [new LexicalRetriever()];
  const baseline = await hybridRetrieval(retrievers(), 'retriever', { budget: 8000, limit: 10 });
  const provider = new FakeProvider({
    symbols: [{ id: 's' }],
    rels: [{ path: 'src/__fake__.js', line_start: 1, line_end: 3, type: 'calls', resolution: 'resolved', confidence: 0.9 }]
  });
  const off = await hybridRetrieval(retrievers(), 'retriever', {
    budget: 8000, limit: 10, relationshipProvider: provider
  });
  assert.deepStrictEqual(off.selected.map((c) => c.key), baseline.selected.map((c) => c.key));
});

test('hybridRetrieval enriches with bounded relationship candidates when enabled', async () => {
  const provider = new FakeProvider({
    symbols: [{ id: 's' }],
    rels: [{ path: 'src/__fake_rel__.js', line_start: 1, line_end: 3, type: 'calls', resolution: 'resolved', confidence: 0.95 }]
  });
  const cfg = { ...relationshipConfig({}), enabled: true, maxExtra: 3 };
  const res = await hybridRetrieval([new LexicalRetriever()], 'retriever', {
    budget: 50000, limit: 50, relationshipProvider: provider, relationshipConfig: cfg
  });
  const enriched = res.selected.filter((c) => c.source === 'repograph');
  assert.ok(enriched.length >= 1, 'expected an enriched relationship candidate');
  assert.ok(enriched.length <= 3);
});
