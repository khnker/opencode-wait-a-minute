import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isExcludedRelPath,
  findMethodRange,
  extractTemplateBindings,
  extractComponentMeta,
  extractCalls,
  extractRoutes,
  extractDeclarations
} from '../src/coupling-tracer.js';

test('isExcludedRelPath handles empty/invalid input', () => {
  assert.equal(isExcludedRelPath(''), false);
  assert.equal(isExcludedRelPath(null), false);
  assert.equal(isExcludedRelPath(undefined), false);
  assert.equal(isExcludedRelPath(0), false);
});

test('isExcludedRelPath matches excluded dirs and strips ./ prefix', () => {
  assert.equal(isExcludedRelPath('node_modules/pkg/index.js'), true);
  assert.equal(isExcludedRelPath('./vendor/core/dist/index.js'), true);
  assert.equal(isExcludedRelPath('src/.git/config'), true);
  assert.equal(isExcludedRelPath('dist/bundle.js'), true);
  assert.equal(isExcludedRelPath('build/out.js'), true);
  assert.equal(isExcludedRelPath('coverage/lcov.info'), true);
  assert.equal(isExcludedRelPath('.repograph/index.sqlite'), true);
  assert.equal(isExcludedRelPath('src/node_modules/nested/x.js'), true);
});

test('isExcludedRelPath passes normal source paths', () => {
  assert.equal(isExcludedRelPath('src/app.component.ts'), false);
  assert.equal(isExcludedRelPath('lib/utils.js'), false);
  assert.equal(isExcludedRelPath('packages/api/controller.ts'), false);
});

test('findMethodRange returns null for empty/invalid input', () => {
  assert.equal(findMethodRange('', 'foo'), null);
  assert.equal(findMethodRange(null, 'foo'), null);
  assert.equal(findMethodRange('a() {}', ''), null);
  assert.equal(findMethodRange('a() {}', null), null);
});

test('findMethodRange returns null when method not found or body malformed', () => {
  assert.equal(findMethodRange('a() { return 1 }', 'missing'), null);
  // declaration without a body (semicolon before brace)
  assert.equal(findMethodRange('foo(); bar() { return 1 }', 'foo'), null);
  // unterminated body
  assert.equal(findMethodRange('foo() { return 1', 'foo'), null);
});

test('findMethodRange ignores this.name( member calls', () => {
  const src = 'run() { this.save(); }\nsave() { return 1 }';
  const r = findMethodRange(src, 'save');
  assert.ok(r);
  assert.equal(src.slice(r.start, r.end + 1), '{ return 1 }');
});

test('extractTemplateBindings handles empty/malformed input gracefully', () => {
  assert.deepStrictEqual(extractTemplateBindings(''), []);
  assert.deepStrictEqual(extractTemplateBindings('<div>no bindings</div>'), []);
});

test('extractTemplateBindings no-match keeps empty output', () => {
  const html = '<div [ngIf]="cond">{{ x }}</div>';
  const out = extractTemplateBindings(html);
  assert.ok(out.some((b) => b.prop === 'ngIf'));
  assert.ok(!out.some((b) => b.event));
});

test('extractComponentMeta returns empty fields for empty/malformed input', () => {
  const m = extractComponentMeta('');
  assert.equal(m.className, undefined);
  assert.equal(m.selector, undefined);
  assert.equal(m.templateUrl, undefined);
  assert.deepStrictEqual(m.di, {});
  const m2 = extractComponentMeta(null);
  assert.equal(m2.className, undefined);
  assert.deepStrictEqual(m2.di, {});
});

test('extractComponentMeta handles ctor without DI params', () => {
  const ts = 'export class Plain { constructor() {} }';
  const m = extractComponentMeta(ts);
  assert.equal(m.className, 'Plain');
  assert.deepStrictEqual(m.di, {});
});

test('extractCalls returns [] for empty input and no this-calls', () => {
  assert.deepStrictEqual(extractCalls(''), []);
  assert.deepStrictEqual(extractCalls('function foo() { return 1 }'), []);
});

test('extractCalls respects a range slice', () => {
  const ts = 'a() { this.x.one() }\nb() { this.y.two() }';
  const r = findMethodRange(ts, 'b');
  const calls = extractCalls(ts, r);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].receiverVar, 'y');
  assert.equal(calls[0].method, 'two');
});

test('extractRoutes returns [] for empty input and no http verbs', () => {
  assert.deepStrictEqual(extractRoutes(''), []);
  assert.deepStrictEqual(extractRoutes('this.svc.doWork()'), []);
});

test('extractRoutes respects a range slice', () => {
  const ts = "a() { this.http.get('/a') }\nb() { this.http.post('/b') }";
  const r = findMethodRange(ts, 'b');
  const routes = extractRoutes(ts, r);
  assert.equal(routes.length, 1);
  assert.equal(routes[0].verb, 'POST');
  assert.equal(routes[0].path, '/b');
});

test('extractDeclarations returns [] for empty/malformed input', () => {
  assert.deepStrictEqual(extractDeclarations(''), []);
  assert.deepStrictEqual(extractDeclarations('   \n\t '), []);
});

test('extractDeclarations dedups repeated names across kinds', () => {
  const src = 'function foo() {}\nconst foo = 1;\nclass foo {}';
  const out = extractDeclarations(src);
  const names = out.map((d) => d.name);
  assert.equal(names.filter((n) => n === 'foo').length, 1);
});
