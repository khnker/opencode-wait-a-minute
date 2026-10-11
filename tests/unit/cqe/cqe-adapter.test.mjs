import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  normalizeItem,
  dedupe,
  materializeSnippet,
} from "../../../src/context/cqe-adapter.js";

test("normalizeItem — handles valid raw item correctly", () => {
  const raw = {
    id: "item-1",
    path: "foo.js",
    snippet: "console.log('hi');",
    startLine: 1,
    endLine: 2,
    score: 0.95,
    evidenceType: "code",
    tokenEstimate: 5,
    provenance: { operator: "custom-op" },
  };
  const norm = normalizeItem(raw, 0, "test query", 12);
  assert.equal(norm.id, "item-1");
  assert.equal(norm.path, "foo.js");
  assert.equal(norm.content, "console.log('hi');");
  assert.equal(norm.startLine, 1);
  assert.equal(norm.endLine, 2);
  assert.equal(norm.score, 0.95);
  assert.equal(norm.evidenceType, "code");
  assert.equal(norm.tokenEstimate, 5);
  assert.equal(norm.provenance.operator, "custom-op");
  assert.equal(norm.provenance.query, "test query");
  assert.equal(norm.provenance.source, "cqe");
  assert.equal(norm.provenance.elapsedMs, 12);
});

test("normalizeItem — handles malformed/empty raw item safely", () => {
  const raw = {};
  const norm = normalizeItem(raw, 3, "query q", 5);
  assert.equal(norm.id, "unknown:3");
  assert.equal(norm.path, "");
  assert.equal(norm.content, "");
  assert.equal(norm.startLine, null);
  assert.equal(norm.endLine, null);
  assert.equal(norm.score, null);
  assert.equal(norm.evidenceType, "retrieval");
  assert.equal(norm.provenance.operator, "cqe-retrieval");
});

test("dedupe — removes duplicates and preserves ordering", () => {
  const items = [
    { path: "a.js", startLine: 1, endLine: 5, evidenceType: "code", id: "1" },
    { path: "b.js", startLine: 1, endLine: 5, evidenceType: "code", id: "2" },
    { path: "a.js", startLine: 1, endLine: 5, evidenceType: "code", id: "3" }, // duplicate
    { path: "a.js", startLine: 2, endLine: 6, evidenceType: "code", id: "4" },
  ];
  const res = dedupe(items);
  assert.equal(res.length, 3);
  assert.equal(res[0].id, "1");
  assert.equal(res[1].id, "2");
  assert.equal(res[2].id, "4");
});

test("materializeSnippet — returns item unchanged if content present or no path", () => {
  const itemWithContent = { content: "already here", path: "foo.js" };
  assert.equal(materializeSnippet(itemWithContent), itemWithContent);

  const itemNoPath = { content: "", path: "" };
  assert.equal(materializeSnippet(itemNoPath), itemNoPath);
});

test("materializeSnippet — handles missing/unreadable file safely", () => {
  const item = { content: "", path: "non-existent-file-xyz-123.js", startLine: 1 };
  const res = materializeSnippet(item, os.tmpdir());
  assert.equal(res, item); // should catch error and return item safely
});

test("materializeSnippet — reads snippet from valid file", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-cqe-test-"));
  const filePath = path.join(tmpDir, "sample.js");
  fs.writeFileSync(filePath, "line 1\nline 2\nline 3\nline 4\nline 5\n");

  const item = { path: "sample.js", startLine: 2, endLine: 3 };
  const res = materializeSnippet(item, tmpDir);
  assert.equal(res.content, "line 2\nline 3");
  assert.ok(res.tokenEstimate > 0);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
