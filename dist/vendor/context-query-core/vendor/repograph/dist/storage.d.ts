import type { GraphEdge, GraphNode, RepositoryFile, SearchResult } from "./types.js";
export declare class GraphStore {
    private readonly database;
    constructor(databasePath: string);
    close(): void;
    getFile(path: string): RepositoryFile | null;
    getFiles(): RepositoryFile[];
    allNodes(): GraphNode[];
    allEdges(): GraphEdge[];
    stats(): {
        files: number;
        nodes: number;
        edges: number;
    };
    upsertFile(file: RepositoryFile): void;
    replaceFileGraph(file: RepositoryFile, nodes: GraphNode[], edges: GraphEdge[], imports: Array<{
        targetPath: string;
        specifier: string;
    }>): void;
    removeFile(path: string): void;
    search(query: string, limit?: number): SearchResult[];
    getDegreeCentrality(nodeId: string): number;
    getNode(idOrPath: string): GraphNode | null;
    getEdges(nodeId: string, direction?: "incoming" | "outgoing" | "both"): GraphEdge[];
    getRelatedNodes(nodeId: string, direction?: "incoming" | "outgoing" | "both"): GraphNode[];
    getImpact(target: string, depth?: number): GraphNode[];
    private prepare;
}
//# sourceMappingURL=storage.d.ts.map