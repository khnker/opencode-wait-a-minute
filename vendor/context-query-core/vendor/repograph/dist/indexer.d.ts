import { GraphStore } from "./storage.js";
import type { IndexOptions, IndexSummary, RepositoryFile } from "./types.js";
export declare class RepositoryIndexer {
    readonly store: GraphStore;
    constructor(databasePath: string);
    index(options: IndexOptions): Promise<IndexSummary>;
}
export declare function resolveImportPath(file: RepositoryFile, specifier: string, repositoryPaths: Set<string>): string | null;
export declare function defaultDatabasePath(rootDir: string): string;
//# sourceMappingURL=indexer.d.ts.map