# vibe-engine CLI

A command-line utility for interacting with the Sprite Console API. This tool allows you to create sprites and connect to their interactive consoles via HTTP/WebSocket, without needing SSH access.

## Features

- **Create Sprites**: Create new sprites via REST API
- **Console Access**: Connect to sprite console shells via WebSocket
- **API Key Authentication**: Secure authentication using API keys
- **Raw Terminal Mode**: Full terminal support with proper TTY handling
- **Environment Variable Support**: Configure via environment variables

## Installation

### Prerequisites

- Go 1.21 or later
- A valid Sprite API key (must start with `sk_` or `rk_`)

### Build from Source

```bash
cd ~/.sprite-mobile/cmd/vibe-engine

# Download dependencies
go mod download

# Build the binary
make build

# Install to ~/bin
make install
```

Or build manually:

```bash
go build -o vibe-engine .
```

### Add to PATH

If you installed to `~/bin`, make sure it's in your PATH:

```bash
export PATH="$PATH:$HOME/bin"
```

Add this to your `~/.bashrc` or `~/.zshrc` to make it permanent.

## Usage

### Basic Commands

```bash
# Show help
vibe-engine help

# Show version
vibe-engine version

# Create a sprite
vibe-engine create <sprite-name> -key <api-key>

# Connect to sprite console
vibe-engine console <sprite-name> -key <api-key>

# Get sprite URL
vibe-engine url <sprite-name> -key <api-key>
```

### Create a Sprite

Create a new sprite with the given name:

```bash
vibe-engine create my-new-sprite -key sk_test_12345

# With custom URL
vibe-engine create my-new-sprite \
  -url https://my-sprite.fly.dev \
  -key sk_test_12345
```

Output:
```
Creating sprite: my-new-sprite
✓ Sprite created successfully: my-new-sprite
Public URL: https://my-new-sprite.fly.dev

Output:
[Creation logs...]
```

### Connect to Console

Connect to an interactive sprite console:

```bash
vibe-engine console my-sprite -key sk_test_12345

# With custom URL
vibe-engine console my-sprite \
  -url wss://my-sprite.fly.dev \
  -key sk_test_12345
```

The console provides a full interactive terminal session. Press `Ctrl+D` or type `exit` to disconnect.

### Get Sprite URL

Get the public URL for an existing sprite:

```bash
vibe-engine url my-sprite -key sk_test_12345

# With custom URL
vibe-engine url my-sprite \
  -url https://my-sprite.fly.dev \
  -key sk_test_12345
```

Output:
```
Getting URL for sprite: my-sprite
https://my-sprite.fly.dev
```

This is useful for scripting and automation where you need to get the URL programmatically.

### Environment Variables

Configure default settings via environment variables:

```bash
# Set API key
export SPRITE_API_KEY=sk_test_12345

# Set base URL
export SPRITE_API_URL=https://my-sprite.fly.dev

# Now you can omit the flags
vibe-engine create my-new-sprite
vibe-engine console my-sprite
vibe-engine url my-sprite
```

Add these to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) to make them permanent.

## Configuration

### API Key

Your API key must start with `sk_` or `rk_`. You can provide it via:

1. `-key` flag
2. `SPRITE_API_KEY` environment variable

### Base URL

The base URL for the API. Defaults:
- `http://localhost:8081` for `create` command
- `ws://localhost:8081` for `console` command

You can override via:
1. `-url` flag
2. `SPRITE_API_URL` environment variable

The tool automatically converts HTTP(S) URLs to WS(S) for console connections.

## Examples

### Example 1: Create and Connect

```bash
# Set credentials once
export SPRITE_API_KEY=sk_test_12345
export SPRITE_API_URL=https://sprite.example.com

# Create a new sprite
vibe-engine create dev-environment

# Connect to its console
vibe-engine console dev-environment

# Once connected, you can run commands
whoami
pwd
ls -la
exit
```

### Example 2: Local Development

```bash
# Using local sprite-mobile instance
vibe-engine create test-sprite \
  -url http://localhost:8081 \
  -key sk_local_test_key

vibe-engine console test-sprite \
  -url ws://localhost:8081 \
  -key sk_local_test_key
```

### Example 3: Remote Sprite

```bash
# Connect to a remote sprite
vibe-engine console production-app \
  -url wss://my-sprite.fly.dev \
  -key sk_prod_key_12345
```

## Console Features

When connected to a console:

- **Full Terminal Support**: Raw terminal mode with proper TTY handling
- **Bidirectional I/O**: Send commands and receive output in real-time
- **Special Keys**: Ctrl+C, Ctrl+D, arrow keys, etc. all work
- **Clean Exit**: Terminal state is properly restored on disconnect

### Console Shortcuts

- `Ctrl+D` or `exit` - Disconnect from console
- `Ctrl+C` - Interrupt current command (or disconnect if no command)
- `Ctrl+Z` - Suspend current command
- Arrow keys - Navigate command history

## Building for Multiple Platforms

Build binaries for all supported platforms:

```bash
make build-all
```

This creates:
- `vibe-engine-linux-amd64`
- `vibe-engine-linux-arm64`
- `vibe-engine-darwin-amd64` (Intel Mac)
- `vibe-engine-darwin-arm64` (Apple Silicon)
- `vibe-engine-windows-amd64.exe`

## Troubleshooting

### "API key required"

Make sure you're providing an API key via `-key` flag or `SPRITE_API_KEY` environment variable.

### "API key must start with 'sk_' or 'rk_'"

Your API key has an invalid format. Contact your administrator for a valid key.

### "unauthorized: invalid API key"

The API key is not valid or has been revoked. Verify your key and try again.

### "connection failed"

Check that:
1. The base URL is correct
2. The sprite exists
3. The sprite-mobile service is running
4. Network connectivity is available

### Terminal misbehaving after disconnect

If the terminal doesn't restore properly after a disconnect, run:

```bash
reset
```

Or press `Ctrl+C` to force exit, which should restore the terminal.

## Development

### Project Structure

```
cmd/vibe-engine/
├── main.go          # Main application code
├── go.mod           # Go module definition
├── Makefile         # Build automation
└── README.md        # This file
```

### Dependencies

- `github.com/gorilla/websocket` - WebSocket client
- `golang.org/x/term` - Terminal handling

### Adding Features

To add new commands:

1. Add a new command case in `main()`
2. Create a command function (e.g., `myNewCommand()`)
3. Add flag parsing and validation
4. Implement the command logic
5. Update the usage text

## License

Same as parent project (sprite-mobile).

## See Also

- [Sprite Console API Documentation](../../CONSOLE_API.md)
- [sprite-mobile README](../../README.md)
- [Implementation Summary](../../IMPLEMENTATION_SUMMARY.md)
