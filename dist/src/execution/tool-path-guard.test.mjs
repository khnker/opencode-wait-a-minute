import test from "node:test";
import assert from "node:assert/strict";

import {
  CHILD_PATH_TOOLS,
  checkToolPath,
  isPathInsideRoot,
  toolPathArgs,
} from "./tool-path-guard.js";

const root = "/repo/project";

test("exposes the guarded child tools", () => {
  assert.ok(CHILD_PATH_TOOLS.has("read"));
  assert.ok(CHILD_PATH_TOOLS.has("bash"));
  assert.equal(CHILD_PATH_TOOLS.has("webfetch"), false);
});

test("extracts filePath, path or directory", () => {
  assert.equal(toolPathArgs({ filePath: "a.js" }), "a.js");
  assert.equal(toolPathArgs({ path: "src" }), "src");
  assert.equal(toolPathArgs({ directory: "lib" }), "lib");
  assert.equal(toolPathArgs({}), null);
  assert.equal(toolPathArgs({ path: 42 }), null);
});

test("allows a relative path that resolves under the root", () => {
  const decision = checkToolPath({
    tool: "read",
    args: { filePath: "src/a.js" },
    projectRoot: root,
    isChild: true,
  });
  assert.deepEqual(decision, { allowed: true, path: `${root}/src/a.js` });
});

test("allows an absolute path inside the root", () => {
  const decision = checkToolPath({
    tool: "read",
    args: { filePath: `${root}/src/a.js` },
    projectRoot: root,
    isChild: true,
  });
  assert.deepEqual(decision, { allowed: true, path: `${root}/src/a.js` });
});

test("denies an absolute path outside the root", () => {
  const decision = checkToolPath({
    tool: "read",
    args: { filePath: "/etc/passwd" },
    projectRoot: root,
    isChild: true,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.path, "/etc/passwd");
  assert.equal(decision.reason, "path-outside-project-root");
});

test("denies a .. escape", () => {
  const decision = checkToolPath({
    tool: "write",
    args: { filePath: "../outside.js" },
    projectRoot: root,
    isChild: true,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.path, "/repo/outside.js");
  assert.equal(decision.reason, "path-outside-project-root");
});

test("allows a call with no path argument", () => {
  const decision = checkToolPath({
    tool: "grep",
    args: { pattern: "x" },
    projectRoot: root,
    isChild: true,
  });
  assert.deepEqual(decision, { allowed: true, path: null });
});

test("inspects cwd for shell tools and ignores command text", () => {
  const outside = checkToolPath({
    tool: "bash",
    args: { command: "cat /etc/passwd", cwd: "/tmp" },
    projectRoot: root,
    isChild: true,
  });
  assert.equal(outside.allowed, false);
  assert.equal(outside.path, "/tmp");

  const inside = checkToolPath({
    tool: "bash",
    args: { command: "cat /etc/passwd" },
    projectRoot: root,
    isChild: true,
  });
  assert.deepEqual(inside, { allowed: true, path: null });
});

test("bypasses enforcement for non-child sessions and unknown tools", () => {
  assert.deepEqual(
    checkToolPath({ tool: "read", args: { filePath: "/etc/passwd" }, projectRoot: root }),
    { allowed: true, path: null },
  );
  assert.deepEqual(
    checkToolPath({ tool: "webfetch", args: { path: "/etc/passwd" }, projectRoot: root, isChild: true }),
    { allowed: true, path: null },
  );
});

test("isPathInsideRoot compares resolved paths", () => {
  assert.equal(isPathInsideRoot(`${root}/a`, root), true);
  assert.equal(isPathInsideRoot(root, root), true);
  assert.equal(isPathInsideRoot("/repo/project-other", root), false);
  assert.equal(isPathInsideRoot("", root), false);
  assert.equal(isPathInsideRoot(42, root), false);
});
