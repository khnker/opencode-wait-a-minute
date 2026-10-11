import type { NodeKind } from "./types.js";
export declare function stableId(...parts: string[]): string;
export declare function fileNodeId(path: string): string;
export declare function symbolNodeId(kind: NodeKind, filePath: string, name: string, startLine: number, startColumn: number): string;
//# sourceMappingURL=ids.d.ts.map