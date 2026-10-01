import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadEvidenceCorpus,
  validateSource,
  validateCorpus,
  EVIDENCE_TYPES
} from "./index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("loadEvidenceCorpus returns at least 3 sources", () => {
  const corpus = loadEvidenceCorpus();
  assert.ok(Array.isArray(corpus.sources));
  assert.ok(
    corpus.sources.length >= 3,
    `expected >=3 sources, got ${corpus.sources.length}`
  );
  assert.equal(typeof corpus.corpus, "string");
  assert.equal(typeof corpus.version, "string");
});

test("every source has all required keys as non-empty strings", () => {
  const corpus = loadEvidenceCorpus();
  const required = [
    "id",
    "source",
    "type",
    "date",
    "methodology",
    "metric",
    "population",
    "relevance",
    "limitations"
  ];
  for (const s of corpus.sources) {
    for (const key of required) {
      assert.equal(
        typeof s[key],
        "string",
        `source ${s.id} key ${key} should be a string`
      );
      assert.ok(s[key].trim().length > 0, `source ${s.id} key ${key} is empty`);
    }
    assert.ok(
      EVIDENCE_TYPES.includes(s.type),
      `source ${s.id} has unknown type ${s.type}`
    );
  }
});

test("corpus covers provider, academic and open-source types", () => {
  const corpus = loadEvidenceCorpus();
  const types = new Set(corpus.sources.map((s) => s.type));
  for (const t of ["provider", "academic", "open-source"]) {
    assert.ok(types.has(t), `corpus is missing a ${t}-type source`);
  }
});

test("byType filters correctly and rejects unknown types", () => {
  const corpus = loadEvidenceCorpus();
  const providers = corpus.byType("provider");
  assert.ok(providers.length >= 1);
  for (const p of providers) assert.equal(p.type, "provider");

  const academic = corpus.byType("academic");
  assert.ok(academic.length >= 1);
  assert.ok(academic.every((s) => s.type === "academic"));

  assert.throws(() => corpus.byType("not-a-type"), /Unknown evidence type/);
});

test("provider sources carry the cache caveat, not a WAM-reduction claim", () => {
  const corpus = loadEvidenceCorpus();
  const providers = corpus.byType("provider");
  assert.ok(providers.length >= 1);
  for (const p of providers) {
    const text = `${p.relevance} ${p.limitations}`.toLowerCase();
    assert.ok(
      text.includes("not") && text.includes("cach"),
      `provider source ${p.id} should explicitly disclaim WAM context reduction`
    );
  }
  assert.equal(corpus.warnings.length > 0, true, "corpus should emit cache warnings");
});

test("malformed JSON throws a descriptive error", () => {
  const dir = tmpDir("wam-evidence-bad-");
  try {
    fs.writeFileSync(path.join(dir, "sources.json"), "{ this is not json ");
    assert.throws(
      () => loadEvidenceCorpus({ root: dir }),
      /not valid JSON/
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("missing file throws", () => {
  const dir = tmpDir("wam-evidence-missing-");
  try {
    assert.throws(() => loadEvidenceCorpus({ root: dir }), /not found/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("valid JSON missing required keys throws", () => {
  const dir = tmpDir("wam-evidence-incomplete-");
  try {
    fs.writeFileSync(
      path.join(dir, "sources.json"),
      JSON.stringify({ corpus: "x", version: "1", sources: [{ id: "a" }] })
    );
    assert.throws(() => loadEvidenceCorpus({ root: dir }), /missing required key/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("validateSource reports errors for non-object and bad type", () => {
  assert.deepEqual(validateSource(null), ["source must be an object"]);
  assert.deepEqual(validateSource([]), ["source must be an object"]);

  const bad = {
    id: "x",
    source: "y",
    type: "bogus",
    date: "2024",
    methodology: "m",
    metric: "me",
    population: "p",
    relevance: "r",
    limitations: "l"
  };
  const errs = validateSource(bad);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /type must be one of/);
});

test("validateCorpus rejects empty source list", () => {
  assert.throws(
    () => validateCorpus({ corpus: "a", version: "1", sources: [] }),
    /must not be empty/
  );
});

test("validateCorpus rejects duplicate ids", () => {
  const s = {
    id: "dup",
    source: "y",
    type: "academic",
    date: "2024",
    methodology: "m",
    metric: "me",
    population: "p",
    relevance: "r",
    limitations: "l"
  };
  assert.throws(
    () => validateCorpus({ corpus: "a", version: "1", sources: [s, { ...s }] }),
    /duplicate source id/
  );
});

test("shipped sources.json is valid JSON on disk", () => {
  const raw = fs.readFileSync(path.join(__dirname, "sources.json"), "utf8");
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed.sources));
  assert.ok(parsed.sources.length >= 3);
});
