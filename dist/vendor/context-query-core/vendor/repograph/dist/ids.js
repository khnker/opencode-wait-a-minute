import { createHash } from "node:crypto";
export function stableId(...parts) {
    return createHash("sha1").update(parts.join("\0")).digest("hex");
}
export function fileNodeId(path) {
    return stableId("file", path);
}
export function symbolNodeId(kind, filePath, name, startLine, startColumn) {
    return stableId(kind, filePath, name, String(startLine), String(startColumn));
}
//# sourceMappingURL=ids.js.map