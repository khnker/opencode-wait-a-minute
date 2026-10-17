/**
 * Audit coalescer — batches audit/trace writes, gates flushes on
 * directory state, skips idempotent (unchanged) writes, and caps
 * task directories.
 *
 * Fail-open by design: every fs interaction is guarded so persistence
 * problems never propagate to callers.
 *
 * ESM, no external dependencies (node builtins only).
 */
import path from "node:path";
import { createHash } from "node:crypto";

const W_OK = 2;

function checksumOf(content) {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * @param {object} options
 * @param {number} [options.maxEntries=50]  flush when buffer reaches this many entries
 * @param {number} [options.maxBytes=65536] flush when serialized buffer reaches this many bytes
 * @param {number} [options.idleMs=2000]    flush when this much time passed since last push
 * @param {string} [options.dirPath]        directory to write into (used when filePath is not set)
 * @param {string} [options.filePath]       explicit target file (defaults to <dirPath>/default.json)
 * @param {number} [options.maxTaskDirs=500] cap for live task directories
 * @param {function} [options.now=Date.now]  injectable clock for tests
 * @param {object} [options.fs]              injectable fs (node:fs compatible) for tests
 * @param {function} [options.log]           injectable logger, default console.error
 * @param {boolean} [options.state=false]    state-coalescing mode: buffer keeps only the latest
 *                                            full snapshot (used when each entry is a complete
 *                                            ledger, e.g. the context-decision trace)
 */
export function createAuditCoalescer(options = {}) {
  const {
    maxEntries = 50,
    maxBytes = 65536,
    idleMs = 2000,
    dirPath,
    filePath,
    maxTaskDirs = 500,
    now = Date.now,
    fs: injectedFs,
    log = (msg) => console.error(msg),
    state = false,
    createIfMissing = false,
  } = options;

  if (!injectedFs || typeof injectedFs.writeFileSync !== "function") {
    throw new TypeError("createAuditCoalescer requires an injectable fs with writeFileSync");
  }

  const fs = injectedFs;

  let buffer = [];
  let bytes = 0;
  let lastChecksum = null;
  let lastPush = 0;
  let timer = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const scheduleIdle = () => {
    if (idleMs <= 0 || typeof setTimeout !== "function") return;
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, idleMs);
    if (typeof timer?.unref === "function") {
      timer.unref();
    }
  };

  const sizeOf = (entry) => {
    try {
      return Buffer.byteLength(JSON.stringify(entry) ?? "null", "utf8");
    } catch {
      // Non-serializable entries are kept but contribute no bytes.
      return 0;
    }
  };

  const serialize = () => {
    if (state) {
      return JSON.stringify(buffer[buffer.length - 1], null, 2);
    }
    return JSON.stringify(buffer, null, 2);
  };

  /**
   * Flush the buffered entries to disk.
   * @returns {{written:boolean, entries:number, reason:string}}
   */
  function flush() {
    if (buffer.length === 0) {
      return { written: false, entries: 0, reason: "empty" };
    }
    const pending = buffer.length;
    const dir = filePath ? path.dirname(filePath) : dirPath;
    const file = filePath || (dirPath ? path.join(dirPath, "default.json") : null);

    // Directory-state gate: missing or unwritable target dir -> skip write,
    // unless the caller opted into creating the directory (createIfMissing).
    try {
      if (!dir || !file) {
        return { written: false, entries: pending, reason: "dir-missing" };
      }
      const dirExists =
        typeof fs.existsSync === "function" ? fs.existsSync(dir) : true;
      if (!dirExists && !createIfMissing) {
        return { written: false, entries: pending, reason: "dir-missing" };
      }
      if (dirExists && typeof fs.accessSync === "function") {
        const mode = (fs.constants && fs.constants.W_OK) ?? W_OK;
        fs.accessSync(dir, mode);
      }
    } catch {
      if (!createIfMissing) {
        return { written: false, entries: pending, reason: "dir-missing" };
      }
    }

    let content;
    try {
      content = serialize();
    } catch {
      // Poison entry: drop it so it cannot block future flushes.
      buffer = [];
      bytes = 0;
      return { written: false, entries: pending, reason: "serialization-error" };
    }

    // Idempotency gate: identical content was already written -> skip.
    const checksum = checksumOf(content);
    if (checksum === lastChecksum) {
      buffer = [];
      bytes = 0;
      return { written: false, entries: pending, reason: "unchanged" };
    }

    try {
      if (typeof fs.mkdirSync === "function") {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(file, content);
    } catch {
      // Keep the buffer so the data is retried on a later flush.
      return { written: false, entries: pending, reason: "write-error" };
    }

    lastChecksum = checksum;
    buffer = [];
    bytes = 0;
    lastPush = now();
    clearTimer();
    try {
      log(`AuditPersist: flushed ${pending} entries`);
    } catch {
      // Logging is best-effort.
    }
    return { written: true, entries: pending, reason: "ok" };
  }

  /**
   * Buffer an entry; flush early when a threshold is hit.
   * @returns {{buffered:number, flushed:boolean}}
   */
  function push(entry) {
    const t = now();
    // Idle gate: flush when the gap since the previous push exceeds
    // the idle window. A fresh coalescer (lastPush === 0) does NOT
    // count as idle — otherwise every first entry would flush
    // immediately and coalescing would never engage.
    const idleDue = lastPush !== 0 && t - lastPush >= idleMs;
    buffer.push(entry);
    lastPush = t;
    bytes += sizeOf(entry);
    let flushed = false;
    if (idleDue || buffer.length >= maxEntries || bytes >= maxBytes) {
      flushed = flush().written;
    } else {
      scheduleIdle();
    }
    return { buffered: buffer.length, flushed };
  }

  /**
   * Cap the number of live subdirectories under `dirPath`, evicting
   * oldest-by-mtime first. Never throws (fail open).
   * @returns {{removed:number, remaining:number}}
   */
  function capTaskDirs(dirPathArg = dirPath, maxDirs = maxTaskDirs) {
    try {
      if (!dirPathArg || typeof fs.readdirSync !== "function" || !fs.existsSync(dirPathArg)) {
        return { removed: 0, remaining: 0 };
      }
      const dirents = fs.readdirSync(dirPathArg, { withFileTypes: true });
      const dirs = [];
      for (const dirent of dirents) {
        if (typeof dirent.isDirectory === "function" && !dirent.isDirectory()) {
          continue;
        }
        let mtime = 0;
        try {
          const stat = fs.statSync(path.join(dirPathArg, dirent.name));
          mtime = stat?.mtimeMs ?? stat?.mtime ?? 0;
        } catch {
          mtime = 0;
        }
        dirs.push({ name: dirent.name, mtime });
      }
      if (dirs.length <= maxDirs) {
        return { removed: 0, remaining: dirs.length };
      }
      // Oldest first; evict everything beyond the cap.
      dirs.sort((a, b) => a.mtime - b.mtime);
      const victims = dirs.slice(0, dirs.length - maxDirs);
      let removed = 0;
      for (const victim of victims) {
        try {
          fs.rmSync(path.join(dirPathArg, victim.name), { recursive: true, force: true });
          removed++;
        } catch {
          // Fail open: skip this one, continue with the rest.
        }
      }
      return { removed, remaining: dirs.length - removed };
    } catch {
      return { removed: 0, remaining: 0 };
    }
  }

  function snapshot() {
    return {
      buffered: buffer.length,
      bytes,
      lastChecksum,
      maxEntries,
      maxBytes,
      idleMs,
      dirPath,
      filePath,
      maxTaskDirs,
    };
  }

  function reset() {
    clearTimer();
    buffer = [];
    bytes = 0;
    lastChecksum = null;
    lastPush = 0;
  }

  return { push, flush, capTaskDirs, snapshot, reset };
}
