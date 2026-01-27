# vibe-link CLI Implementation

## Overview

A Go-based CLI utility for interacting with the Sprite Console API. Provides commands for creating sprites via REST API and connecting to their interactive consoles via WebSocket.

## Architecture

### Command Structure

```
vibe-link
├── create   - Create a new sprite via REST API
├── console  - Connect to sprite console via WebSocket
├── version  - Show version information
└── help     - Display usage information
```

### Components

1. **HTTP Client** (`createSprite`)
   - Makes POST request to `/api/sprites/create`
   - Sends JSON payload with sprite name
   - Uses Basic Auth with API key
   - Parses and displays response

2. **WebSocket Client** (`connectConsole`)
   - Connects to `/api/sprites/:name/console`
   - Establishes bidirectional communication
   - Handles terminal raw mode
   - Forwards stdin ↔ WebSocket

3. **Terminal Handler**
   - Uses `golang.org/x/term` for raw mode
   - Captures all keyboard input (including Ctrl keys)
   - Properly restores terminal state on exit
   - Handles interrupt signals (Ctrl+C)

### Authentication

Both commands use HTTP Basic Authentication:
- Username: API key (must start with `sk_` or `rk_`)
- Password: ignored (set to "x")
- Header format: `Authorization: Basic base64(apikey:x)`

### Configuration

Supports both flags and environment variables:

| Setting | Flag | Environment Variable | Default |
|---------|------|---------------------|---------|
| API Key | `-key` | `SPRITE_API_KEY` | (required) |
| Base URL | `-url` | `SPRITE_API_URL` | `http://localhost:8081` (create)<br>`ws://localhost:8081` (console) |

Environment variables take precedence over defaults but are overridden by flags.

## Dependencies

```go
github.com/gorilla/websocket v1.5.1  // WebSocket client
golang.org/x/term v0.16.0            // Terminal handling
golang.org/x/net v0.17.0             // Network utilities (indirect)
golang.org/x/sys v0.16.0             // System calls (indirect)
```

## Implementation Details

### Create Command Flow

1. Parse command-line arguments and flags
2. Validate API key format
3. Build JSON request body
4. Create HTTP POST request with Basic Auth
5. Send request to `/api/sprites/create`
6. Parse JSON response
7. Display results (success, URL, output logs)

### Console Command Flow

1. Parse command-line arguments and flags
2. Validate API key format
3. Convert HTTP(S) URL to WS(S) if needed
4. Build WebSocket URL with sprite name
5. Create WebSocket connection with Basic Auth header
6. Put local terminal in raw mode
7. Start two goroutines:
   - Read from WebSocket → Write to stdout
   - Read from stdin → Write to WebSocket
8. Handle errors and cleanup
9. Restore terminal state on exit

### Terminal Raw Mode

Raw mode is essential for proper console functionality:

**Before raw mode:**
- Terminal processes input (line buffering, echo, etc.)
- Special keys (Ctrl+C) handled locally
- Can't send raw bytes to remote shell

**After raw mode:**
- All input sent directly to WebSocket
- No local echo or processing
- Full control of remote terminal
- Special keys (Ctrl+C, Ctrl+D, arrows) work remotely

**Restoration:**
- Automatically restored via `defer`
- Also restored on interrupt signal
- Critical for terminal usability

### Error Handling

| Error Type | Handling |
|------------|----------|
| Missing arguments | Display usage and exit with code 1 |
| Invalid API key | Error message and exit with code 1 |
| Network errors | Display error message and exit with code 1 |
| HTTP 401 | "unauthorized: invalid API key" |
| HTTP non-200 | Display status code and response body |
| WebSocket read/write | Exit loop and restore terminal |
| Terminal setup | Display error and exit |

### Signal Handling

Registers handler for `SIGINT` (Ctrl+C) and `SIGTERM`:
- Restores terminal to normal mode
- Closes WebSocket connection
- Exits cleanly with code 0

## Code Organization

```
main.go (530 lines)
├── main()              - Entry point, command router
├── printUsage()        - Help text
├── createCommand()     - Parse flags and call createSprite
├── consoleCommand()    - Parse flags and call connectConsole
├── createSprite()      - HTTP POST to create sprite
├── connectConsole()    - WebSocket connection with terminal handling
├── isValidAPIKey()     - Validate API key format
└── getEnvOrDefault()   - Environment variable helper
```

## Building

### Local Build

```bash
go build -o vibe-link .
```

### Cross-Platform Build

```bash
GOOS=linux GOARCH=amd64 go build -o vibe-link-linux-amd64 .
GOOS=darwin GOARCH=arm64 go build -o vibe-link-darwin-arm64 .
GOOS=windows GOARCH=amd64 go build -o vibe-link-windows-amd64.exe .
```

### Using Makefile

```bash
make build       # Build for current platform
make build-all   # Build for all platforms
make install     # Build and install to ~/bin
make clean       # Remove build artifacts
```

## Testing

### Manual Testing

```bash
# Test help
./vibe-link help

# Test create (requires valid API key)
./vibe-link create test-sprite -key sk_test_12345 -url http://localhost:8081

# Test console (requires existing sprite)
./vibe-link console test-sprite -key sk_test_12345 -url ws://localhost:8081
```

### Integration Testing

1. Start sprite-mobile server
2. Create test sprite via API
3. Connect to console via API
4. Verify bidirectional communication
5. Test special keys (Ctrl+C, Ctrl+D)
6. Verify clean disconnect

## Security Considerations

1. **API Key Protection**
   - Never logged or displayed in full
   - Passed via environment variable (preferred) or flag
   - Not stored anywhere

2. **TLS Support**
   - Supports wss:// for encrypted WebSocket
   - Validates server certificates
   - Use HTTPS/WSS in production

3. **Input Validation**
   - API key format validation (sk_/rk_ prefix)
   - URL parsing validation
   - Sprite name escaping in URLs

4. **Terminal Security**
   - Raw mode limits local processing
   - All data sent directly to WebSocket
   - Terminal restored even on errors

## Performance

- **Memory**: ~5-10 MB per connection
- **CPU**: Minimal, mostly I/O bound
- **Latency**: WebSocket provides real-time bidirectional communication
- **Buffering**: 1KB buffer for stdin reads

## Future Enhancements

1. **Session Persistence**
   - Reconnect to existing console sessions
   - Resume after network interruption

2. **Terminal Emulation**
   - Full VT100/ANSI support
   - Terminal size negotiation (SIGWINCH)
   - Mouse support

3. **Security**
   - OAuth2 support
   - Token refresh
   - Connection rate limiting

4. **Features**
   - File upload/download
   - Port forwarding
   - SSH key management
   - Multi-console multiplexing

5. **UX Improvements**
   - Spinner/progress indicators
   - Better error messages
   - Color output
   - Tab completion

## Comparison with Alternatives

| Feature | vibe-link | sprite CLI | SSH |
|---------|-----------|-----------|-----|
| Create sprites | ✅ | ✅ | ❌ |
| Console access | ✅ | ✅ | ✅ |
| HTTP/WebSocket | ✅ | ❌ | ❌ |
| No VPN required | ✅ | ❌ | ❌ |
| API key auth | ✅ | ✅ | ❌ (SSH keys) |
| Cross-platform | ✅ | ✅ | ✅ |
| Single binary | ✅ | ✅ | ❌ (client required) |

## Files

```
cmd/vibe-link/
├── main.go              # Main application code (530 lines)
├── go.mod               # Go module definition
├── go.sum               # Dependency checksums
├── Makefile             # Build automation
├── .gitignore           # Git ignore rules
├── README.md            # User documentation
├── QUICKSTART.md        # Quick start guide
├── IMPLEMENTATION.md    # This file
└── bin/                 # Build output (gitignored)
    └── vibe-link       # Compiled binary
```

## License

Same as parent project (sprite-mobile).
