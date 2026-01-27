# Sprite Console API

Access sprite consoles and retrieve sprite information via HTTP and WebSocket.

## Endpoints

### Get Sprite URL

```
GET /api/sprites/{sprite-name}/url
```

Retrieve the public URL for a sprite.

**Authentication:** HTTP Basic Auth with API key

**Response:**
```json
{
  "success": true,
  "name": "my-sprite",
  "publicUrl": "https://my-sprite.fly.dev"
}
```

**Example:**
```bash
curl -u "sk_your_api_key:x" \
  https://your-domain.com/api/sprites/my-sprite/url
```

### Console WebSocket

```
WebSocket: /api/sprites/{sprite-name}/console
```

Connect to a sprite's console shell via WebSocket for bidirectional terminal access.

## Authentication

Uses HTTP Basic Authentication with API key:
- Username: Your API key (must start with `sk_` or `rk_`)
- Password: (ignored, can be any value)

## Usage

### Connection

```javascript
// Create WebSocket connection with API key authentication
const spriteName = "my-sprite";
const apiKey = "sk_your_api_key_here";

// Encode credentials for Basic Auth
const credentials = btoa(`${apiKey}:x`);

const ws = new WebSocket(
  `wss://your-domain.com/api/sprites/${spriteName}/console`,
  {
    headers: {
      'Authorization': `Basic ${credentials}`
    }
  }
);
```

### Sending Input

Send terminal input as raw bytes or strings:

```javascript
// Send a command
ws.send("ls -la\n");

// Send special keys (e.g., Ctrl+C)
ws.send("\x03");
```

### Receiving Output

All output from the sprite console (stdout and stderr) is sent as binary data:

```javascript
ws.onmessage = (event) => {
  // event.data contains raw bytes from the console
  console.log(event.data);
};
```

### Handling Connection Events

```javascript
ws.onopen = () => {
  console.log("Connected to sprite console");
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

ws.onclose = (event) => {
  console.log("Disconnected:", event.code, event.reason);
};
```

## Example with wscat

```bash
# Install wscat if needed
npm install -g wscat

# Connect to sprite console
wscat -c "ws://localhost:8081/api/sprites/my-sprite/console" \
  -H "Authorization: Basic $(echo -n 'sk_your_api_key:x' | base64)"
```

## Example with curl (upgrade to WebSocket)

```bash
# Test with websocat (https://github.com/vi/websocat)
websocat -H "Authorization: Basic $(echo -n 'sk_your_api_key:x' | base64)" \
  "ws://localhost:8081/api/sprites/my-sprite/console"
```

## Example Node.js Client

```javascript
const WebSocket = require('ws');

const spriteName = 'my-sprite';
const apiKey = 'sk_your_api_key_here';

// Create WebSocket with authentication
const ws = new WebSocket(
  `ws://localhost:8081/api/sprites/${spriteName}/console`,
  {
    headers: {
      'Authorization': `Basic ${Buffer.from(`${apiKey}:x`).toString('base64')}`
    }
  }
);

ws.on('open', () => {
  console.log('Connected to sprite console');

  // Send a command
  ws.send('whoami\n');

  // Wait a bit then exit
  setTimeout(() => {
    ws.send('exit\n');
  }, 1000);
});

ws.on('message', (data) => {
  // Print console output
  process.stdout.write(data);
});

ws.on('close', () => {
  console.log('Disconnected from sprite console');
});

ws.on('error', (error) => {
  console.error('Error:', error.message);
});
```

## Example Python Client

```python
import asyncio
import websockets
import base64

async def connect_to_sprite_console():
    sprite_name = "my-sprite"
    api_key = "sk_your_api_key_here"

    # Create auth header
    credentials = base64.b64encode(f"{api_key}:x".encode()).decode()
    headers = {
        "Authorization": f"Basic {credentials}"
    }

    uri = f"ws://localhost:8081/api/sprites/{sprite_name}/console"

    async with websockets.connect(uri, extra_headers=headers) as websocket:
        print("Connected to sprite console")

        # Send a command
        await websocket.send("whoami\n")

        # Read output
        while True:
            try:
                message = await websocket.recv()
                print(message.decode(), end='')
            except websockets.exceptions.ConnectionClosed:
                break

asyncio.run(connect_to_sprite_console())
```

## Response Codes

- `101 Switching Protocols` - WebSocket connection established
- `400 Bad Request` - Invalid request or WebSocket upgrade failed
- `401 Unauthorized` - Invalid or missing API key
- `1000` (close code) - Normal closure (console process exited)
- `1011` (close code) - Failed to spawn console process

## Notes

- The connection is bidirectional - you can send input and receive output simultaneously
- The console process is terminated when the WebSocket connection closes
- All data is transmitted as raw bytes to support full terminal functionality
- The endpoint connects to the sprite using the `sprite console` CLI command
- The organization is automatically detected from `~/.sprite-config`
