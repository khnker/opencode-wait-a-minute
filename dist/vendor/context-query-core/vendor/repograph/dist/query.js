import { fileNodeId } from "./ids.js";
export function findPath(store, sourceIdOrName, targetIdOrName) {
    const sourceNode = store.getNode(sourceIdOrName) ?? store.search(sourceIdOrName, 1)[0]?.node;
    const targetNode = store.getNode(targetIdOrName) ?? store.search(targetIdOrName, 1)[0]?.node;
    if (!sourceNode || !targetNode) {
        return null;
    }
    if (sourceNode.id === targetNode.id) {
        return {
            source: sourceNode,
            target: targetNode,
            path: [sourceNode],
            distance: 0,
        };
    }
    const queue = [
        { id: sourceNode.id, path: [sourceNode.id] },
    ];
    const visited = new Set([sourceNode.id]);
    while (queue.length > 0) {
        const current = queue.shift();
        const edges = store.getEdges(current.id, "outgoing");
        for (const edge of edges) {
            const nextId = edge.targetId;
            if (nextId === targetNode.id) {
                const fullPathIds = [...current.path, nextId];
                const fullPathNodes = fullPathIds
                    .map((id) => store.getNode(id))
                    .filter((n) => n !== null);
                return {
                    source: sourceNode,
                    target: targetNode,
                    path: fullPathNodes,
                    distance: fullPathNodes.length - 1,
                };
            }
            if (!visited.has(nextId)) {
                visited.add(nextId);
                queue.push({ id: nextId, path: [...current.path, nextId] });
            }
        }
    }
    return null;
}
export function findCycles(store) {
    const files = store.getFiles();
    const fileNodes = files
        .map((f) => store.getNode(fileNodeId(f.path)))
        .filter((n) => n !== null);
    const cycles = [];
    const visited = new Set();
    const recursionStack = new Set();
    const pathStack = [];
    function dfs(nodeId) {
        visited.add(nodeId);
        recursionStack.add(nodeId);
        pathStack.push(nodeId);
        const edges = store.getEdges(nodeId, "outgoing");
        for (const edge of edges) {
            const targetId = edge.targetId;
            if (!visited.has(targetId)) {
                dfs(targetId);
            }
            else if (recursionStack.has(targetId)) {
                const cycleStartIndex = pathStack.indexOf(targetId);
                if (cycleStartIndex !== -1) {
                    const cycleIds = pathStack.slice(cycleStartIndex);
                    const cycleNodes = cycleIds
                        .map((id) => store.getNode(id))
                        .filter((n) => n !== null);
                    cycles.push({ cycle: cycleNodes });
                }
            }
        }
        recursionStack.delete(nodeId);
        pathStack.pop();
    }
    for (const fileNode of fileNodes) {
        if (!visited.has(fileNode.id)) {
            dfs(fileNode.id);
        }
    }
    return cycles;
}
export function exportGraph(store, format = "json") {
    const files = store.getFiles();
    const nodes = [];
    const edges = [];
    for (const file of files) {
        const fileNode = store.getNode(fileNodeId(file.path));
        if (fileNode) {
            nodes.push(fileNode);
        }
    }
    const searchHits = store.search("a", 500);
    for (const hit of searchHits) {
        nodes.push(hit.node);
        const nodeEdges = store.getEdges(hit.node.id, "outgoing");
        for (const edge of nodeEdges) {
            edges.push({ sourceId: edge.sourceId, targetId: edge.targetId, kind: edge.kind });
        }
    }
    const uniqueNodes = [...new Map(nodes.map((n) => [n.id, n])).values()];
    if (format === "graphml") {
        const nodeElements = uniqueNodes
            .map((n) => `    <node id="${escapeXml(n.id)}">\n      <data key="name">${escapeXml(n.name)}</data>\n      <data key="kind">${escapeXml(n.kind)}</data>\n      <data key="file">${escapeXml(n.filePath)}</data>\n    </node>`)
            .join("\n");
        const edgeElements = edges
            .map((e, i) => `    <edge id="e${i}" source="${escapeXml(e.sourceId)}" target="${escapeXml(e.targetId)}">\n      <data key="kind">${escapeXml(e.kind)}</data>\n    </edge>`)
            .join("\n");
        return `<?xml version="1.0" encoding="UTF-8"?>\n<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n  <key id="name" for="node" attr.name="name" attr.type="string"/>\n  <key id="kind" for="node" attr.name="kind" attr.type="string"/>\n  <key id="file" for="node" attr.name="file" attr.type="string"/>\n  <key id="kind" for="edge" attr.name="kind" attr.type="string"/>\n  <graph id="RepoGraph" edgedefault="directed">\n${nodeElements}\n${edgeElements}\n  </graph>\n</graphml>`;
    }
    return JSON.stringify({ nodes: uniqueNodes, edges }, null, 2);
}
function escapeXml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
//# sourceMappingURL=query.js.map