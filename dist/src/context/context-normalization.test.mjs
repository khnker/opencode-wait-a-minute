import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CONTEXT_KINDS,
  CONTEXT_SCOPE_TYPES,
  CONTEXT_STATUSES,
  RELATION_TYPES,
  RETENTION_POLICIES,
  normalizeContextItem,
  normalizeItem,
  validateContextItem,
} from "./context-normalization.js";

const legacy = {
  id: "rec-1",
  type: "tool_call",
  source: "opencode",
  timestamp: 1700000000000,
  scope: "LOCAL",
  content: { toolName: "bash", params: { command: "ls" } },
  metadata: {},
};

function validItem(overrides = {}) {
  return {
    id: "item-1",
    kind: "FACT",
    status: "active",
    retention: "durable",
    scopeType: "session",
    scopeId: "sess-1",
    sourceRefs: [],
    relations: [],
    ...overrides,
  };
}

describe("context item enums", () => {
  it("reuses the classification categories verbatim", () => {
    assert.deepEqual(CONTEXT_KINDS, [
      "FACT", "OBSERVATION", "CLAIM", "ASSUMPTION", "DECISION",
      "REQUIREMENT", "EVIDENCE", "ERROR", "ACTION", "RESULT",
    ]);
    assert.ok(Object.isFrozen(CONTEXT_KINDS));
  });

  it("exposes the frozen scope, status, retention and relation sets", () => {
    assert.deepEqual(CONTEXT_SCOPE_TYPES, ["project", "group", "task", "session"]);
    assert.deepEqual(RETENTION_POLICIES, ["active", "durable", "archivable", "ephemeral"]);
    assert.deepEqual(CONTEXT_STATUSES, [
      "proposed", "accepted", "rejected", "active", "superseded", "invalidated",
    ]);
    assert.deepEqual(RELATION_TYPES, [
      "derived_from", "supports", "contradicts", "supersedes", "depends_on",
    ]);
    for (const set of [CONTEXT_SCOPE_TYPES, RETENTION_POLICIES, CONTEXT_STATUSES, RELATION_TYPES]) {
      assert.ok(Object.isFrozen(set));
    }
  });
});

describe("validateContextItem rejections", () => {
  it("accepts a well-formed item", () => {
    assert.deepEqual(validateContextItem(validItem()), { ok: true, errors: [] });
  });

  it("rejects an unknown kind", () => {
    const result = validateContextItem(validItem({ kind: "OPINION" }));
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /kind/);
  });

  it("rejects an unknown status", () => {
    const result = validateContextItem(validItem({ status: "maybe" }));
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /status/);
  });

  it("rejects an unknown retention", () => {
    const result = validateContextItem(validItem({ retention: "forever" }));
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /retention/);
  });

  it("rejects a missing, unknown or empty scope", () => {
    for (const scope of [
      { scopeType: undefined, scopeId: "sess-1" },
      { scopeType: "galaxy", scopeId: "sess-1" },
      { scopeType: "task", scopeId: "" },
      { scope: { type: "task", id: "  " } },
    ]) {
      const result = validateContextItem(validItem(scope));
      assert.equal(result.ok, false, JSON.stringify(scope));
      assert.match(result.errors.join("\n"), /scope/);
    }
  });

  it("accepts an object scope instead of scopeType/scopeId", () => {
    const item = validItem();
    delete item.scopeType;
    delete item.scopeId;
    item.scope = { type: "group", id: "group-1" };
    assert.deepEqual(validateContextItem(item), { ok: true, errors: [] });
  });

  it("rejects malformed sourceRefs", () => {
    for (const sourceRefs of ["src/a.js", ["ok", ""], ["ok", 42], [null]]) {
      const result = validateContextItem(validItem({ sourceRefs }));
      assert.equal(result.ok, false, JSON.stringify(sourceRefs));
      assert.match(result.errors.join("\n"), /sourceRefs/);
    }
  });

  it("rejects malformed relations", () => {
    for (const relations of [
      "supports",
      [{ type: "likes", targetId: "x" }],
      [{ type: "supports", targetId: "" }],
      [{ type: "supports" }],
      [null],
    ]) {
      const result = validateContextItem(validItem({ relations }));
      assert.equal(result.ok, false, JSON.stringify(relations));
      assert.match(result.errors.join("\n"), /relations/);
    }
  });

  it("fails soft for non-objects instead of throwing", () => {
    for (const value of [null, undefined, "text", 42]) {
      const result = validateContextItem(value);
      assert.equal(result.ok, false);
      assert.equal(result.errors.length, 1);
    }
  });
});

describe("normalizeContextItem", () => {
  it("keeps every legacy field and adds safe defaults", () => {
    const item = normalizeContextItem(legacy);

    assert.equal(item.id, "rec-1");
    assert.equal(item.type, "tool_call");
    assert.equal(item.source, "opencode");
    assert.equal(item.timestamp, 1700000000000);
    assert.equal(item.scope, "LOCAL");
    assert.deepEqual(item.metadata, {});
    assert.deepEqual(item.relatedRequirements, []);
    assert.equal(typeof item.content, "string");

    assert.ok(CONTEXT_KINDS.includes(item.kind));
    assert.equal(item.status, "active");
    assert.ok(RETENTION_POLICIES.includes(item.retention));
    assert.deepEqual(item.sourceRefs, []);
    assert.deepEqual(item.relations, []);
    assert.equal(item.scopeType, "session");
    assert.equal(item.scopeId, "rec-1");
    assert.deepEqual(validateContextItem(item), { ok: true, errors: [] });
  });

  it("defaults a missing scope to session", () => {
    const item = normalizeContextItem({ id: "rec-2", type: "agent_message", content: "hi" });
    assert.equal(item.scope, "session");
    assert.equal(item.scopeType, "session");
    assert.equal(item.scopeId, "rec-2");
  });

  it("maps existing scope names onto scope types", () => {
    const expectations = {
      PROJECT: "project",
      GLOBAL: "project",
      TASK: "task",
      REQUIREMENT: "task",
      ACTION: "task",
      SESSION: "session",
      TURN: "session",
      LOCAL: "session",
    };
    for (const [scope, scopeType] of Object.entries(expectations)) {
      const item = normalizeContextItem({ ...legacy, id: `rec-${scope}`, scope });
      assert.equal(item.scopeType, scopeType, scope);
    }
  });

  it("derives retention from an explicit kind", () => {
    assert.equal(normalizeContextItem({ ...legacy, kind: "DECISION" }).retention, "durable");
    assert.equal(normalizeContextItem({ ...legacy, kind: "OBSERVATION" }).retention, "archivable");
    assert.equal(normalizeContextItem({ ...legacy, kind: "ERROR" }).retention, "active");
  });

  it("honours valid explicit kind, status and retention", () => {
    const item = normalizeContextItem({
      ...legacy,
      kind: "EVIDENCE",
      status: "superseded",
      retention: "ephemeral",
    });
    assert.equal(item.kind, "EVIDENCE");
    assert.equal(item.status, "superseded");
    assert.equal(item.retention, "ephemeral");
  });

  it("drops malformed sourceRefs and relations instead of failing", () => {
    const item = normalizeContextItem({
      ...legacy,
      sourceRefs: ["src/a.js", "", 42, "src/a.js", "  src/b.js  "],
      relations: [
        { type: "supports", targetId: "req-1" },
        { type: "likes", targetId: "req-1" },
        { type: "supports", targetId: "" },
        { type: "supports", targetId: "req-1" },
      ],
    });
    assert.deepEqual(item.sourceRefs, ["src/a.js", "src/b.js"]);
    assert.deepEqual(item.relations, [{ type: "supports", targetId: "req-1" }]);
    assert.deepEqual(validateContextItem(item), { ok: true, errors: [] });
  });

  it("is idempotent", () => {
    const once = normalizeContextItem(legacy);
    const twice = normalizeContextItem(once);
    assert.deepEqual(twice, once);

    const rich = normalizeContextItem({
      ...legacy,
      kind: "DECISION",
      status: "accepted",
      retention: "durable",
      scopeType: "task",
      scopeId: "task-9",
      sourceRefs: ["src/context/context-normalization.js"],
      relations: [{ type: "derived_from", targetId: "rec-0" }],
    });
    assert.deepEqual(normalizeContextItem(rich), rich);
  });

  it("exposes normalizeItem as the extended contract alias", () => {
    assert.equal(normalizeItem, normalizeContextItem);
  });
});
