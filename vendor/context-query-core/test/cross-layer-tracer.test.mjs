import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  extractServerRoutes, extractPersistence, extractDispatches,
  normalizeRoutePath, matchUrlToRoute, classifyLayer, traceCrossLayer,
  CROSS_LAYER_EDGE_KINDS,
} from '../src/cross-layer-tracer.js';

function fixture(files) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cqe-xlt-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return tmp;
}

test('extractServerRoutes: NestJS', () => {
  const src = "@Controller('api') export class C {\n  @Get('todos') get() {}\n  @Post('todos') save() {}\n}";
  const routes = extractServerRoutes(src);
  assert.strictEqual(routes[0].path, 'api/todos');
  assert.strictEqual(routes[0].method, 'GET');
  assert.strictEqual(routes[0].handler, 'get');
  assert.strictEqual(routes[0].line, 2);
  assert.strictEqual(routes[1].method, 'POST');
  assert.strictEqual(routes[1].handler, 'save');
});

test('extractServerRoutes: Hono and Express', () => {
  const hono = "app.get('/api/audit', c => c.json({}))";
  const express = "router.post('/api/items', createItem)";
  assert.strictEqual(extractServerRoutes(hono)[0].framework, 'hono/express');
  assert.strictEqual(extractServerRoutes(hono)[0].path, '/api/audit');
  assert.strictEqual(extractServerRoutes(express)[0].method, 'POST');
});

test('extractPersistence: Prisma, TypeORM, raw SQL', () => {
  assert.strictEqual(extractPersistence("prisma.user.findMany()")[0].orm, 'prisma');
  assert.strictEqual(extractPersistence("const r = dataSource.getRepository(Todo)")[0].orm, 'typeorm');
  assert.strictEqual(extractPersistence("@Entity('todos') class Todo {}")[0].target, 'todos');
  const sql = extractPersistence("db.query('SELECT * FROM orders WHERE id = 1')")[0];
  assert.strictEqual(sql.orm, 'sql');
  assert.strictEqual(sql.target, 'orders');
});

test('extractDispatches: outbound http and spawn', () => {
  assert.strictEqual(extractDispatches("fetch('http://svc.local/x')")[0].kind, 'dispatches');
  assert.strictEqual(extractDispatches("child_process.spawn('node')")[0].kind, 'dispatches');
  assert.strictEqual(extractDispatches("fetch('/api/local')").length, 0);
});

test('normalizeRoutePath', () => {
  assert.strictEqual(normalizeRoutePath('/api/todos/'), '/api/todos');
  assert.strictEqual(normalizeRoutePath('api/todos?x=1'), '/api/todos');
  assert.strictEqual(normalizeRoutePath('/api//todos'), '/api/todos');
});

test('matchUrlToRoute: exact and param', () => {
  const routes = [{ path: '/api/todos/:id' }, { path: '/api/users' }];
  const exact = matchUrlToRoute('/api/users', routes);
  assert.strictEqual(exact.score, 1.0);
  const param = matchUrlToRoute('/api/todos/123', routes);
  assert.strictEqual(param.route.path, '/api/todos/:id');
  assert.strictEqual(param.score, 0.8);
  assert.strictEqual(matchUrlToRoute('/nope', routes).route, null);
});

test('classifyLayer', () => {
  assert.strictEqual(classifyLayer('fe-polar/src/app/x.component.ts'), 'frontend');
  assert.strictEqual(classifyLayer('comparador-bff/src/app.ts'), 'bff');
  assert.strictEqual(classifyLayer('apps/api/src/main.ts'), 'api');
  assert.strictEqual(classifyLayer('open-design/apps/daemon/main.ts'), 'microservice');
  assert.strictEqual(classifyLayer('api/src/todo.entity.ts'), 'db');
});

test('CROSS_LAYER_EDGE_KINDS includes new kinds', () => {
  for (const k of ['serves', 'persists', 'dispatches']) assert.ok(CROSS_LAYER_EDGE_KINDS.includes(k));
});

test('Integration T1: Angular FE -> NestJS -> TypeORM', () => {
  const tmp = fixture({
    'fe/todo.component.ts': "export class TodoComponent { save() { this.http.post('/api/todos', {}); } }",
    'api/todo.controller.ts': "@Controller('api') export class C { @Post('todos') save() { return prisma.todo.create({}); } }",
  });
  try {
    const chain = traceCrossLayer({ repoRoot: tmp, start: 'fe/todo.component.ts' });
    assert.ok(chain.some(n => n.kind === 'routes_to'));
    assert.ok(chain.some(n => n.kind === 'serves' && n.framework === 'nestjs'));
    assert.ok(chain.some(n => n.kind === 'persists'));
  } finally {
    fs.rmSync(tmp, { recursive: true });
  }
});

test('Integration T2: React FE -> Hono -> Prisma', () => {
  const tmp = fixture({
    'scrap-audit/fe/src/api-client.ts': "export const get = () => fetchJson('/api/audit');",
    'scrap-audit/api/src/routes.ts': "app.get('/api/audit', async c => { const r = await prisma.audit.findMany(); return c.json(r); });",
  });
  try {
    const chain = traceCrossLayer({ repoRoot: tmp, start: 'scrap-audit/fe/src/api-client.ts' });
    assert.ok(chain.some(n => n.kind === 'serves' && n.framework === 'hono/express'));
    assert.ok(chain.some(n => n.kind === 'persists' && n.symbol === 'audit'));
  } finally {
    fs.rmSync(tmp, { recursive: true });
  }
});

test('Integration T4: FE -> api -> microservice -> db (multi-hop)', () => {
  const tmp = fixture({
    'fe/app.ts': "export const run = () => fetch('/api/orders');",
    'services/api/src/orders.ts': "app.post('/api/orders', h);\nfetch('/daemon/process');",
    'apps/daemon/src/main.ts': "app.get('/daemon/process', h);\nprisma.job.create({});",
  });
  try {
    const chain = traceCrossLayer({ repoRoot: tmp, start: 'fe/app.ts' });
    assert.ok(chain.some(n => n.kind === 'serves' && n.layer === 'api'));
    assert.ok(chain.some(n => n.kind === 'dispatches'));
    assert.ok(chain.some(n => n.kind === 'serves' && n.layer === 'microservice'));
    assert.ok(chain.some(n => n.kind === 'persists'));
  } finally {
    fs.rmSync(tmp, { recursive: true });
  }
});

test('Partial chain: unmatched url degrades safely', () => {
  const tmp = fixture({ 'api/routes.ts': "app.get('/api/known', h);" });
  try {
    const chain = traceCrossLayer({ repoRoot: tmp, url: '/api/unknown' });
    assert.ok(Array.isArray(chain));
    assert.strictEqual(chain.length, 0);
  } finally {
    fs.rmSync(tmp, { recursive: true });
  }
});
