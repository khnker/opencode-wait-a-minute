import type { IndexSummary } from "./types.js";
export interface WatcherOptions {
    rootDir: string;
    debounceMs?: number;
    onUpdate?: (summary: IndexSummary) => void;
    onError?: (error: unknown) => void;
}
export declare function watchRepository(options: WatcherOptions): {
    close: () => void;
};
//# sourceMappingURL=watcher.d.ts.map