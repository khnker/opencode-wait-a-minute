import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRoutePath,
  matchUrlToRoute,
  classifyLayer
} from '../src/cross-layer-tracer.js';

test('normalizeRoutePath strips query strings and trailing slashes', () => {
  assert.equal(normalizeRoutePath('/api/todos?x=1&y=2'), '/api/todos');
  assert.equal(normalizeRoutePath('/api/todos/'), '/api/todos');
  assert.equal(normalizeRoutePath('/api/todos/?q=1'), '/api/todos');
  assert.equal(normalizeRoutePath('//api///todos//'), '/api/todos');
});

test('normalizeRoutePath prefixes a leading slash and handles empty input', () => {
  assert.equal(normalizeRoutePath('api/todos'), '/api/todos');
  assert.equal(normalizeRoutePath(''), '');
  assert.equal(normalizeRoutePath(null), '');
  assert.equal(normalizeRoutePath(undefined), '');
  assert.equal(normalizeRoutePath('/'), '');
  assert.equal(normalizeRoutePath('///'), '');
});

test('matchUrlToRoute returns exact match with score 1.0', () => {
  const routes = [{ path: '/api/todos' }, { path: '/api/users' }];
  const m = matchUrlToRoute('/api/todos', routes);
  assert.equal(m.score, 1.0);
  assert.equal(m.route.path, '/api/todos');
});

test('matchUrlToRoute normalizes url and route before matching', () => {
  const routes = [{ path: '/api/todos/' }];
  const m = matchUrlToRoute('/api/todos?page=2', routes);
  assert.equal(m.score, 1.0);
  assert.equal(m.route.path, '/api/todos/');
});

test('matchUrlToRoute matches param routes with score 0.8', () => {
  const routes = [{ path: '/api/:id' }];
  const m = matchUrlToRoute('/api/42', routes);
  assert.equal(m.score, 0.8);
  assert.equal(m.route.path, '/api/:id');
});

test('matchUrlToRoute returns no-match with score 0.0', () => {
  const m = matchUrlToRoute('/api/unknown', [{ path: '/api/todos' }]);
  assert.equal(m.score, 0.0);
  assert.equal(m.route, null);
});

test('matchUrlToRoute handles empty input', () => {
  // When url is empty string, it normalizes to '' and matches a route that also normalizes to '' (like '/')
  assert.equal(matchUrlToRoute('', [{ path: '/' }]).score, 1.0);
  // When url is non-empty but routes is empty, score is 0
  assert.equal(matchUrlToRoute('/x', []).score, 0.0);
  // When url is null, it becomes '' and matches a route that normalizes to '' (like '/')
  assert.equal(matchUrlToRoute(null, [{ path: '/' }]).score, 1.0);
});

test('matchUrlToRoute prefers exact match over param match', () => {
  const routes = [{ path: '/api/:id' }, { path: '/api/me' }];
  const m = matchUrlToRoute('/api/me', routes);
  assert.equal(m.score, 1.0);
  assert.equal(m.route.path, '/api/me');
});

test('classifyLayer maps known layer prefixes', () => {
  assert.equal(classifyLayer('src/bff/gateway.ts'), 'bff');
  assert.equal(classifyLayer('src/fe/app.component.ts'), 'frontend');
  assert.equal(classifyLayer('src/web/main.ts'), 'frontend');
  assert.equal(classifyLayer('src/apps/web/page.ts'), 'frontend');
  assert.equal(classifyLayer('src/todo.component.ts'), 'frontend');
  assert.equal(classifyLayer('src/daemon/worker.ts'), 'microservice');
  assert.equal(classifyLayer('src/worker/jobs.ts'), 'microservice');
  assert.equal(classifyLayer('src/server/main.ts'), 'microservice');
  assert.equal(classifyLayer('src/db/schema.prisma'), 'db');
  assert.equal(classifyLayer('src/migrations/001_init.sql'), 'db');
  assert.equal(classifyLayer('src/todo.entity.ts'), 'db');
  assert.equal(classifyLayer('src/user.repository.ts'), 'db');
  assert.equal(classifyLayer('src/api/controller.ts'), 'api');
  assert.equal(classifyLayer('src/apps/api/routes.ts'), 'api');
  assert.equal(classifyLayer('src/packages/api/client.ts'), 'api');
  assert.equal(classifyLayer('src/todo.controller.ts'), 'api');
  assert.equal(classifyLayer('src/todo.route.ts'), 'api');
});

test('classifyLayer defaults to service and handles empty/invalid input', () => {
  assert.equal(classifyLayer('src/lib/util.ts'), 'service');
  assert.equal(classifyLayer(''), 'service');
  assert.equal(classifyLayer(null), 'service');
  assert.equal(classifyLayer(undefined), 'service');
  assert.equal(classifyLayer(123), 'service');
});
