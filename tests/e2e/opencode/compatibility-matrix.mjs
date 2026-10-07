/**
 * Machine-readable Node / OpenCode compatibility matrix — single source of truth.
 *
 * Nothing else in the repo may hardcode a supported version. The E2E smoke test
 * (tests/e2e/opencode/smoke.mjs) and scripts/check-compatibility.mjs both read
 * this module; see docs/architecture/compatibility.md for the human matrix.
 *
 * Grounding (do NOT invent values):
 *  - node.supported  : taken verbatim from package.json "engines.node" (">=20").
 *  - node.tested     : versions observed in a real validation matrix. The repo
 *                      currently declares no CI version matrix, so this is empty
 *                      (documented as unreported, not assumed).
 *  - opencode.minimum: NO OpenCode version is declared anywhere in this repo.
 *                      It is explicitly UNDETERMINED (null). Compatibility is a
 *                      matrix, not a single install: do not claim OpenCode
 *                      compatibility from one concrete install. Populate only
 *                      from a real validation run, then update the doc.
 *
 * The matrix is data, not prose: fail-fast checks consume the same fields.
 */

export class CompatibilityError extends Error {
  /**
   * @param {string} message
   * @param {{ kind?: string, version?: string, range?: string | null }} [meta]
   */
  constructor(message, meta = {}) {
    super(message);
    this.name = "CompatibilityError";
    this.kind = meta.kind ?? "compatibility";
    this.version = meta.version;
    this.range = meta.range ?? null;
    // Non-zero so a thrown error maps to a failing process exit code.
    this.exitCode = 1;
  }
}

/**
 * Compatibility matrix. Frozen: it is shared state, not per-call config.
 * @type {Readonly<{
 *   node: { supported: string, tested: string[], source: string },
 *   opencode: { minimum: string | null, tested: string[], source: string },
 * }>}
 */
export const COMPATIBILITY_MATRIX = Object.freeze({
  node: Object.freeze({
    supported: ">=20",
    tested: Object.freeze([]),
    source: "package.json#engines.node",
  }),
  opencode: Object.freeze({
    minimum: null,
    tested: Object.freeze([]),
    source: "undetermined (no OpenCode version declared in this repo)",
  }),
});

/**
 * Parse a loose semver string into a comparable tuple.
 * Accepts optional leading "v" and prerelease/build metadata.
 * @param {string} input
 * @returns {{ major: number, minor: number, patch: number }}
 */
export function parseVersion(input) {
  if (typeof input !== "string" || input.trim() === "") {
    throw new CompatibilityError(`invalid version: ${JSON.stringify(input)}`, {
      kind: "parse",
      version: String(input),
    });
  }
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+].*)?$/.exec(input.trim());
  if (!match) {
    throw new CompatibilityError(`invalid version: ${input}`, {
      kind: "parse",
      version: input,
    });
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
  };
}

/** @returns {-1|0|1} */
function compare(a, b) {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

/**
 * Evaluate a comparator range against a version.
 * @param {{ major: number, minor: number, patch: number }} version
 * @param {string} range
 * @returns {boolean}
 */
export function satisfies(version, range) {
  if (typeof range !== "string" || range.trim() === "") {
    throw new CompatibilityError(`invalid range: ${JSON.stringify(range)}`, {
      kind: "parse",
      range: String(range),
    });
  }
  const parsedVersion = toVersionTuple(version);

  const tokens = range.trim().split(/\s+/);
  return tokens.every((token) => satisfiesToken(parsedVersion, token));
}

function normalizeRangeTarget(version) {
  return `${version.major}.${version.minor}.${version.patch}`;
}

function toVersionTuple(version) {
  if (typeof version === "string") return parseVersion(version);
  return version;
}

function satisfiesToken(version, token) {
  const match = /^(>=|<=|>|<|=|\^|~)?\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(token);
  if (!match) {
    throw new CompatibilityError(`invalid comparator: ${token}`, {
      kind: "parse",
      range: token,
    });
  }
  const op = match[1] ?? "=";
  const bound = {
    major: Number(match[2]),
    minor: Number(match[3] ?? 0),
    patch: Number(match[4] ?? 0),
  };
  const cmp = compare(version, bound);
  switch (op) {
    case ">=":
      return cmp >= 0;
    case "<=":
      return cmp <= 0;
    case ">":
      return cmp > 0;
    case "<":
      return cmp < 0;
    case "=":
      return cmp === 0;
    case "^": {
      if (bound.major > 0) {
        const upper = { major: bound.major + 1, minor: 0, patch: 0 };
        return cmp >= 0 && compare(version, upper) < 0;
      }
      const upper = { major: 0, minor: bound.minor + 1, patch: 0 };
      return cmp >= 0 && compare(version, upper) < 0;
    }
    case "~": {
      const upper = { major: bound.major, minor: bound.minor + 1, patch: 0 };
      return cmp >= 0 && compare(version, upper) < 0;
    }
    default:
      return false;
  }
}

/**
 * Fail fast when a Node version is outside the matrix's supported range.
 * @param {string} version e.g. process.versions.node ("20.11.0")
 * @param {{ supported: string }} [node] defaults to the matrix node entry
 * @returns {true}
 * @throws {CompatibilityError}
 */
export function assertSupportedNode(version, node = COMPATIBILITY_MATRIX.node) {
  if (!satisfies(version, node.supported)) {
    throw new CompatibilityError(
      `unsupported Node ${version}; matrix requires "${node.supported}" (source: ${node.source})`,
      { kind: "node", version, range: node.supported },
    );
  }
  return true;
}

/**
 * Fail fast when an OpenCode version is below the declared minimum.
 * If the minimum is `null` (undetermined) the check is a no-op unless an
 * explicit minimum is supplied — we refuse to claim compatibility from a single
 * install, so an ungrounded minimum MUST NOT silently pass as "compatible".
 * @param {string} version
 * @param {string | null} [minimum] defaults to the matrix opencode.minimum
 * @returns {{ enforced: boolean, ok: boolean, minimum: string | null }}
 * @throws {CompatibilityError} only when a minimum is present and violated
 */
export function assertSupportedOpenCode(
  version,
  minimum = COMPATIBILITY_MATRIX.opencode.minimum,
) {
  if (minimum == null) {
    return { enforced: false, ok: true, minimum: null };
  }
  if (!satisfies(version, `>=${minimum}`)) {
    throw new CompatibilityError(
      `unsupported OpenCode ${version}; matrix requires ">=${minimum}"`,
      { kind: "opencode", version, range: `>=${minimum}` },
    );
  }
  return { enforced: true, ok: true, minimum };
}

/**
 * Compose both checks. Returns a structured result for reporting; never throws
 * so callers (CLI / E2E) decide how to surface failures. Use the assert* helpers
 * or inspect result.ok when a throw is desired.
 * @param {{ nodeVersion?: string, opencodeVersion?: string | null, opencodeMinimum?: string | null }} [opts]
 */
export function checkCompatibility(opts = {}) {
  const nodeVersion = opts.nodeVersion ?? process.versions.node;
  const opencodeMinimum =
    opts.opencodeMinimum === undefined
      ? COMPATIBILITY_MATRIX.opencode.minimum
      : opts.opencodeMinimum;
  const opencodeVersion = opts.opencodeVersion ?? null;

  const failures = [];

  let nodeOk;
  try {
    nodeOk = assertSupportedNode(nodeVersion);
  } catch (error) {
    nodeOk = false;
    failures.push({ kind: "node", message: error.message });
  }

  let opencode = { enforced: false, ok: true, minimum: opencodeMinimum };
  if (opencodeMinimum != null && opencodeVersion != null) {
    try {
      opencode = assertSupportedOpenCode(opencodeVersion, opencodeMinimum);
    } catch (error) {
      opencode = { enforced: true, ok: false, minimum: opencodeMinimum };
      failures.push({ kind: "opencode", message: error.message });
    }
  } else if (opencodeMinimum == null) {
    opencode = { enforced: false, ok: true, minimum: null };
  }

  return {
    ok: failures.length === 0,
    node: { version: nodeVersion, supported: COMPATIBILITY_MATRIX.node.supported, ok: nodeOk },
    opencode: { ...opencode, version: opencodeVersion },
    failures,
  };
}
