/**
 * Labeled queries for A/B benchmark: local code-evidence retrieval.
 * Deterministic ground-truth with expected paths from the committed fixture
 * `tests/fixtures/cqe/sample-repo`.
 */

const CORPORA = {
  fixture: './tests/fixtures/cqe/sample-repo',
  self: process.cwd(),
};

/**
 * @typedef {Object} LabeledQuery
 * @property {string} id - Unique identifier.
 * @property {string} query - Search query text for retrieval.
 * @property {'factual'|'symbol'|'synonym'|'ambiguous'|'absent'|'many-similar'|'contradiction'} type
 * @property {Array<{path:string, mustContain?:string}>} expected - Ground truth paths, with optional content requirement.
 * @property {number} sufficiency - Expected retrieval sufficiency (0.0-1.0).
 * @property {string} note - Confidence and rationale.
 */

export { CORPORA };
export const LABELED_QUERIES = [
  // Factual - simple term from single file
  {
    id: 'fq-parseConfig',
    query: 'parseConfig',
    type: 'factual',
    expected: [{ path: 'src/config.js', mustContain: 'export function parseConfig' }],
    sufficiency: 1.0,
    note: 'Direct symbol definition in src/config.js, line 4',
  },
  {
    id: 'fq-loadConfig',
    query: 'loadConfig',
    type: 'factual',
    expected: [{ path: 'src/config.js', mustContain: 'export function loadConfig' }],
    sufficiency: 1.0,
    note: 'Function definition in src/config.js, line 7',
  },
  {
    id: 'fq-CONFIG_PATH',
    query: 'CONFIG_PATH',
    type: 'factual',
    expected: [{ path: 'src/config.js', mustContain: 'export const CONFIG_PATH' }],
    sufficiency: 1.0,
    note: 'Constant definition in src/config.js, line 11',
  },
  // Symbol - query matches multiple symbols across files
  {
    id: 'sym-parseConfig-legacy',
    query: 'parseConfigLegacy',
    type: 'symbol',
    expected: [{ path: 'src/parser.js', mustContain: 'export function parseConfigLegacy' }],
    sufficiency: 1.0,
    note: 'Legacy parser function in src/parser.js, line 2',
  },
  {
    id: 'sym-buildOptions',
    query: 'buildOptions',
    type: 'symbol',
    expected: [{ path: 'src/parser.js', mustContain: 'export function buildOptions' }],
    sufficiency: 1.0,
    note: 'Builder function in src/parser.js, line 5',
  },
  // Synonym - similar terms from different contexts
  {
    id: 'syn-config',
    query: 'config',
    type: 'synonym',
    expected: [
      { path: 'src/config.js', mustContain: 'parseConfig' },
      { path: 'src/parser.js', mustContain: 'parseConfig' },
    ],
    sufficiency: 0.8,
    note: 'Two references to config module; both parseConfig functions',
  },
  // Ambiguous - query could match multiple distinct concepts
  {
    id: 'amb-raw',
    query: 'raw',
    type: 'ambiguous',
    expected: [
      { path: 'src/config.js', mustContain: 'raw' },
      { path: 'src/parser.js', mustContain: 'raw' },
    ],
    sufficiency: 0.6,
    note: 'Parameter name in both files; low specificity',
  },
  // Absent - query not present in repo
  {
    id: 'abs-nonexistent',
    query: 'nonExistentFunctionXYZ',
    type: 'absent',
    expected: [],
    sufficiency: 0.0,
    note: 'Function does not exist in any file',
  },
  // Many-similar - multiple similar patterns in same file
  {
    id: 'many-parse',
    query: 'parse',
    type: 'many-similar',
    expected: [
      { path: 'src/config.js', mustContain: 'parseConfig' },
      { path: 'src/parser.js', mustContain: 'parseConfigLegacy' },
    ],
    sufficiency: 0.7,
    note: 'Three parse-related functions across two files',
  },
  // Contradiction - conflicting evidence (two parseConfig definitions)
  {
    id: 'contr-parseConfig',
    query: 'parseConfig',
    type: 'contradiction',
    expected: [
      { path: 'src/config.js', mustContain: 'export function parseConfig' },
      { path: 'src/parser.js', mustContain: 'parseConfig' },
    ],
    sufficiency: 0.4,
    note: 'Two distinct parseConfig functions with different signatures; one is a re-export',
  },
];
