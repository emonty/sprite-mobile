# Sprite Console WebSocket API - Implementation Summary

## Overview

Added a new WebSocket endpoint `/api/sprites/:name/console` that provides bidirectional terminal access to sprite console shells. This allows users with HTTP API access (but no shell access) to connect to and interact with a sprite's console remotely.

## Changes Made

### 1. Server Configuration (`server.ts`)

**Added:**
- New WebSocket endpoint handler for `/api/sprites/:name/console`
- API key authentication check before WebSocket upgrade
- Import of `validateApiKey` from `lib/auth`

**Location:** Lines ~116-130

```typescript
// Sprite Console WebSocket - API key authenticated
if (url.pathname.match(/^\/api\/sprites\/[^/]+\/console$/)) {
  const spriteName = url.pathname.split("/")[3];

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
```

### 2. WebSocket Handlers (`routes/websocket.ts`)

**Added:**
- Import statements for Bun's `spawn` and `Subprocess` type
- `SpriteConsoleConnection` interface and connection tracking Map
- Handler for opening sprite console connections
- Handler for forwarding WebSocket messages to sprite console stdin
- Handler for cleanup on connection close

**Key Features:**
- Spawns `sprite console -s <name>` process on WebSocket connect
- Reads organization from `~/.sprite-config` automatically
- Bidirectional streaming between WebSocket and console process
- Forwards both stdout and stderr to the client
- Proper cleanup when WebSocket closes or process exits

**Location:** Throughout websocket.ts file

### 3. Documentation

**Created:**
- `CONSOLE_API.md` - Complete API documentation with examples in:
  - JavaScript/Node.js
  - Python
  - Shell (wscat, websocat)
  - Includes authentication, usage, response codes, and notes

- `test-console-api.js` - Test script for validating the endpoint
  - Command-line tool for testing connections
  - Sends test commands and displays output
  - Demonstrates proper authentication and usage

**Updated:**
- `README.md` - Added new endpoint to API Endpoints table
- Added "Sprite Console WebSocket" section with quick example
- Reference to CONSOLE_API.md for detailed documentation

## How It Works

1. **Client connects** via WebSocket to `/api/sprites/:name/console` with API key in Authorization header
2. **Server validates** the API key (must start with `sk_` or `rk_`)
3. **Server spawns** `sprite console -o <org> -s <name>` process
4. **Bidirectional bridge** established:
   - WebSocket messages → Process stdin
   - Process stdout/stderr → WebSocket messages
5. **On disconnect**, process is terminated and connection cleaned up

## Authentication

Uses the same API key authentication as `/api/sprites/create`:
- HTTP Basic Auth format
- Username: API key (must start with `sk_` or `rk_`)
- Password: ignored (can be anything)

Example:
```
Authorization: Basic base64("sk_your_api_key:x")
```

## Testing

Test the endpoint using the included test script:

```bash
# Using the test script
node ~/.sprite-mobile/test-console-api.js <sprite-name> <api-key>

# Using wscat
wscat -c "ws://localhost:8081/api/sprites/my-sprite/console" \
  -H "Authorization: Basic $(echo -n 'sk_your_api_key:x' | base64)"

# Using websocat
websocat -H "Authorization: Basic $(echo -n 'sk_your_api_key:x' | base64)" \
  "ws://localhost:8081/api/sprites/my-sprite/console"
```

## Security Considerations

1. **API Key Required** - No unauthenticated access to sprite consoles
2. **Per-Connection Process** - Each WebSocket connection spawns a separate console process
3. **Process Isolation** - Console runs with the same permissions as the sprite user
4. **Clean Termination** - Processes are killed when WebSocket closes
5. **Organization Scoped** - Uses organization from `~/.sprite-config` (prevents cross-org access)

## Use Cases

This endpoint enables:
- Remote terminal access via HTTP/WebSocket (no SSH required)
- Web-based terminal emulators (e.g., xterm.js)
- Programmatic sprite console automation
- API-only access to sprite consoles (for users without shell credentials)
- Building custom console UIs and tools

## Files Modified

1. `server.ts` - Added WebSocket endpoint and authentication
2. `routes/websocket.ts` - Added console connection handlers
3. `README.md` - Updated documentation

## Files Created

1. `CONSOLE_API.md` - Complete API documentation
2. `test-console-api.js` - Test client script
3. `IMPLEMENTATION_SUMMARY.md` - This file

## Integration with Existing Code

The implementation follows the same patterns as:
- Chat WebSocket (`/ws`) for connection handling
- Sprite creation endpoint (`/api/sprites/create`) for API key authentication
- Uses existing `validateApiKey()` function from `lib/auth.ts`

No breaking changes to existing functionality.

## Future Enhancements

Potential improvements:
- Add connection timeout handling
- Implement connection rate limiting
- Add terminal size negotiation (SIGWINCH support)
- Support for terminal control codes (colors, cursor movement)
- Connection multiplexing (multiple consoles per WebSocket)
- Session persistence/reconnection
- Audit logging of console commands
