import { randomBytes, createHash } from "crypto";

// Hardcoded demo password
const DEMO_PASSWORD = "Demopassword";

// In-memory session store (sessions expire on server restart)
const sessions = new Map<string, { createdAt: number }>();

// Session duration: 24 hours
const SESSION_DURATION = 24 * 60 * 60 * 1000;

// Generate a secure session token
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

// Validate password
export function validatePassword(password: string): boolean {
  return password === DEMO_PASSWORD;
}

// Create a new session
export function createSession(): string {
  const token = generateSessionToken();
  sessions.set(token, { createdAt: Date.now() });
  return token;
}

// Validate a session token
export function validateSession(token: string | null): boolean {
  if (!token) return false;

  const session = sessions.get(token);
  if (!session) return false;

  // Check if session has expired
  if (Date.now() - session.createdAt > SESSION_DURATION) {
    sessions.delete(token);
    return false;
  }

  return true;
}

// Destroy a session
export function destroySession(token: string | null): void {
  if (token) {
    sessions.delete(token);
  }
}

// Extract session token from cookie header
export function getSessionFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map(c => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === "sprite_session") {
      return value;
    }
  }
  return null;
}

// Create session cookie
export function createSessionCookie(token: string): string {
  return `sprite_session=${token}; Path=/vibe-engine; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DURATION / 1000}`;
}

// Create logout cookie (expires immediately)
export function createLogoutCookie(): string {
  return "sprite_session=; Path=/vibe-engine; HttpOnly; SameSite=Strict; Max-Age=0";
}

// Paths that don't require authentication
const PUBLIC_PATHS = [
  "/login.html",
  "/api/login",
  "/api/auth/status",
  "/api/config",  // Needed for wake-up flow before login
  "/api/sprites/create",  // Uses API key auth instead
  "/styles.css",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/sw.js",  // Service worker must be accessible for registration
];

// Check if path is an API key authenticated sprite endpoint
function isSpriteAPIKeyPath(pathname: string): boolean {
  // /api/sprites/:name/url
  // /api/sprites/:name/console
  // /api/sprites/create
  if (pathname === "/api/sprites/create") return true;
  if (pathname.match(/^\/api\/sprites\/[^/]+\/url$/)) return true;
  if (pathname.match(/^\/api\/sprites\/[^/]+\/console$/)) return true;
  return false;
}

// Validate API key from Basic Auth header
// Accepts any key starting with "sk_" or "rk_" as username, password ignored
export function validateApiKey(authHeader: string | null): boolean {
  if (!authHeader) return false;

  // Basic Auth format: "Basic base64(username:password)"
  if (!authHeader.startsWith("Basic ")) return false;

  try {
    const base64Credentials = authHeader.slice(6);
    const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
    const [username] = credentials.split(":");

    // API key must start with "sk_" or "rk_"
    return username.startsWith("sk_") || username.startsWith("rk_");
  } catch {
    return false;
  }
}

// Extract API key from Basic Auth header
export function extractApiKey(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (!authHeader.startsWith("Basic ")) return null;

  try {
    const base64Credentials = authHeader.slice(6);
    const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
    const [username] = credentials.split(":");
    return username;
  } catch {
    return null;
  }
}

// Check if a path requires authentication
export function requiresAuth(pathname: string): boolean {
  // Static assets for login page and public API endpoints
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p))) {
    return false;
  }
  // Sprite API endpoints that use API key auth instead of session cookies
  if (isSpriteAPIKeyPath(pathname)) {
    return false;
  }
  return true;
}
