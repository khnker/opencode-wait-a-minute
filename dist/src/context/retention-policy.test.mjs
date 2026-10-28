import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildReferenceIndex,
  planRetention,
  applyRetentionPlan,
} from "./retention-policy.js";

function item(id, retention, extra = {}) {
  return {
    id,
    retention,
    kind: "OBSERVATION",
    status: "active",
    sourceRefs: [`ref:${id}`],
    relations: [],
    ...extra,
  };
}

function ids(entries) {
  return entries.map((entry) => entry.id);
}

test("active and durable items are never pruned", () => {
  const items = [
    item("a", "active"),
    item("d", "durable"),
    item("e", "ephemeral"),
  ];

  const plan = planRetention(items);

  assert.deepEqual(plan.keep, ["a", "d"]);
  assert.deepEqual(plan.archive, []);
  assert.deepEqual(plan.discard, ["e"]);
});

test("archivable items are archived with sourceRefs preserved", () => {
  const items = [item("arch", "archivable", { sourceRefs: ["ref:arch"] })];
  const plan = planRetention(items);
  const applied = applyRetentionPlan(items, plan);

  assert.deepEqual(plan.archive, ["arch"]);
  assert.deepEqual(plan.discard, []);
  assert.equal(applied.archived.length, 1);
  assert.deepEqual(applied.archived[0].sourceRefs, ["ref:arch"]);
});

test("archivable referenced by a live item is kept, never discarded", () => {
  const items = [
    item("live", "active", { relations: [{ type: "supports", targetId: "arch" }] }),
    item("arch", "archivable"),
  ];

  const plan = planRetention(items);

  assert.ok(plan.keep.includes("arch"));
  assert.ok(!plan.archive.includes("arch"));
  assert.ok(!plan.discard.includes("arch"));
});

test("unreferenced ephemeral items are discarded", () => {
  const items = [item("e1", "ephemeral"), item("e2", "ephemeral")];
  const plan = planRetention(items);

  assert.deepEqual(plan.discard, ["e1", "e2"]);
  assert.deepEqual(plan.blocked, []);
});

test("ephemeral referenced by a live item is blocked and kept", () => {
  const items = [
    item("live", "durable", { relations: [{ type: "supports", targetId: "e1" }] }),
    item("e1", "ephemeral"),
  ];

  const plan = planRetention(items);

  assert.deepEqual(plan.discard, []);
  assert.ok(plan.keep.includes("e1"));
  assert.equal(plan.blocked.length, 1);
  assert.equal(plan.blocked[0].id, "e1");
  assert.match(plan.blocked[0].reason, /live item/);
});

test("sole evidence for a live claim blocks discard", () => {
  const items = [
    item("claim", "durable", { kind: "CLAIM", status: "active" }),
    item("ev", "ephemeral", {
      kind: "EVIDENCE",
      relations: [{ type: "supports", targetId: "claim" }],
    }),
  ];

  const plan = planRetention(items);

  assert.deepEqual(plan.discard, []);
  assert.ok(plan.keep.includes("ev"));
  assert.equal(plan.blocked.length, 1);
  assert.equal(plan.blocked[0].id, "ev");
  assert.match(plan.blocked[0].reason, /sole justification/);
  assert.match(plan.blocked[0].reason, /claim/);
});

test("two evidence items for the same claim allow archiving one", () => {
  const items = [
    item("claim", "durable", { kind: "REQUIREMENT", status: "active" }),
    item("ev1", "ephemeral", {
      kind: "EVIDENCE",
      relations: [{ type: "supports", targetId: "claim" }],
    }),
    item("ev2", "archivable", {
      kind: "EVIDENCE",
      relations: [{ type: "supports", targetId: "claim" }],
    }),
  ];

  const plan = planRetention(items);

  assert.ok(!plan.blocked.some((entry) => entry.id === "ev1"));
  assert.ok(plan.discard.includes("ev1"));
  assert.ok(plan.archive.includes("ev2"));
});

test("invalidated or superseded claims free their evidence", () => {
  for (const status of ["invalidated", "superseded"]) {
    const items = [
      item("claim", "durable", { kind: "CLAIM", status }),
      item("ev", "ephemeral", {
        kind: "EVIDENCE",
        relations: [{ type: "supports", targetId: "claim" }],
      }),
    ];

    const plan = planRetention(items);

    assert.deepEqual(plan.discard, ["ev"], `status=${status}`);
    assert.deepEqual(plan.blocked, [], `status=${status}`);
  }
});

test("canDiscard override is respected", () => {
  const items = [item("e1", "ephemeral"), item("e2", "ephemeral")];
  const plan = planRetention(items, {
    canDiscard: (candidate) => candidate.id !== "e2",
  });

  assert.deepEqual(plan.discard, ["e1"]);
  assert.ok(plan.keep.includes("e2"));
  assert.equal(plan.blocked[0].id, "e2");
  assert.match(plan.blocked[0].reason, /canDiscard/);
});

test("plan output is sorted and deterministic regardless of input order", () => {
  const items = [
    item("z", "ephemeral"),
    item("a", "active"),
    item("m", "archivable"),
    item("b", "durable"),
  ];

  const first = planRetention(items);
  const second = planRetention([...items].reverse());

  assert.deepEqual(first.keep, ["a", "b"]);
  assert.deepEqual(first.archive, ["m"]);
  assert.deepEqual(first.discard, ["z"]);
  assert.deepEqual(first, second);
});

test("applyRetentionPlan does not mutate inputs and returns new arrays", () => {
  const items = [
    item("a", "active"),
    item("m", "archivable"),
    item("z", "ephemeral"),
  ];
  const snapshot = structuredClone(items);
  const plan = planRetention(items);
  const applied = applyRetentionPlan(items, plan);

  assert.deepEqual(items, snapshot);
  assert.deepEqual(ids(applied.kept), ["a"]);
  assert.deepEqual(ids(applied.archived), ["m"]);
  assert.deepEqual(ids(applied.discarded), ["z"]);
  assert.notEqual(applied.kept, plan.keep);
});

test("dangling relation targets do not throw", () => {
  const items = [
    item("e1", "ephemeral", {
      relations: [
        { type: "supports", targetId: "missing" },
        { type: "supports", targetId: "" },
        { type: "supports" },
        null,
      ],
    }),
  ];

  assert.doesNotThrow(() => buildReferenceIndex(items));
  const plan = planRetention(items);
  assert.deepEqual(plan.discard, ["e1"]);
});

test("relation cycles are indexed without recursion", () => {
  const items = [
    item("a", "archivable", { relations: [{ type: "supports", targetId: "b" }] }),
    item("b", "archivable", { relations: [{ type: "supports", targetId: "a" }] }),
  ];

  const index = buildReferenceIndex(items);
  const plan = planRetention(items);

  assert.deepEqual(index.referencedBy.get("a"), [{ id: "b", relation: "supports" }]);
  assert.deepEqual(index.referencedBy.get("b"), [{ id: "a", relation: "supports" }]);
  assert.deepEqual(plan.archive, ["a", "b"]);
});
