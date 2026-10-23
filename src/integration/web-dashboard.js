import http from "node:http";

export function startWebDashboard({
  sessionTasks,
  sessionRoots,
  sessionWamRoots,
  sessionStore,
  getTaskState,
  resolveSessionBase,
  port = Number(process.env.WAM_WEB_PORT) || 4321,
}) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    if (url.pathname === "/api/sessions") {
      const sessions = [];
      for (const [sid, taskId] of sessionTasks.entries()) {
        const root = sessionRoots.get(sid) || process.cwd();
        const wamRoot = sessionWamRoots.get(sid) || root;
        const taskState = getTaskState(taskId, wamRoot);
        sessions.push({
          sessionId: sid,
          taskId,
          root,
          wamRoot,
          phase: taskState?.phase || "UNKNOWN",
          contract: taskState?.contract || null,
          updatedAt: taskState?.updatedAt || Date.now(),
        });
      }
      // Fallback: list recent sessions from OpenCode DB to capture those not in memory
      try {
        const db = require("node:sqlite").DatabaseSync;
        const sqlitePath = require("node:path").join(
          process.env.HOME || "/home/nicolas",
          ".local/share/opencode/opencode.db"
        );
        if (require("node:fs").existsSync(sqlitePath)) {
          const opDb = new db(sqlitePath, { readOnly: true });
          const rows = opDb.prepare(
            "SELECT id, title, time_created FROM session ORDER BY time_created DESC LIMIT 50"
          ).all();
          for (const row of rows) {
            if (sessionTasks.has(row.id)) continue;
            const now = Date.now();
            const hoursAgo = (now - row.time_created) / 3600000;
            const hourStatus = hoursAgo < 1 ? "current" : hoursAgo < 24 ? "today" : hoursAgo < 168 ? "week" : "older";
            const phase = hourStatus === "current" ? "ACTIVE" : hourStatus;
            sessions.push({
              sessionId: row.id,
              taskId: row.id,
              root: process.cwd(),
              wamRoot: process.cwd(),
              phase,
              contract: null,
              updatedAt: row.time_created,
              title: row.title || null,
            });
          }
        }
      } catch (e) {}
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ sessions }, null, 2));
      return;
    }

    if (url.pathname === "/api/session") {
      const sid = url.searchParams.get("id");
      if (!sid || !sessionTasks.has(sid)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session not found" }));
        return;
      }
      const taskId = sessionTasks.get(sid);
      const root = sessionRoots.get(sid) || process.cwd();
      const wamRoot = sessionWamRoots.get(sid) || root;
      const taskState = getTaskState(taskId, wamRoot);
      const analysis = sessionStore?.get(`${sid}:waitAnalysis`) || null;
      const contract = sessionStore?.get(`${sid}:completionContract`) || taskState?.contract || null;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        sessionId: sid,
        taskId,
        root,
        wamRoot,
        taskState,
        analysis,
        contract,
      }, null, 2));
      return;
    }

    // Serve HTML dashboard
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Wait a Minute - Dashboard de Sesiones</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; background: #0f172a; color: #f8fafc; display: flex; height: 100vh; overflow: hidden; }
    aside { width: 320px; background: #1e293b; border-right: 1px solid #334155; display: flex; flex-direction: column; }
    aside h2 { padding: 16px; margin: 0; font-size: 1.1rem; border-bottom: 1px solid #334155; color: #38bdf8; }
    .session-list { overflow-y: auto; flex: 1; list-style: none; padding: 0; margin: 0; }
    .session-item { padding: 12px 16px; border-bottom: 1px solid #334155; cursor: pointer; transition: background 0.2s; }
    .session-item:hover, .session-item.active { background: #334155; }
    .session-item .sid { font-weight: bold; font-size: 0.9rem; color: #e2e8f0; }
    .session-item .meta { font-size: 0.75rem; color: #94a3b8; margin-top: 4px; display: flex; justify-content: space-between; }
    .badge { padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; text-transform: uppercase; }
    .badge.INIT { background: #64748b; color: #fff; }
    .badge.ASKING { background: #eab308; color: #000; }
    .badge.APPROVED { background: #3b82f6; color: #fff; }
    .badge.IMPLEMENTING { background: #8b5cf6; color: #fff; }
    .badge.DONE { background: #22c55e; color: #fff; }
    main { flex: 1; display: flex; flex-direction: column; background: #0f172a; overflow: hidden; }
    header { padding: 16px 24px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; }
    header h1 { margin: 0; font-size: 1.2rem; }
    .content { flex: 1; padding: 24px; overflow-y: auto; }
    pre { background: #1e293b; padding: 16px; border-radius: 8px; border: 1px solid #334155; overflow-x: auto; font-size: 0.85rem; color: #38bdf8; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .card h3 { margin-top: 0; color: #38bdf8; font-size: 1rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; }
  </style>
</head>
<body>
  <aside>
    <h2>Sesiones Activas (WAM)</h2>
    <ul id="sessionList" class="session-list">
      <li style="padding: 16px; color: #94a3b8;">Cargando sesiones...</li>
    </ul>
  </aside>
  <main>
    <header>
      <h1 id="selectedTitle">Selecciona una sesión</h1>
      <span id="selectedPhase" class="badge INIT">INACTIVA</span>
    </header>
    <div class="content" id="sessionContent">
      <p style="color: #94a3b8;">Haz clic en una sesión en el panel izquierdo para ver el detalle de su etapa, contrato y tareas.</p>
    </div>
  </main>
  <script>
    let currentSessionId = null;

    async function fetchSessions() {
      try {
        const res = await fetch('/api/sessions');
        const data = await res.json();
        const list = document.getElementById('sessionList');
        if (!data.sessions || data.sessions.length === 0) {
          list.innerHTML = '<li style="padding: 16px; color: #94a3b8;">No hay sesiones activas</li>';
          return;
        }
        list.innerHTML = data.sessions.map(s => \`
          <li class="session-item \${currentSessionId === s.sessionId ? 'active' : ''}" onclick="selectSession('\${s.sessionId}')">
            <div class="sid">\${s.sessionId.slice(0, 12)}... (\${s.taskId})</div>
            <div class="meta">
              <span>\${s.root.split('/').pop()}</span>
              <span class="badge \${s.phase}">\${s.phase}</span>
            </div>
          </li>
        \`).join('');
      } catch (e) {
        console.error(e);
      }
    }

    async function selectSession(sid) {
      currentSessionId = sid;
      fetchSessions();
      try {
        const res = await fetch(\`/api/session?id=\${sid}\`);
        const data = await res.json();
        document.getElementById('selectedTitle').innerText = \`Sesión: \${data.sessionId} (\${data.taskId})\`;
        const phaseEl = document.getElementById('selectedPhase');
        const phase = data.taskState?.phase || 'UNKNOWN';
        phaseEl.className = \`badge \${phase}\`;
        phaseEl.innerText = phase;

        let html = \`
          <div class="grid">
            <div class="card">
              <h3>Información General</h3>
              <p><strong>Workspace Root:</strong> \${data.root}</p>
              <p><strong>WAM Root:</strong> \${data.wamRoot}</p>
              <p><strong>Task ID:</strong> \${data.taskId}</p>
            </div>
            <div class="card">
              <h3>Fase Actual</h3>
              <p><strong>Fase:</strong> \${phase}</p>
              <p><strong>Actualizado:</strong> \${new Date(data.taskState?.updatedAt || Date.now()).toLocaleTimeString()}</p>
            </div>
          </div>
        \`;

        if (data.contract) {
          html += \`
            <div class="card">
              <h3>Contrato de Tarea</h3>
              <p><strong>Objetivo:</strong> \${data.contract.goal || 'N/A'}</p>
              <p><strong>Requisitos:</strong> \${(data.contract.requirements || []).length}</p>
              <ul>
                \${(data.contract.requirements || []).map(r => \`<li>[\${r.status}] \${r.title}</li>\`).join('')}
              </ul>
            </div>
          \`;
        }

        if (data.taskState) {
          html += \`
            <div class="card">
              <h3>Estado Completo (JSON)</h3>
              <pre>\${JSON.stringify(data.taskState, null, 2)}</pre>
            </div>
          \`;
        }

        document.getElementById('sessionContent').innerHTML = html;
      } catch (e) {
        console.error(e);
      }
    }

    setInterval(fetchSessions, 3000);
    fetchSessions();
  </script>
</body>
</html>`);
  });

  server.listen(port, () => {
    console.log(`[wait-a-minute] Web dashboard running at http://localhost:${port}`);
  });

  return server;
}
