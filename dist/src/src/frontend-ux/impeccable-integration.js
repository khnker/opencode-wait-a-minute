/**
 * Impeccable Frontend-UX Integration
 *
 * OPT-IN, isolated capability. Never part of the default WAM completion path:
 * it only becomes active when the bridge is present AND WAM_IMPECCABLE is set.
 * No network, no child processes — detection is filesystem-only and injectable.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const IMPECCABLE_PROVENANCE = Object.freeze({
  Repo: 'https://github.com/pbakaus/impeccable',
  License: 'Apache-2.0',
  Version: '4.5.2',
  Tag: 'skill-v4.5.2',
  Commit: '2f98774f86bc05563876643db37e6c37c322850f',
  Install: 'npx impeccable install',
  Invocation: 'slash-command+skill',
  CommandBridge: '.opencode/commands/impeccable.md',
});

export const CAPABILITY_STATES = Object.freeze({
  UNAVAILABLE: 'unavailable',
  DISABLED: 'disabled',
  ENABLED: 'enabled',
});

const TRUTHY_FLAGS = ['1', 'true', 'on', 'enabled'];

const FRONTEND_FILE_EXT = /\.(html|css|scss|sass|less|tsx|jsx|vue|svelte)$/i;
const FRONTEND_PATH_MARKERS = [
  'src/app/',
  '/components/',
  '/styles/',
  '/templates/',
  '/public/',
  '/frontend/',
  '/ui/',
];
const BACKEND_PATH_MARKERS = [
  '/api/',
  '/server/',
  '/db/',
  '/migration/',
  '/migrations/',
  '/controller/',
  '/controllers/',
  '/service/',
  '/services/',
];
const FRONTEND_TEXT_RE =
  /\b(ui|ux|layout|responsive|accessib\w*|a11y|component|styling|design|viewport|keyboard|form|screen)\b/i;
const BACKEND_TEXT_RE =
  /\b(endpoint|migration|sql|database|dto|controller|service|schema)\b/i;

const INTENT_COMMANDS = [
  { command: 'critique', re: /\b(diagnose|review|critique)\b/i },
  { command: 'audit', re: /\b(audit|verify|accessibility)\b/i },
  { command: 'shape', re: /\b(design|shape)\b/i },
  { command: 'polish', re: /\b(refine|polish)\b/i },
];
const DEFAULT_COMMAND = 'critique';

/** Opt-in flag: WAM_IMPECCABLE must be explicitly truthy to enable. */
export function isImpeccableEnabled(env = process.env) {
  if (!env || env.WAM_IMPECCABLE === undefined || env.WAM_IMPECCABLE === null) {
    return false;
  }
  return TRUTHY_FLAGS.includes(String(env.WAM_IMPECCABLE).toLowerCase());
}

/** Filesystem-only default probe: project bridge OR user-level install marker. */
function defaultProbe() {
  try {
    const bridge = path.join(process.cwd(), '.opencode', 'commands', 'impeccable.md');
    const userInstall = path.join(os.homedir(), '.impeccable');
    return fs.existsSync(bridge) || fs.existsSync(userInstall);
  } catch {
    return false;
  }
}

/**
 * Availability detection. `probe` is injectable for deterministic tests; the
 * default probe never touches the network.
 */
export function detectImpeccable({ env = process.env, probe } = {}) {
  void env;
  const run = typeof probe === 'function' ? probe : defaultProbe;
  try {
    return run() === true;
  } catch {
    return false;
  }
}

/** Resolve the capability state: UNAVAILABLE → DISABLED → ENABLED. */
export function getCapabilityState({ env = process.env, probe } = {}) {
  if (!detectImpeccable({ env, probe })) {
    return CAPABILITY_STATES.UNAVAILABLE;
  }
  return isImpeccableEnabled(env)
    ? CAPABILITY_STATES.ENABLED
    : CAPABILITY_STATES.DISABLED;
}

function normalizeTask(task) {
  if (typeof task === 'string') {
    return { text: task, files: [], kind: '' };
  }
  if (task && typeof task === 'object') {
    return {
      text: typeof task.description === 'string' ? task.description : '',
      files: Array.isArray(task.files)
        ? task.files.filter((f) => typeof f === 'string')
        : [],
      kind: typeof task.kind === 'string' ? task.kind : '',
    };
  }
  return { text: '', files: [], kind: '' };
}

/**
 * Conservative frontend-UX classifier. A task is frontend-UX only when at
 * least one frontend signal is present; backend-only tasks never qualify.
 */
export function classifyFrontendUxTask(task) {
  const { text, files, kind } = normalizeTask(task);
  const reasons = [];
  let frontendSignals = 0;
  let backendSignals = 0;

  for (const file of files) {
    const lower = file.toLowerCase();
    if (FRONTEND_FILE_EXT.test(lower)) {
      frontendSignals += 1;
      reasons.push(`frontend signal: file extension in "${file}"`);
    }
    for (const marker of FRONTEND_PATH_MARKERS) {
      if (lower.includes(marker)) {
        frontendSignals += 1;
        reasons.push(`frontend signal: path marker "${marker}" in "${file}"`);
      }
    }
    for (const marker of BACKEND_PATH_MARKERS) {
      if (lower.includes(marker)) {
        backendSignals += 1;
        reasons.push(`backend signal: path marker "${marker}" in "${file}"`);
      }
    }
  }

  const textForMatch = `${text} ${kind}`.trim();
  if (textForMatch) {
    const frontendMatch = textForMatch.match(FRONTEND_TEXT_RE);
    if (frontendMatch) {
      frontendSignals += 1;
      reasons.push(`frontend signal: text matches "${frontendMatch[0]}"`);
    }
    const backendMatch = textForMatch.match(BACKEND_TEXT_RE);
    if (backendMatch) {
      backendSignals += 1;
      reasons.push(`backend signal: text matches "${backendMatch[0]}"`);
    }
  }

  const isFrontendUx = frontendSignals > 0;
  void backendSignals;

  return { isFrontendUx, reasons };
}

function extractIntent(task) {
  if (typeof task === 'string') return task;
  if (task && typeof task === 'object') {
    if (typeof task.intent === 'string') return task.intent;
    if (typeof task.kind === 'string') return task.kind;
    if (typeof task.description === 'string') return task.description;
  }
  return '';
}

function commandForIntent(intent) {
  const value = String(intent || '');
  for (const { command, re } of INTENT_COMMANDS) {
    if (re.test(value)) return command;
  }
  return DEFAULT_COMMAND;
}

/**
 * Plan an invocation for a task at a given capability state. Never claims an
 * action happened — it only describes the intended slash command.
 */
export function planFrontendUxInvocation(task, state) {
  if (state !== CAPABILITY_STATES.ENABLED) {
    return {
      activate: false,
      capability: null,
      command: null,
      invocation: null,
      reason: `capability ${state}`,
    };
  }

  const { isFrontendUx } = classifyFrontendUxTask(task);
  if (!isFrontendUx) {
    return {
      activate: false,
      capability: null,
      command: null,
      invocation: null,
      reason: 'not frontend UX task',
    };
  }

  const command = commandForIntent(extractIntent(task));
  return {
    activate: true,
    capability: 'impeccable',
    command,
    invocation: `/impeccable ${command}`,
    reason: 'enabled',
  };
}

/** Describe a capability state, including provenance and fallback behavior. */
export function describeCapability(state) {
  return {
    state,
    available: state !== CAPABILITY_STATES.UNAVAILABLE,
    enabled: state === CAPABILITY_STATES.ENABLED,
    provenance: IMPECCABLE_PROVENANCE,
    fallback:
      state === CAPABILITY_STATES.ENABLED
        ? null
        : 'normal WAM behavior (no Impeccable audit performed)',
  };
}
