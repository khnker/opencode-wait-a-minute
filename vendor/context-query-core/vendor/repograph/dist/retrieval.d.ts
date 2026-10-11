import type { ContextResult, GraphNode, SearchResult } from "./types.js";
import type { GraphStore } from "./storage.js";
export declare class RetrievalEngine {
    readonly store: GraphStore;
    constructor(store: GraphStore);
    search(query: string, limit?: number): SearchResult[];
    context(task: string, limit?: number): Promise<ContextResult[]>;
    dependencies(target: string): GraphNode[];
    dependents(target: string): GraphNode[];
    impact(target: string, depth?: number): GraphNode[];
}
export declare function formatContextResult(result: ContextResult): string;
//# sourceMappingURL=retrieval.d.ts.map