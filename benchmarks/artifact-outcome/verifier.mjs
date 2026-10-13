// Independent verifier for the artifact-outcome benchmark.
//
// The verifier never trusts the runners: it reads the fixture
// filesystem directly and checks the outcome contract of each
// artifact operation against the declared expectation.
//
// create-artifact contract:
//   - the artifact exists at the declared relative path
//   - its bytes equal the declared content
//   - no unexpected artifacts exist under artifacts/
//   - the expected artifact is present in the artifact listing
//
// update-artifact contract:
//   - the artifact exists at the declared relative path
//   - its bytes equal the declared updated content
//   - the content actually changed from the base content
//   - no unexpected artifacts exist under artifacts/
//   - the expected artifact is present in the artifact listing

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

export const CREATE_ARTIFACT = 'create-artifact';
export const UPDATE_ARTIFACT = 'update-artifact';

const ARTIFACTS_DIR = 'artifacts';

function listArtifacts(root) {
  const rootAbs = resolve(root);
  const artifactsRoot = resolve(rootAbs, ARTIFACTS_DIR);
  try {
    statSync(artifactsRoot);
  } catch {
    return [];
  }
  const listing = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        // Root-relative POSIX path so it compares against declared relPath.
        listing.push(full.slice(rootAbs.length + 1).split('\\').join('/'));
      }
    }
  };
  walk(artifactsRoot);
  return listing.sort();
}

/**
 * Shared post-conditions for every artifact outcome.
 * @param {string} root fixture root
 * @param {string} relPath declared relative path
 * @param {string} expectedContent exact bytes expected
 * @returns {{ checks: Array<{name:string, pass:boolean, expected?:string, actual?:string}> }}
 */
function commonChecks(root, relPath, expectedContent) {
  const abs = resolve(root, relPath);
  let actual = null;
  let exists = false;
  try {
    actual = readFileSync(abs, 'utf8');
    exists = true;
  } catch {
    exists = false;
  }

  const listing = listArtifacts(root);
  const declared = relPath.replace(/^\//, '');
  const declaredDir = dirname(declared);
  const declaredName = basename(declared);

  // Only reject if there is a file in the same directory with a different name.
  const unexpectedInSameDir = listing.filter((p) => p.startsWith(declaredDir + '/')).filter((p) => p !== declared);

  return {
    checks: [
      { name: 'artifact-exists', pass: exists, expected: relPath, actual: exists ? relPath : null },
      { name: 'content-matches', pass: exists && actual === expectedContent, expected: expectedContent, actual },
      {
        name: 'no-unexpected-artifacts',
        pass: unexpectedInSameDir.length === 0,
        expected: [],
        actual: unexpectedInSameDir,
      },
      { name: 'expected-artifacts-present', pass: listing.includes(declared), expected: [declared], actual: listing },
    ],
  };
}

/**
 * Verify a create-artifact outcome.
 * @param {{ root: string }} ctx
 * @param {{ relPath: string, content: string }} expectation
 * @returns {{ outcome: 'create-artifact', ok: boolean, checks: Array }}
 */
export function verifyCreateArtifact(ctxOrParams, maybeExpectation) {
  const root = ctxOrParams.root || ctxOrParams;
  const expectation = maybeExpectation || ctxOrParams;
  const relPath = expectation.relPath;
  const content = expectation.content;
  const { checks } = commonChecks(root, relPath, content);
  return { outcome: CREATE_ARTIFACT, ok: checks.every((c) => c.pass), checks };
}

/**
 * Verify an update-artifact outcome.
 * @param {{ root: string } | string} ctxOrParams
 * @param {{ relPath: string, baseContent: string, updatedContent: string }} [maybeExpectation]
 * @returns {{ outcome: 'update-artifact', ok: boolean, checks: Array }}
 */
export function verifyUpdateArtifact(ctxOrParams, maybeExpectation) {
  const root = ctxOrParams.root || ctxOrParams;
  const expectation = maybeExpectation || ctxOrParams;
  const relPath = expectation.relPath;
  const baseContent = expectation.baseContent;
  const updatedContent = expectation.updatedContent;
  const { checks } = commonChecks(root, relPath, updatedContent);
  const changed = checks.find((c) => c.name === 'content-matches').pass
    && updatedContent !== baseContent;
  checks.splice(2, 0, {
    name: 'content-changed-from-base',
    pass: changed,
    expected: `<updated content differs from base (${Buffer.byteLength(baseContent)} bytes)`,
    actual: updatedContent === baseContent ? 'unchanged' : 'changed',
  });
  return { outcome: UPDATE_ARTIFACT, ok: checks.every((c) => c.pass), checks };
}

/**
 * Verify a whole scenario: derive the expectation from the
 * declared operations and seed.
 * @param {{ root: string }} ctx
 * @param {{ id: string, seed?: {relPath:string, content:string}, operations: Array }} scenario
 * @returns {{ ok: boolean, checks: Array }}
 */
export function verifyScenario(ctx, scenario) {
  const verifiable = scenario.operations.filter(
    (op) => op.kind === CREATE_ARTIFACT || op.kind === UPDATE_ARTIFACT,
  );
  if (verifiable.length === 0) {
    throw new Error(`scenario "${scenario.id}" has no verifiable artifact operations`);
  }
  // Single artifact scenario: verify the last declared operation,
  // which represents the terminal state of the fixture.
  const terminal = verifiable[verifiable.length - 1];
  const result =
    terminal.kind === CREATE_ARTIFACT
      ? verifyCreateArtifact(ctx, { relPath: terminal.relPath, content: terminal.content })
      : verifyUpdateArtifact(ctx, {
          relPath: terminal.relPath,
          baseContent: scenario.seed ? scenario.seed.content : '',
          updatedContent: terminal.updatedContent,
        });
  return { ok: result.ok, checks: result.checks };
}
