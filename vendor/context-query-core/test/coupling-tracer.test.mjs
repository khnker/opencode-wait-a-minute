import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  traceCoupling, traceReferences, extractTemplateBindings, extractComponentMeta,
  extractCalls, extractRoutes, findMethodRange, isExcludedRelPath,
  extractDeclarations, extractReferences, profileFor, registerProfile
} from '../src/coupling-tracer.js';

test('extractTemplateBindings reads event bindings and handlers', () => {
  const html = '<div>\n  <button (click)="onSave()">Save</button>\n  <span [class.on]="flag">x</span>\n</div>';
  const b = extractTemplateBindings(html);
  const click = b.find((x) => x.event === 'click');
  assert.strictEqual(click.handler, 'onSave');
  assert.strictEqual(click.line, 2);
  assert.ok(b.some((x) => x.prop === 'class.on'));
});

test('extractComponentMeta reads class, template, and DI map', () => {
  const ts = `@Component({ selector: 'app-x', templateUrl: './x.component.html' })
export class XComponent { constructor(private api: TodoService, readonly s: Other) {} }`;
  const m = extractComponentMeta(ts);
  assert.strictEqual(m.className, 'XComponent');
  assert.strictEqual(m.selector, 'app-x');
  assert.strictEqual(m.templateUrl, './x.component.html');
  assert.deepStrictEqual(m.di, { api: 'TodoService', s: 'Other' });
});

test('extractCalls and extractRoutes find this.dep.method and http verbs', () => {
  const ts = `onSave() {\n  this.api.create(this.title);\n  this.http.post('/api/todos', {});\n}`;
  const calls = extractCalls(ts);
  assert.ok(calls.some((c) => c.receiverVar === 'api' && c.method === 'create'));
  const routes = extractRoutes(ts);
  assert.strictEqual(routes[0].verb, 'POST');
  assert.strictEqual(routes[0].path, '/api/todos');
});

test('findMethodRange bounds a method body', () => {
  const ts = `a() { return 1 }\nb() { return 2 }`;
  const r = findMethodRange(ts, 'b');
  assert.ok(r);
  assert.strictEqual(ts.slice(r.start, r.end + 1), '{ return 2 }');
});

test('isExcludedRelPath rejects generated/vendored paths', () => {
  assert.strictEqual(isExcludedRelPath('node_modules/x/y.ts'), true);
  assert.strictEqual(isExcludedRelPath('src/app.component.ts'), false);
});

const fixture = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cqe-trace-'));
  fs.writeFileSync(path.join(dir, 'todo.component.html'),
    '<div>\n  <button (click)="onSave()">Save</button>\n</div>\n');
  fs.writeFileSync(path.join(dir, 'todo.component.ts'), `import { Component } from '@angular/core';
import { TodoService } from './todo.service';
@Component({ selector: 'app-todo', templateUrl: './todo.component.html' })
export class TodoComponent {
  title = '';
  constructor(private api: TodoService) {}
  onSave() {
    this.api.create(this.title);
  }
}
`);
  fs.writeFileSync(path.join(dir, 'todo.service.ts'), `import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
@Injectable({ providedIn: 'root' })
export class TodoService {
  constructor(private http: HttpClient) {}
  create(title: string) {
    return this.http.post('/api/todos', { title });
  }
}
`);
  return dir;
};

test('traceCoupling: button binding → handler → service → route', () => {
  const dir = fixture();
  const chain = traceCoupling({ repoRoot: dir, start: 'todo.component.html' });
  assert.deepStrictEqual(chain.map((n) => n.via), ['start', 'renders', 'calls', 'routes_to']);
  assert.strictEqual(chain[1].symbol, 'TodoComponent.onSave');
  assert.strictEqual(chain[1].event, 'click');
  assert.strictEqual(chain[1].path, 'todo.component.ts');
  assert.strictEqual(chain[2].symbol, 'TodoService.create');
  assert.strictEqual(chain[2].path, 'todo.service.ts');
  assert.strictEqual(chain[3].symbol, 'POST /api/todos');
});

test('traceCoupling: unresolved service yields a partial chain without throwing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cqe-trace-p-'));
  fs.writeFileSync(path.join(dir, 'x.component.html'), '<button (click)="go()">Go</button>\n');
  fs.writeFileSync(path.join(dir, 'x.component.ts'), `export class XComponent {
  constructor(private api: MissingService) {}
  go() { this.api.hit(); }
}
`);
  const chain = traceCoupling({ repoRoot: dir, start: 'x.component.html' });
  assert.deepStrictEqual(chain.map((n) => n.via), ['start', 'renders']);
  assert.strictEqual(chain[1].symbol, 'XComponent.go');
});

test('traceCoupling: missing input returns empty, never throws', () => {
  assert.deepStrictEqual(traceCoupling({ repoRoot: '/tmp', start: 'nope.html' }).map((n) => n.via), ['start']);
  assert.deepStrictEqual(traceCoupling({}), []);
});

test('language-agnostic: declarations across Python/Go/Ruby', () => {
  assert.ok(extractDeclarations('def compute(x):\n  return x').some((d) => d.name === 'compute' && d.kind === 'symbol'));
  assert.ok(extractDeclarations('func Handle(w http.ResponseWriter) {').some((d) => d.name === 'Handle'));
  assert.ok(extractDeclarations('class Foo\n  def bar\n  end\nend').some((d) => d.name === 'Foo'));
});

test('language-agnostic: references mark call sites', () => {
  const refs = extractReferences('result = compute(1)\nother = compute', 'compute');
  assert.strictEqual(refs.length, 2);
  assert.strictEqual(refs[0].kind, 'calls');
  assert.strictEqual(refs[1].kind, 'references');
});

test('profile registry resolves by extension with generic fallback', () => {
  assert.strictEqual(profileFor('a.ts').language, 'typescript');
  assert.strictEqual(profileFor('a.html').language, 'html');
  assert.strictEqual(profileFor('a.py').language, 'generic');
  assert.strictEqual(profileFor('a.xyz').language, 'generic');
  const custom = registerProfile(['rb'], { language: 'ruby', references: extractReferences });
  assert.strictEqual(profileFor('x.rb').language, 'ruby');
  assert.strictEqual(custom.language, 'ruby');
});

test('traceReferences: finds callers in any language (Python fixture)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cqe-poly-'));
  fs.writeFileSync(path.join(dir, 'math_utils.py'), 'def compute(x):\n  return x + 1\n');
  fs.writeFileSync(path.join(dir, 'app.py'), 'from math_utils import compute\nresult = compute(41)\n');
  const chain = traceReferences({ repoRoot: dir, symbol: 'compute' });
  assert.ok(chain.some((n) => n.path === 'app.py' && n.kind === 'calls'));
  assert.ok(chain.some((n) => n.path === 'math_utils.py'));
});

test('traceCoupling with symbol routes to language-agnostic references', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cqe-poly2-'));
  fs.writeFileSync(path.join(dir, 'svc.go'), 'func Serve() {}\n');
  fs.writeFileSync(path.join(dir, 'main.go'), 'func main() {\n  Serve()\n}\n');
  const chain = traceCoupling({ repoRoot: dir, symbol: 'Serve' });
  assert.ok(chain.some((n) => n.path === 'main.go' && n.kind === 'calls'));
});
