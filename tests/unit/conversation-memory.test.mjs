import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  recordTurn,
  loadConversationMemory,
  recallEntities,
  extractEntities,
} from "../../src/persistence/conversation-memory.js";

test("conversation memory records turns and extracts entities", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-memory-"));
  recordTurn(
    {
      sessionID: "s1",
      user: "sigue con /home/nicolas/dev/app/src/index.js y mira https://example.com",
    },
    root
  );

  const memory = loadConversationMemory(root, "s1");
  assert.equal(memory.turns.length, 1);
  assert.ok(memory.entities.some((e) => e.kind === "path"));
  assert.ok(memory.entities.some((e) => e.kind === "url"));

  const recalled = recallEntities("sigue con index.js", memory);
  assert.ok(recalled.some((e) => e.value.includes("index.js")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("memory is bounded", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-memory-"));
  for (let i = 0; i < 20; i++) {
    recordTurn({ sessionID: "s2", user: `turn ${i} file-${i}.js` }, root);
  }
  const memory = loadConversationMemory(root, "s2");
  assert.ok(memory.turns.length <= 10);
  assert.ok(memory.entities.length <= 20);
  fs.rmSync(root, { recursive: true, force: true });
});

test("extractEntities deduplicates", () => {
  const entities = extractEntities("/a/b.js /a/b.js https://x.test");
  assert.equal(entities.filter((e) => e.value === "/a/b.js").length, 1);
});
