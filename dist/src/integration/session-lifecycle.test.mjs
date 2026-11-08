import test from "node:test";
import assert from "node:assert/strict";

import { registerSessionLifecycle, unregisterSessionLifecycle } from "./session-lifecycle.js";

function makeMaps() {
  return {
    sessionRoots: new Map(),
    sessionWamRoots: new Map(),
    sessionParents: new Map(),
    sessionTitles: new Map(),
    sessionResolved: new Set(),
  };
}

test("register without a session id reports the missing id", () => {
  const maps = makeMaps();
  const result = registerSessionLifecycle({ maps });
  assert.deepEqual(result, { registered: false, reason: "missing-session-id" });
  assert.equal(maps.sessionResolved.size, 0);
});

test("register populates maps and ensures the session root", () => {
  const maps = makeMaps();
  const ensured = [];
  const result = registerSessionLifecycle({
    sessionID: "ses-1",
    directory: "/project",
    info: { parentID: "ses-parent", title: "WAM ANALYST" },
    maps,
    ensureRoot: (root) => ensured.push(root),
  });
  assert.deepEqual(result, { registered: true, root: "/project" });
  assert.equal(maps.sessionRoots.get("ses-1"), "/project");
  assert.equal(maps.sessionWamRoots.get("ses-1"), "/project");
  assert.equal(maps.sessionParents.get("ses-1"), "ses-parent");
  assert.equal(maps.sessionTitles.get("ses-1"), "WAM ANALYST");
  assert.equal(maps.sessionResolved.has("ses-1"), true);
  assert.deepEqual(ensured, ["/project"]);
});

test("double register does not duplicate state", () => {
  const maps = makeMaps();
  const ensured = [];
  registerSessionLifecycle({
    sessionID: "ses-1",
    directory: "/project",
    info: { parentID: "ses-parent", title: "WAM ANALYST" },
    maps,
    ensureRoot: (root) => ensured.push(root),
  });
  const sizes = {
    roots: maps.sessionRoots.size,
    wamRoots: maps.sessionWamRoots.size,
    parents: maps.sessionParents.size,
    titles: maps.sessionTitles.size,
    resolved: maps.sessionResolved.size,
  };
  const second = registerSessionLifecycle({
    sessionID: "ses-1",
    directory: "/project",
    info: { parentID: "ses-parent", title: "WAM ANALYST" },
    maps,
    ensureRoot: (root) => ensured.push(root),
  });
  assert.equal(second.registered, false);
  assert.deepEqual(
    {
      roots: maps.sessionRoots.size,
      wamRoots: maps.sessionWamRoots.size,
      parents: maps.sessionParents.size,
      titles: maps.sessionTitles.size,
      resolved: maps.sessionResolved.size,
    },
    sizes,
  );
});

test("unregister clears maps and invokes lifecycle callbacks", () => {
  const maps = makeMaps();
  registerSessionLifecycle({
    sessionID: "ses-1",
    directory: "/project",
    info: { parentID: "ses-parent", title: "WAM ANALYST" },
    maps,
  });
  const removed = [];
  const closed = [];
  const result = unregisterSessionLifecycle({
    sessionID: "ses-1",
    maps,
    removeSessionState: (event) => removed.push(event),
    closeSession: (event) => closed.push(event),
  });
  assert.equal(result.removed, true);
  assert.equal(maps.sessionRoots.has("ses-1"), false);
  assert.equal(maps.sessionWamRoots.has("ses-1"), false);
  assert.equal(maps.sessionParents.has("ses-1"), false);
  assert.equal(maps.sessionTitles.has("ses-1"), false);
  assert.equal(maps.sessionResolved.has("ses-1"), false);
  assert.deepEqual(removed, [{ sessionID: "ses-1", root: "/project" }]);
  assert.deepEqual(closed, [{ sessionId: "ses-1" }]);
});
