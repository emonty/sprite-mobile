# Sprite Mobile

A mobile-friendly web interface for chatting with Claude Code. Supports multiple concurrent chat sessions, image uploads, and persistent message history.

## Features

- **Multiple Chat Sessions**: Create and manage multiple independent chat sessions, each with its own Claude Code process
- **Persistent History**: Messages are saved to disk and survive server restarts
- **Session Resume**: Reconnecting to a session resumes the existing Claude conversation
- **Image Support**: Upload and send images to Claude for analysis
- **Real-time Streaming**: Responses stream in real-time via WebSocket
- **Multi-client Support**: Multiple browser tabs can connect to the same session
- **Auto-naming**: Chat sessions are automatically named based on the first message
- **Sprite Profiles**: Save connections to other Sprite instances

## Running

```bash
cd /home/sprite/sprite-mobile
bun run server.ts
```

The server runs on port 8081 by default. Override with the `PORT` environment variable.

## Architecture

### Data Storage

All data is stored in the `data/` directory:

- `sessions.json` - Chat session metadata
- `sprites.json` - Saved Sprite profiles
- `messages/{sessionId}.json` - Message history per session
- `uploads/{sessionId}/` - Uploaded images per session

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List all sessions |
| POST | `/api/sessions` | Create new session |
| PATCH | `/api/sessions/:id` | Update session name/cwd |
| DELETE | `/api/sessions/:id` | Delete session |
| GET | `/api/sessions/:id/messages` | Get message history |
| POST | `/api/sessions/:id/regenerate-title` | Regenerate session title |
| POST | `/api/upload?session={id}` | Upload an image |
| GET | `/api/uploads/:sessionId/:filename` | Retrieve uploaded image |
| GET | `/api/sprites` | List saved Sprite profiles |
| POST | `/api/sprites` | Add a Sprite profile |
| DELETE | `/api/sprites/:id` | Remove a Sprite profile |

### WebSocket

Connect to `/ws?session={sessionId}` to interact with a chat session.

**Incoming messages (from server):**
- `{ type: "history", messages: [...] }` - Message history on connect
- `{ type: "assistant", message: {...} }` - Streaming assistant response
- `{ type: "result", ... }` - Response complete
- `{ type: "user_message", message: {...} }` - User message from another client
- `{ type: "processing", isProcessing: true/false }` - Processing state
- `{ type: "refresh_sessions" }` - Session list changed
- `{ type: "system", message: "..." }` - System notifications

**Outgoing messages (to server):**
```json
{
  "type": "user",
  "content": "Your message here",
  "imageId": "optional-image-id",
  "imageFilename": "optional-filename",
  "imageMediaType": "image/png"
}
```

### Keepalive

A separate WebSocket endpoint at `/ws/keepalive` keeps the Sprite awake while the app is open.

## Session Lifecycle

1. **Creation**: `POST /api/sessions` creates a new session with a working directory
2. **Connection**: WebSocket connection spawns a Claude Code process
3. **Messaging**: Messages are saved and streamed in real-time
4. **Disconnection**: Claude process continues running for 30 minutes
5. **Reconnection**: Rejoins the existing process if still alive, otherwise resumes via Claude's session ID
6. **Cleanup**: Idle processes with no clients are terminated after 30 minutes

## Configuration

Sessions can specify a working directory (`cwd`) that Claude Code operates in. This defaults to the user's home directory.
