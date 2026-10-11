import type { GraphStore } from "./storage.js";
import type { GraphNode } from "./types.js";
export interface PathResult {
    source: GraphNode;
    target: GraphNode;
    path: GraphNode[];
    distance: number;
}
export interface CycleResult {
    cycle: GraphNode[];
}
export declare function findPath(store: GraphStore, sourceIdOrName: string, targetIdOrName: string): PathResult | null;
export declare function findCycles(store: GraphStore): CycleResult[];
export declare function exportGraph(store: GraphStore, format?: "json" | "graphml"): string;
//# sourceMappingURL=query.d.ts.map