import test from "node:test";
import assert from "node:assert/strict";

import { shouldBlockForPendingPermission } from "./permission-preflight.js";

const pendingEdit = { status: "pending", required: [{ type: "edit" }] };

test("blocks a mutating tool when enforcement is on and the pending plan needs edit", () => {
  assert.equal(shouldBlockForPendingPermission({ tool: "write", enforce: true, plan: pendingEdit }), true);
  assert.equal(shouldBlockForPendingPermission({ tool: "edit", enforce: true, plan: pendingEdit }), true);
});

test("does not block read tools", () => {
  assert.equal(shouldBlockForPendingPermission({ tool: "read", enforce: true, plan: pendingEdit }), false);
});

test("does not block when the plan is already granted", () => {
  assert.equal(
    shouldBlockForPendingPermission({ tool: "write", enforce: true, plan: { ...pendingEdit, status: "granted" } }),
    false,
  );
});

test("does not block when enforcement is disabled", () => {
  assert.equal(shouldBlockForPendingPermission({ tool: "write", enforce: false, plan: pendingEdit }), false);
});

test("ignores mismatched permission types", () => {
  const pendingBash = { status: "pending", required: [{ type: "bash" }] };
  assert.equal(shouldBlockForPendingPermission({ tool: "write", enforce: true, plan: pendingBash }), false);
  assert.equal(shouldBlockForPendingPermission({ tool: "bash", enforce: true, plan: pendingBash }), true);
});
