import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { ensureDirectories, getSession } from "./lib/storage";
import { cleanupStaleProcesses } from "./lib/claude";
import { handleApi } from "./routes/api";
import { websocketHandlers, allClients } from "./routes/websocket";
import { initNetwork, registerSprite, updateHeartbeat, buildSpriteRegistration, isNetworkEnabled } from "./lib/network";
import { initTasksNetwork } from "./lib/distributed-tasks";
import { getSessionFromCookie, validateSession, requiresAuth, validateApiKey } from "./lib/auth";

// Load .env file if present
const ENV_FILE = join(import.meta.dir, ".env");
if (existsSync(ENV_FILE)) {
  const envContent = readFileSync(ENV_FILE, "utf-8");
  for (const line of envContent.split("\n")) {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join("=").trim();
    }
  }
}

// Configuration
const PORT = parseInt(process.env.PORT || "8081");
const PUBLIC_DIR = join(import.meta.dir, "public");

// Proxy configuration
const VIBE_ENGINE_PREFIX = '/vibe-engine';
const DEV_SERVER_PORT = 3000;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Ensure data directories exist
ensureDirectories();

// CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function addCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

function getContentType(path: string): string {
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".js")) return "text/javascript";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  return "text/plain";
}

// Proxy HTTP requests to dev server
async function proxyToDevServer(req: Request, url: URL): Promise<Response> {
  try {
    const targetUrl = `${DEV_SERVER_URL}${url.pathname}${url.search}`;

    // Filter out Accept-Encoding to get uncompressed response from dev server
    // This prevents double-compression issues with Fly.io edge
    const headers = new Headers(req.headers);
    headers.delete('Accept-Encoding');

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    });

    // Read body fully to ensure proper content-length and avoid streaming issues
    const body = await response.arrayBuffer();

    // Copy headers but remove any encoding-related ones to let Fly.io handle compression
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('Content-Encoding');
    responseHeaders.delete('Transfer-Encoding');

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(getDevServerDownHtml(), {
      status: 502,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Error page when dev server is not running
function getDevServerDownHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dev Server Not Running</title>
  <style>
    body {
      margin: 0;
      background: #1a1a2e;
      color: #e5e5e5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
      box-sizing: border-box;
    }
    .container {
      max-width: 600px;
      background: #252542;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
    h1 {
      margin: 0 0 1rem 0;
      color: #d4a574;
      font-size: 1.5rem;
    }
    p {
      margin: 0.5rem 0;
      line-height: 1.6;
      color: #b8b8b8;
    }
    .code {
      background: #1a1a2e;
      padding: 0.75rem;
      border-radius: 6px;
      font-family: monospace;
      font-size: 0.9rem;
      color: #fff;
      margin: 0.5rem 0;
      overflow-x: auto;
    }
    .section {
      margin: 1.5rem 0;
    }
    .section h2 {
      margin: 0 0 0.5rem 0;
      font-size: 1.1rem;
      color: #d4a574;
    }
    a {
      color: #6c5ce7;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .btn {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.75rem 1.5rem;
      background: #6c5ce7;
      color: #fff;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
    }
    .btn:hover {
      background: #5b4bc4;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚠️ Dev Server Not Running</h1>
    <p>Port 3000 is the standard port for user development servers on this sprite.</p>
    <p>To access your application through this interface, start your dev server on port 3000.</p>

    <div class="section">
      <h2>Quick Start Examples:</h2>

      <p><strong>Vite (React, Vue, etc.):</strong></p>
      <div class="code">npm create vite@latest my-app<br>cd my-app<br>npm install<br># Edit vite.config.js to set server.port: 3000<br>npm run dev</div>

      <p><strong>Next.js:</strong></p>
      <div class="code">npx create-next-app@latest my-app<br>cd my-app<br>npm run dev -- -p 3000</div>

      <p><strong>Bun:</strong></p>
      <div class="code">bun run --watch --port 3000 server.ts</div>

      <p><strong>Python:</strong></p>
      <div class="code">python3 -m http.server 3000</div>
    </div>

    <div class="section">
      <h2>Important Notes:</h2>
      <p>• The <code>/vibe-engine</code> path is reserved for the sprite-mobile UI</p>
      <p>• All other paths are proxied to localhost:3000</p>
      <p>• WebSocket connections (for HMR) are also proxied</p>
    </div>

    <a href="${VIBE_ENGINE_PREFIX}/" class="btn">Go to Sprite Mobile UI</a>
  </div>
</body>
</html>`;
}

// Start server
const server = Bun.serve({
  port: PORT,

  async fetch(req, server) {
    const url = new URL(req.url);

    // Check if this is a vibe-engine request
    const isVibeEngine = url.pathname.startsWith(VIBE_ENGINE_PREFIX);

    // Strip prefix for vibe-engine requests
    let pathname = url.pathname;
    let strippedUrl = url;
    if (isVibeEngine) {
      pathname = url.pathname.slice(VIBE_ENGINE_PREFIX.length) || '/';
      strippedUrl = new URL(pathname + url.search, url.origin);
    }

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // If not vibe-engine, check for WebSocket upgrade (dev server proxy)
    if (!isVibeEngine) {
      const upgradeHeader = req.headers.get('upgrade');
      if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
        const upgraded = server.upgrade(req, {
          data: { type: 'dev-server-proxy', url: url }
        });
        if (upgraded) return undefined;
      }

      // HTTP proxy to dev server
      return await proxyToDevServer(req, url);
    }

    // Authentication check - skip for public paths
    if (requiresAuth(pathname)) {
      const cookieHeader = req.headers.get("cookie");
      const sessionToken = getSessionFromCookie(cookieHeader);

      if (!validateSession(sessionToken)) {
        // For API requests, return 401
        if (pathname.startsWith("/api/") || pathname === "/ws" || pathname === "/ws/keepalive") {
          return new Response("Unauthorized", { status: 401 });
        }
        // For page requests, redirect to login
        return new Response(null, {
          status: 302,
          headers: { Location: `${VIBE_ENGINE_PREFIX}/login.html` },
        });
      }
    }

    // API routes
    if (pathname.startsWith("/api/")) {
      const response = await handleApi(req, strippedUrl);
      if (response) return addCorsHeaders(response);
    }

    // Keepalive WebSocket
    if (pathname === "/ws/keepalive") {
      const upgraded = server.upgrade(req, { data: { type: "keepalive" } });
      if (!upgraded) return new Response("WebSocket upgrade failed", { status: 400 });
      return undefined;
    }

    // Chat WebSocket
    if (pathname === "/ws") {
      const sessionId = url.searchParams.get("session");
      if (!sessionId) return new Response("Missing session ID", { status: 400 });

      const session = getSession(sessionId);
      if (!session) return new Response("Session not found", { status: 404 });

      const upgraded = server.upgrade(req, {
        data: { sessionId, cwd: session.cwd, claudeSessionId: session.claudeSessionId }
      });
      if (!upgraded) return new Response("WebSocket upgrade failed", { status: 400 });
      return undefined;
    }

    // Sprite Console WebSocket - API key authenticated
    if (pathname.match(/^\/api\/sprites\/[^/]+\/console$/)) {
      const spriteName = pathname.split("/")[3];

      // Validate API key
      const authHeader = req.headers.get("Authorization");
      if (!validateApiKey(authHeader)) {
        return new Response("Unauthorized", {
          status: 401,
          headers: { "WWW-Authenticate": 'Basic realm="API Key Required"' }
        });
      }

      const upgraded = server.upgrade(req, {
        data: { type: "sprite-console", spriteName }
      });
      if (!upgraded) return new Response("WebSocket upgrade failed", { status: 400 });
      return undefined;
    }

    // Static files
    let filePath = pathname === "/" ? "/index.html" : pathname;
    try {
      const content = readFileSync(join(PUBLIC_DIR, filePath));
      return new Response(content, {
        headers: { "Content-Type": getContentType(filePath) },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  },

  websocket: websocketHandlers,
});

// Cleanup stale processes every minute
setInterval(cleanupStaleProcesses, 60 * 1000);

// Initialize sprite network for discovery
const networkEnabled = initNetwork();
if (networkEnabled) {
  // Register this sprite on startup
  const spriteInfo = buildSpriteRegistration();
  registerSprite(spriteInfo)
    .then(() => console.log(`Registered in sprite network as: ${spriteInfo.hostname}`))
    .catch((err) => console.error("Failed to register in sprite network:", err));

  // Heartbeat every 5 minutes to update lastSeen
  setInterval(() => {
    updateHeartbeat().catch((err) => console.error("Heartbeat failed:", err));
  }, 5 * 60 * 1000);
}

// Initialize distributed tasks
const tasksEnabled = initTasksNetwork();
if (tasksEnabled) {
  console.log("Distributed tasks enabled");
} else {
  console.log("Distributed tasks disabled (no credentials)");
}

// Hot-reloading disabled to prevent constant app refreshes during conversations
// If you need hot-reload during development, uncomment this block:
// let reloadDebounce: ReturnType<typeof setTimeout> | null = null;
// watch(PUBLIC_DIR, { recursive: true }, (event, filename) => {
//   if (reloadDebounce) clearTimeout(reloadDebounce);
//   reloadDebounce = setTimeout(() => {
//     console.log(`File changed: ${filename}, notifying ${allClients.size} clients to reload`);
//     const msg = JSON.stringify({ type: "reload" });
//     for (const ws of allClients) {
//       try {
//         if (ws.readyState === 1) ws.send(msg);
//       } catch {}
//     }
//   }, 300);
// });

console.log(`Claude Mobile server running on http://localhost:${PORT}`);
