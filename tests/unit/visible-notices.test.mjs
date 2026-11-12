import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_VISIBLE_NOTICES_PER_SESSION,
  enqueueVisibleNotice,
  drainVisibleNotices,
  buildVisibleNoticePart,
  updateVisibleNoticePart,
} from "../../src/integration/visible-notices.js";

test("enqueueVisibleNotice dedupes exact text per session", () => {
  const store = new Map();
  assert.equal(enqueueVisibleNotice(store, "s1", "hola"), true);
  assert.equal(enqueueVisibleNotice(store, "s1", "hola"), false);
  assert.deepEqual(store.get("s1"), ["hola"]);
});

test("enqueueVisibleNotice caps at the limit dropping oldest", () => {
  const store = new Map();
  for (let i = 1; i <= MAX_VISIBLE_NOTICES_PER_SESSION + 2; i++) {
    enqueueVisibleNotice(store, "s1", `aviso ${i}`);
  }
  assert.deepEqual(store.get("s1"), ["aviso 3", "aviso 4", "aviso 5", "aviso 6", "aviso 7"]);
});

test("drainVisibleNotices returns and clears the queue", () => {
  const store = new Map();
  enqueueVisibleNotice(store, "s1", "a");
  enqueueVisibleNotice(store, "s1", "b");
  assert.deepEqual(drainVisibleNotices(store, "s1"), ["a", "b"]);
  assert.equal(store.has("s1"), false);
  assert.deepEqual(drainVisibleNotices(store, "s1"), []);
});

test("enqueueVisibleNotice rejects missing session and empty text", () => {
  const store = new Map();
  assert.equal(enqueueVisibleNotice(store, "", "hola"), false);
  assert.equal(enqueueVisibleNotice(store, undefined, "hola"), false);
  assert.equal(enqueueVisibleNotice(store, "s1", "   "), false);
  assert.equal(enqueueVisibleNotice(store, "s1", undefined), false);
  assert.equal(store.size, 0);
});

test("buildVisibleNoticePart tags a synthetic text part", () => {
  const part = buildVisibleNoticePart({
    sessionID: "s1",
    messageID: "m1",
    text: "[wam] aviso",
    idFactory: () => "wam-part-1",
  });
  assert.equal(part.id, "wam-part-1");
  assert.equal(part.type, "text");
  assert.equal(part.text, "[wam] aviso");
  assert.equal(part.synthetic, true);
  assert.equal(part.sessionID, "s1");
  assert.equal(part.messageID, "m1");
  assert.equal(part.metadata.wam.phase, "visible-notice");
});

test("updateVisibleNoticePart prefers the v2 part endpoint", async () => {
  const calls = [];
  const client = {
    session: {
      part: {
        update: async (options) => {
          calls.push(options);
        },
      },
    },
  };
  const part = { id: "prt_1", type: "text", text: "aviso" };
  const via = await updateVisibleNoticePart(client, { sessionID: "s1", messageID: "m1", part });
  assert.equal(via, "part-update");
  assert.deepEqual(calls[0], { sessionID: "s1", messageID: "m1", partID: "prt_1", part });
});

test("updateVisibleNoticePart falls back to the raw v1 patch", async () => {
  const calls = [];
  const client = {
    session: {
      _client: {
        patch: async (options) => {
          calls.push(options);
        },
      },
    },
  };
  const part = { id: "prt_2", type: "text", text: "aviso" };
  const via = await updateVisibleNoticePart(client, { sessionID: "s1", messageID: "m1", part });
  assert.equal(via, "raw-patch");
  assert.equal(calls[0].url, "/session/{sessionID}/message/{messageID}/part/{partID}");
  assert.deepEqual(calls[0].path, { sessionID: "s1", messageID: "m1", partID: "prt_2" });
  assert.equal(calls[0].body, part);
});

test("updateVisibleNoticePart throws when neither endpoint exists", async () => {
  await assert.rejects(
    () => updateVisibleNoticePart({ session: {} }, { sessionID: "s1", messageID: "m1", part: { id: "prt_3" } }),
    /no disponible/,
  );
});
