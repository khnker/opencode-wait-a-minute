import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PERMISSION_TYPES,
  derivePermissionPlan,
  ensurePermissionPlan,
  permissionPreflightLines,
  grantPermissionPlan,
  denyPermissionPlan,
  decidePermission,
  delegationBlocked,
} from "./permission-preflight.js";

const approvedState = (extra = {}) => ({
  contract: { status: "APPROVED" },
  objective: "implement the feature",
  requirements: [],
  ...extra,
});

test("derive: edit only when a contract exists", () => {
  const plan = derivePermissionPlan({ state: approvedState() });
  assert.deepEqual(plan.required, [{ type: "edit", reason: "La implementación aprobada requiere editar archivos" }]);
  assert.equal(plan.status, "pending");
  assert.deepEqual(plan.granted, []);
  assert.equal(plan.approvedAt, null);
});

test("derive: adds bash when text mentions commands", () => {
  const plan = derivePermissionPlan({ state: approvedState(), promptText: "run the tests" });
  assert.deepEqual(plan.required.map((p) => p.type), ["edit", "bash"]);
});

test("derive: adds webfetch when text contains a URL or docs", () => {
  const plan = derivePermissionPlan({ state: approvedState(), promptText: "read https://example.com" });
  assert.deepEqual(plan.required.map((p) => p.type), ["edit", "webfetch"]);
});

test("derive: adds external_directory for paths outside the project", () => {
  const plan = derivePermissionPlan({ state: approvedState(), promptText: "write to /tmp/out" });
  assert.deepEqual(plan.required.map((p) => p.type), ["edit", "external_directory"]);
});

test("derive: dedupes and keeps PERMISSION_TYPES order", () => {
  const state = approvedState({
    requirements: [{ title: "run npm test" }, { title: "npm test again" }],
    verification: "curl https://example.com and read /home/user/file",
  });
  const plan = derivePermissionPlan({ state, promptText: "run npm test https://example.com /tmp/x" });
  assert.deepEqual(plan.required.map((p) => p.type), PERMISSION_TYPES);
  assert.equal(new Set(plan.required.map((p) => p.type)).size, plan.required.length);
});

test("ensure: no plan without an APPROVED contract", () => {
  assert.equal(ensurePermissionPlan({ contract: { status: "PROPOSED" } }), null);
  assert.equal(ensurePermissionPlan({}), null);
});

test("ensure: creates once and preserves grant status", () => {
  const state = approvedState();
  const plan = ensurePermissionPlan(state);
  assert.ok(plan);
  assert.equal(state.permissionPreflight, plan);
  grantPermissionPlan(state, { at: 123 });
  assert.equal(ensurePermissionPlan(state).status, "granted");
});

test("lines: empty when granted or nothing required", () => {
  assert.deepEqual(permissionPreflightLines(null), []);
  assert.deepEqual(permissionPreflightLines({ required: [], status: "pending" }), []);
  assert.deepEqual(permissionPreflightLines({ required: [{ type: "edit" }], status: "granted" }), []);
});

test("lines: renders header, items and commands", () => {
  const lines = permissionPreflightLines({
    required: [{ type: "edit", reason: "x" }, { type: "bash", reason: "y" }],
    status: "pending",
  });
  assert.equal(lines[0], "🔐 [wait-a-minute] PERMISOS REQUERIDOS ANTES DE DELEGAR");
  assert.deepEqual(lines.slice(1, 3), ["- edit: x", "- bash: y"]);
  assert.match(lines.at(-1), /\/wam permissions approve/);
});

test("grant and deny set status and timestamp", () => {
  const state = approvedState();
  ensurePermissionPlan(state, { promptText: "run tests" });
  const granted = grantPermissionPlan(state, { at: 42 });
  assert.equal(granted.status, "granted");
  assert.deepEqual(granted.granted, ["edit", "bash"]);
  assert.equal(granted.approvedAt, 42);

  const denied = denyPermissionPlan(state, { at: 43 });
  assert.equal(denied.status, "denied");
  assert.deepEqual(denied.granted, []);
  assert.equal(denied.approvedAt, 43);
  assert.equal(denyPermissionPlan({}), null);
});

test("decidePermission: allow only for granted types", () => {
  const plan = { status: "granted", granted: ["edit"], required: [{ type: "edit" }] };
  assert.equal(decidePermission({ permission: { type: "edit" }, plan }), "allow");
  assert.equal(decidePermission({ permission: { type: "bash" }, plan }), "ask");
  assert.equal(decidePermission({ permission: { type: "edit" }, plan: { ...plan, status: "pending" } }), "ask");
  assert.equal(decidePermission({}), "ask");
});

test("delegationBlocked: pending blocks, granted does not", () => {
  const state = approvedState();
  ensurePermissionPlan(state);
  assert.equal(delegationBlocked(state).blocked, true);
  grantPermissionPlan(state);
  assert.equal(delegationBlocked(state).blocked, false);
  assert.equal(delegationBlocked({}).blocked, false);
});
