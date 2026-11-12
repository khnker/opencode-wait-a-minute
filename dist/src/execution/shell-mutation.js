/**
 * Quote-aware shell classification for the analysis execution gate.
 *
 * The gate must answer one question: would this bash command mutate files?
 * A raw regex cannot answer it because text inside quotes (SQL, grep patterns,
 * echo strings) looks like shell syntax. This scanner walks the command the way
 * a shell would: it ignores quoted and heredoc text and only acts on real
 * operators. It fails open on anything it does not positively recognize, so an
 * unknown command can never deadlock a session.
 */

const MUTATING_COMMANDS = new Set([
  "rm",
  "mv",
  "cp",
  "touch",
  "mkdir",
  "rmdir",
  "chmod",
  "chown",
  "ln",
  "dd",
  "tee",
  "truncate",
]);

const WRAPPERS = new Set([
  "sudo",
  "doas",
  "env",
  "nohup",
  "time",
  "command",
  "builtin",
  "exec",
  "nice",
  "ionice",
  "stdbuf",
]);

const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh", "fish"]);

const GIT_MUTATIONS = new Set([
  "apply",
  "commit",
  "checkout",
  "reset",
  "clean",
  "merge",
  "rebase",
  "push",
  "restore",
  "rm",
  "mv",
]);

const GIT_STASH_MUTATIONS = new Set(["push", "pop", "apply", "drop", "clear"]);

const PACKAGE_MANAGERS = new Set(["npm", "pnpm", "yarn", "bun"]);
const PACKAGE_MUTATIONS = new Set([
  "i",
  "install",
  "ci",
  "uninstall",
  "update",
  "add",
  "remove",
  "upgrade",
]);

const HARMLESS_REDIRECT_TARGETS = new Set([
  "/dev/null",
  "/dev/stdout",
  "/dev/stderr",
  "/dev/tty",
  "-",
]);

const ASSIGNMENT_RE = /^[A-Za-z_][A-Za-z0-9_]*=/;

function base(word) {
  return String(word).split("/").pop();
}

function isAssignment(word) {
  return ASSIGNMENT_RE.test(word);
}

/** Reads one shell word starting at `start`, stripping quotes. */
function readWord(command, start) {
  let i = start;
  while (i < command.length && (command[i] === " " || command[i] === "\t")) i++;
  let value = "";
  let quote = null;
  while (i < command.length) {
    const ch = command[i];
    if (quote === "'") {
      if (ch === "'") quote = null;
      else value += ch;
      i++;
      continue;
    }
    if (quote === '"') {
      if (ch === '"') quote = null;
      else if (ch === "\\" && i + 1 < command.length) {
        value += command[i + 1];
        i++;
      } else value += ch;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      i++;
      continue;
    }
    if (ch === "\\" && i + 1 < command.length) {
      value += command[i + 1];
      i += 2;
      continue;
    }
    if (/\s/.test(ch) || ";&|<>".includes(ch)) break;
    value += ch;
    i++;
  }
  return { value, next: i };
}

/** Skips a heredoc body up to and including its delimiter line. */
function skipHeredoc(command, start, delimiter) {
  if (!delimiter) return start;
  let i = command.indexOf("\n", start);
  if (i === -1) return command.length;
  i++;
  while (i < command.length) {
    let end = command.indexOf("\n", i);
    if (end === -1) end = command.length;
    const line = command.slice(i, end).trim();
    i = end + 1;
    if (line === delimiter) break;
  }
  return i;
}

/**
 * Splits a command into segments on unquoted separators and records the first
 * file-writing redirect per segment. `words` holds the unquoted command words.
 */
function scanSegments(command) {
  const segments = [];
  let words = [];
  let word = "";
  let inWord = false;
  let quote = null;
  let redirect = null;
  let i = 0;

  const flushWord = () => {
    if (inWord) {
      words.push(word);
      word = "";
      inWord = false;
    }
  };
  const flushSegment = () => {
    flushWord();
    segments.push({ words, redirect });
    words = [];
    redirect = null;
  };
  const noteRedirect = (target) => {
    if (!target) {
      redirect = redirect || "(missing)";
      return;
    }
    if (!HARMLESS_REDIRECT_TARGETS.has(target)) redirect = redirect || target;
  };

  while (i < command.length) {
    const ch = command[i];

    if (quote === "'") {
      if (ch === "'") quote = null;
      else {
        word += ch;
        inWord = true;
      }
      i++;
      continue;
    }
    if (quote === '"') {
      if (ch === '"') quote = null;
      else if (ch === "\\" && i + 1 < command.length) {
        word += command[i + 1];
        inWord = true;
        i++;
      } else {
        word += ch;
        inWord = true;
      }
      i++;
      continue;
    }
    if (ch === "\\" && i + 1 < command.length) {
      word += command[i + 1];
      inWord = true;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      inWord = true;
      i++;
      continue;
    }

    if (ch === " " || ch === "\t") {
      flushWord();
      i++;
      continue;
    }
    if (ch === "\n" || ch === ";") {
      flushSegment();
      i++;
      continue;
    }

    if (ch === "&") {
      if (command[i + 1] === "&") {
        flushSegment();
        i += 2;
        continue;
      }
      if (command[i + 1] === ">") {
        flushWord();
        let j = i + 2;
        if (command[j] === ">") j++;
        const { value, next } = readWord(command, j);
        noteRedirect(value);
        i = next;
        continue;
      }
      flushSegment();
      i++;
      continue;
    }

    if (ch === "|") {
      flushSegment();
      i += command[i + 1] === "|" ? 2 : 1;
      continue;
    }

    if (ch === ">") {
      flushWord();
      if (command[i + 1] === "&") {
        const { value, next } = readWord(command, i + 2);
        if (value && !/^(\d+|-)$/.test(value)) noteRedirect(value);
        i = next;
        continue;
      }
      if (command[i + 1] === "(") {
        i += 2;
        continue;
      }
      let j = i + 1;
      if (command[j] === ">") j++;
      else if (command[j] === "|") j++;
      const { value, next } = readWord(command, j);
      noteRedirect(value);
      i = next;
      continue;
    }

    if (ch === "<") {
      flushWord();
      if (command[i + 1] === "<" && command[i + 2] !== "<") {
        let j = i + 2;
        if (command[j] === "-") j++;
        const { value: delimiter, next } = readWord(command, j);
        i = skipHeredoc(command, next, delimiter);
        continue;
      }
      let j = i + 1;
      if (command[j] === "<") j++;
      const { next } = readWord(command, j);
      i = next;
      continue;
    }

    word += ch;
    inWord = true;
    i++;
  }

  flushSegment();
  return segments;
}

function isInPlaceFlag(word) {
  return (
    word === "-i" ||
    word.startsWith("-i.") ||
    word === "--in-place" ||
    word.startsWith("--in-place=")
  );
}

function isInPlaceShortFlag(word) {
  return /^-[A-Za-z]*i(\.\S+)?$/.test(word);
}

function effectiveCommandIndex(words) {
  let i = 0;
  while (i < words.length) {
    while (i < words.length && isAssignment(words[i])) i++;
    if (i >= words.length) return -1;
    if (!WRAPPERS.has(base(words[i]))) return i;
    i++;
    while (i < words.length && (words[i].startsWith("-") || isAssignment(words[i]))) i++;
  }
  return -1;
}

function nestedMutation(words, index) {
  for (let j = index + 1; j < words.length; j++) {
    const word = words[j];
    if (word === "--command" || word === "-c" || /^-[A-Za-z]*c$/.test(word)) {
      const script = words[j + 1];
      if (!script) return null;
      const nested = classifyBashMutation(script);
      return nested.mutating ? `${base(words[index])} -c: ${nested.reason}` : null;
    }
  }
  return null;
}

function commandMutation(command, words, index) {
  if (MUTATING_COMMANDS.has(command)) return command;

  const sub = words[index + 1] || "";
  const rest = words.slice(index + 1);

  if (command === "sed" && rest.some(isInPlaceFlag)) return "sed -i";
  if ((command === "perl" || command === "ruby") && rest.some(isInPlaceShortFlag)) {
    return `${command} -i`;
  }
  if (command === "git") {
    if (GIT_MUTATIONS.has(sub)) return `git ${sub}`;
    if (sub === "stash" && GIT_STASH_MUTATIONS.has(words[index + 2] || "")) {
      return `git stash ${words[index + 2]}`;
    }
    return null;
  }
  if (PACKAGE_MANAGERS.has(command) && PACKAGE_MUTATIONS.has(sub)) {
    return `${command} ${sub}`;
  }
  if ((command === "pip" || command === "pip3") && ["install", "uninstall"].includes(sub)) {
    return `${command} ${sub}`;
  }
  if (["poetry", "cargo"].includes(command) && ["add", "remove", "install"].includes(sub)) {
    return `${command} ${sub}`;
  }
  if (command === "go" && ["get", "install"].includes(sub)) return `go ${sub}`;
  return null;
}

function segmentMutation(words) {
  const index = effectiveCommandIndex(words);
  if (index < 0) return null;
  const command = base(words[index]);
  if (SHELLS.has(command)) return nestedMutation(words, index);
  if (command === "eval") {
    const nested = classifyBashMutation(words.slice(index + 1).join(" "));
    return nested.mutating ? `eval: ${nested.reason}` : null;
  }
  return commandMutation(command, words, index);
}

/**
 * Classifies a bash command as mutating when it would write files.
 *
 * @param {string} command
 * @returns {{ mutating: boolean, reason: string }}
 */
export function classifyBashMutation(command) {
  if (typeof command !== "string" || command.trim() === "") {
    return { mutating: false, reason: "empty command" };
  }
  for (const segment of scanSegments(command)) {
    if (segment.redirect) {
      return { mutating: true, reason: `redirect to ${segment.redirect}` };
    }
    const reason = segmentMutation(segment.words);
    if (reason) return { mutating: true, reason };
  }
  return { mutating: false, reason: "read-only" };
}
