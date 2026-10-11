import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const ledger = new Map();

/**
 * Ledger to track file reads in the current session.
 * Fail-open invariant: all methods are wrapped to never throw.
 */
export const readLedger = {
  digest(content) {
    try {
      return createHash('sha256').update(content).digest('hex');
    } catch (e) {
      return null;
    }
  },

  recordRead(path, content) {
    try {
      const digest = this.digest(content);
      if (!digest) return;
      ledger.set(path, { digest, at: Date.now() });
    } catch (e) {
      // Fail open
    }
  },

  isRedundant(path, content) {
    try {
      const record = ledger.get(path);
      if (!record) return false;
      const currentDigest = this.digest(content);
      return !!currentDigest && record.digest === currentDigest;
    } catch (e) {
      return false;
    }
  },

  getDigest(path) {
    try {
      const record = ledger.get(path);
      return record ? record.digest : null;
    } catch (e) {
      return null;
    }
  },

  checkStale(path, content) {
    try {
      const record = ledger.get(path);
      if (!record) return false;
      const currentDigest = this.digest(content);
      return !!currentDigest && record.digest !== currentDigest;
    } catch (e) {
      return false;
    }
  },

  reset(path) {
    try {
      if (path) {
        ledger.delete(path);
      } else {
        ledger.clear();
      }
    } catch (e) {
      // Fail open
    }
  }
};

export function createFileReadLedger() {
  return readLedger;
}
