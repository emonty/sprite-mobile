# Quick Start Guide

Get up and running with `vibe-engine` in 5 minutes.

## 1. Build the Tool

```bash
cd ~/.sprite-mobile/cmd/vibe-engine
make build
```

This creates the binary at `bin/vibe-engine`.

## 2. Set Up Environment

Add your API key to your environment:

```bash
export SPRITE_API_KEY=sk_your_api_key_here
export SPRITE_API_URL=http://localhost:8081  # or your sprite URL
```

For permanent configuration, add these to your `~/.bashrc` or `~/.zshrc`:

```bash
echo 'export SPRITE_API_KEY=sk_your_api_key_here' >> ~/.bashrc
echo 'export SPRITE_API_URL=http://localhost:8081' >> ~/.bashrc
source ~/.bashrc
```

## 3. Create Your First Sprite

```bash
./bin/vibe-engine create my-first-sprite
```

You should see:

```
Creating sprite: my-first-sprite
✓ Sprite created successfully: my-first-sprite
Public URL: https://my-first-sprite.fly.dev
```

## 4. Connect to the Console

```bash
./bin/vibe-engine console my-first-sprite
```

You're now in an interactive shell on your sprite! Try some commands:

```bash
whoami
# Output: sprite

pwd
# Output: /home/sprite

ls -la
# See files in the sprite

uname -a
# Check the OS

exit
# Or press Ctrl+D to disconnect
```

## 5. Install Globally (Optional)

To use `vibe-engine` from anywhere:

```bash
make install
```

This installs to `~/bin/vibe-engine`. Make sure `~/bin` is in your PATH:

```bash
export PATH="$PATH:$HOME/bin"
echo 'export PATH="$PATH:$HOME/bin"' >> ~/.bashrc
```

Now you can run it from anywhere:

```bash
vibe-engine console my-first-sprite
```

## Common Workflows

### Workflow 1: Create and Configure

```bash
# Create a new sprite
vibe-engine create dev-environment

# Connect to it
vibe-engine console dev-environment

# Once connected, set up your environment
git clone https://github.com/myuser/myrepo
cd myrepo
npm install
exit
```

### Workflow 2: Quick Commands

If you just need to run a quick command without an interactive session:

```bash
# You can pipe commands, but note that the console is fully interactive
# For non-interactive commands, consider using sprite exec instead
sprite -s my-sprite exec -- ls -la
```

### Workflow 3: Multiple Sprites

```bash
# Create multiple sprites
vibe-engine create frontend
vibe-engine create backend
vibe-engine create database

# Connect to any of them
vibe-engine console frontend
vibe-engine console backend
vibe-engine console database
```

## Tips and Tricks

### 1. Use Environment Variables

Instead of passing `-key` every time:

```bash
export SPRITE_API_KEY=sk_your_key
vibe-engine create sprite1
vibe-engine console sprite1
```

### 2. Different URLs for Different Environments

```bash
# Local development
export SPRITE_API_URL=http://localhost:8081
vibe-engine console local-dev

# Production
export SPRITE_API_URL=https://prod-sprite.fly.dev
vibe-engine console production
```

### 3. Check Version

```bash
vibe-engine version
```

### 4. Get Help

```bash
vibe-engine help
vibe-engine create -h
vibe-engine console -h
```

### 5. Terminal Issues

If your terminal gets messed up after a disconnect:

```bash
reset
```

Or just open a new terminal tab.

## Troubleshooting

### "API key required"

You forgot to set `SPRITE_API_KEY` or pass `-key`:

```bash
export SPRITE_API_KEY=sk_your_key
# OR
vibe-engine create my-sprite -key sk_your_key
```

### "unauthorized: invalid API key"

Your API key is wrong or expired. Get a new one and update your environment.

### "connection failed"

Make sure:
1. Your sprite exists: `sprite list`
2. sprite-mobile is running: `sprite-env services list`
3. The URL is correct: check `SPRITE_API_URL`

### "command not found: vibe-engine"

You haven't installed it or `~/bin` isn't in your PATH:

```bash
make install
export PATH="$PATH:$HOME/bin"
```

## Next Steps

- Read the [full README](README.md) for detailed documentation
- Check out the [Console API docs](../../CONSOLE_API.md)
- Explore the [sprite-mobile README](../../README.md)

## Examples

### Example: Automated Setup Script

```bash
#!/bin/bash
# automated-setup.sh - Create and configure a sprite

SPRITE_NAME="auto-configured"

echo "Creating sprite..."
vibe-engine create "$SPRITE_NAME"

echo "Waiting for sprite to be ready..."
sleep 10

echo "Configuring sprite..."
# Note: For automated commands, consider using 'sprite exec' instead
sprite -s "$SPRITE_NAME" exec -- bash -c '
  git config --global user.name "My Name"
  git config --global user.email "my@email.com"
  echo "Setup complete"
'

echo "Done! Connect with: vibe-engine console $SPRITE_NAME"
```

### Example: Health Check Script

```bash
#!/bin/bash
# health-check.sh - Check if a sprite is responsive

SPRITE_NAME="$1"

if [ -z "$SPRITE_NAME" ]; then
  echo "Usage: $0 <sprite-name>"
  exit 1
fi

echo "Checking $SPRITE_NAME..."

# Try to create a console connection
timeout 5 vibe-engine console "$SPRITE_NAME" <<EOF
echo "HEALTH_OK"
exit
EOF

if [ $? -eq 0 ]; then
  echo "✓ $SPRITE_NAME is responsive"
else
  echo "✗ $SPRITE_NAME is not responding"
  exit 1
fi
```

## Security Notes

- Never commit your API key to git
- Use environment variables or secure secret management
- Your API key has the same permissions as your user
- Console access is not sandboxed - be careful what you run

## Support

For issues or questions:
- Check the [main README](../../README.md)
- Review [troubleshooting section](README.md#troubleshooting)
- Open an issue on GitHub
