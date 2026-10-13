/**
 * Frozen-run records for the prompt-quality benchmark.
 *
 * A frozen run stores the CONTENT hash of every prompt it used,
 * so a run stays reproducible against the exact prompt bytes it
 * was built from. Later comparisons read the snapshot — never
 * the live file — which is what makes baseline-vs-candidate
 * review immune to edits made after the freeze.
 *
 * Pure module apart from the optional `read` hook (used by tests
 * to observe the live catalog; production injects the fs-backed
 * loader). No network.
 */

import crypto from "node:crypto";

/**
 * Stable SHA-256 hex digest of a string.
 *
 * @param {string} content
 * @returns {string}
 */
export function hashContent(content) {
  if (typeof content !== "string") {
    throw new TypeError("prompt-eval: hashContent expects a string");
  }
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function canonicalStringify(value) {
  return JSON.stringify(value, null, 2);
}

function hashObject(value) {
  return hashContent(canonicalStringify(value));
}

function stablePromptRecords(promptContents) {
  const entries = Object.entries(promptContents).map(([id, record]) => {
    const body = record && typeof record === "object" && "content" in record
      ? record.content
      : record;
    if (typeof body !== "string") {
      throw new TypeError(
        `prompt-eval: promptContents["${id}"] must be a string or { content, path? }`,
      );
    }
    return {
      id,
      path: record && typeof record === "object" && record.path ? record.path : null,
      hash: hashContent(body),
    };
  });
  entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return entries;
}

/**
 * Freeze a run record from a suite and the prompt contents it
 * evaluated. The returned object is deeply frozen.
 *
 * @param {{ suite: object, promptContents: Record<string, string|{content:string, path?:string}>, config?: object }} args
 * @returns {object} frozen run record
 */
export function freezeRun({ suite, promptContents, config = {} }) {
  if (!suite || typeof suite !== "object") {
    throw new TypeError("prompt-eval: freezeRun requires a suite");
  }
  if (!promptContents || typeof promptContents !== "object") {
    throw new TypeError("prompt-eval: freezeRun requires promptContents");
  }

  const prompts = stablePromptRecords(promptContents);
  const suiteHash = hashObject(suite);
  const configHash = hashObject(config);
  const run = {
    schema: "wam.prompt-eval.run/1",
    suite: { id: suite.id, version: suite.version, hash: suiteHash },
    configHash,
    prompts,
  };
  return Object.freeze(run);
}

/**
 * Compare a frozen run's stored prompt hashes against a candidate
 * map of id → content, using ONLY the snapshot. Live-file edits
 * made after the freeze are invisible to this comparison.
 *
 * @param {object} frozenRun
 * @param {Record<string, string>} candidateContents
 * @returns {{ changed: string[], unchanged: string[], added: string[], removed: string[] }}
 */
export function diffAgainstSnapshot(frozenRun, candidateContents) {
  const snapshot = new Map(frozenRun.prompts.map((p) => [p.id, p.hash]));
  const candidate = new Map(
    Object.entries(candidateContents).map(([id, content]) => [id, hashContent(content)]),
  );

  const changed = [];
  const unchanged = [];
  for (const [id, hash] of snapshot) {
    if (!candidate.has(id)) {
      continue;
    }
    (candidate.get(id) === hash ? unchanged : changed).push(id);
  }
  const added = [...candidate.keys()].filter((id) => !snapshot.has(id));
  const removed = [...snapshot.keys()].filter((id) => !candidate.has(id));
  return { changed, unchanged, added, removed };
}
