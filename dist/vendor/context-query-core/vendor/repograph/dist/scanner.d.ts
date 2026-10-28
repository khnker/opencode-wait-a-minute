import type { RepositoryFile, ScanOptions, SourceLanguage } from "./types.js";
export declare function findGitRoot(startDir: string): Promise<string>;
export declare function languageForPath(path: string): SourceLanguage;
export declare function scanRepository(options: ScanOptions): Promise<RepositoryFile[]>;
export declare function isIndexableSource(file: RepositoryFile): boolean;
export declare function isGeneratedPath(path: string): boolean;
//# sourceMappingURL=scanner.d.ts.map