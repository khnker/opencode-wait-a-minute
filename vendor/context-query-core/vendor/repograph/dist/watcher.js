import { watch } from "node:fs";
import { resolve } from "node:path";
import { RepositoryIndexer, defaultDatabasePath } from "./indexer.js";
import { findGitRoot } from "./scanner.js";
export function watchRepository(options) {
    const root = resolve(options.rootDir);
    const dbPath = defaultDatabasePath(root);
    const debounceMs = options.debounceMs ?? 300;
    let timer = null;
    let isIndexing = false;
    let pendingRun = false;
    const triggerIndex = () => {
        if (isIndexing) {
            pendingRun = true;
            return;
        }
        isIndexing = true;
        pendingRun = false;
        findGitRoot(root)
            .then((gitRoot) => {
            const indexer = new RepositoryIndexer(dbPath);
            return indexer.index({ rootDir: gitRoot, databasePath: dbPath }).finally(() => {
                indexer.store.close();
            });
        })
            .then((summary) => {
            if (summary.indexedFiles > 0 || summary.removedFiles > 0) {
                options.onUpdate?.(summary);
            }
        })
            .catch((error) => {
            options.onError?.(error);
        })
            .finally(() => {
            isIndexing = false;
            if (pendingRun) {
                triggerIndex();
            }
        });
    };
    const scheduleRun = () => {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(triggerIndex, debounceMs);
    };
    const watcher = watch(root, { recursive: true }, () => {
        scheduleRun();
    });
    return {
        close() {
            if (timer) {
                clearTimeout(timer);
            }
            watcher.close();
        },
    };
}
//# sourceMappingURL=watcher.js.map