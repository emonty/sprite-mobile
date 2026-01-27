# Quick Start Guide

Get up and running with `sprite-api` in 5 minutes.

## 1. Build the Tool

```bash
cd ~/.sprite-mobile/cmd/sprite-api
make build
```

This creates the binary at `bin/sprite-api`.

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
./bin/sprite-api create my-first-sprite
```

You should see:

```
Creating sprite: my-first-sprite
✓ Sprite created successfully: my-first-sprite
Public URL: https://my-first-sprite.fly.dev
```

## 4. Connect to the Console

```bash
./bin/sprite-api console my-first-sprite
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

To use `sprite-api` from anywhere:

```bash
make install
```

This installs to `~/bin/sprite-api`. Make sure `~/bin` is in your PATH:

```bash
export PATH="$PATH:$HOME/bin"
echo 'export PATH="$PATH:$HOME/bin"' >> ~/.bashrc
```

Now you can run it from anywhere:

```bash
sprite-api console my-first-sprite
```

## Common Workflows

### Workflow 1: Create and Configure

```bash
# Create a new sprite
sprite-api create dev-environment

# Connect to it
sprite-api console dev-environment

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
sprite-api create frontend
sprite-api create backend
sprite-api create database

# Connect to any of them
sprite-api console frontend
sprite-api console backend
sprite-api console database
```

## Tips and Tricks

### 1. Use Environment Variables

Instead of passing `-key` every time:

```bash
export SPRITE_API_KEY=sk_your_key
sprite-api create sprite1
sprite-api console sprite1
```

### 2. Different URLs for Different Environments

```bash
# Local development
export SPRITE_API_URL=http://localhost:8081
sprite-api console local-dev

# Production
export SPRITE_API_URL=https://prod-sprite.fly.dev
sprite-api console production
```

### 3. Check Version

```bash
sprite-api version
```

### 4. Get Help

```bash
sprite-api help
sprite-api create -h
sprite-api console -h
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
sprite-api create my-sprite -key sk_your_key
```

### "unauthorized: invalid API key"

Your API key is wrong or expired. Get a new one and update your environment.

### "connection failed"

Make sure:
1. Your sprite exists: `sprite list`
2. sprite-mobile is running: `sprite-env services list`
3. The URL is correct: check `SPRITE_API_URL`

### "command not found: sprite-api"

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
sprite-api create "$SPRITE_NAME"

echo "Waiting for sprite to be ready..."
sleep 10

echo "Configuring sprite..."
# Note: For automated commands, consider using 'sprite exec' instead
sprite -s "$SPRITE_NAME" exec -- bash -c '
  git config --global user.name "My Name"
  git config --global user.email "my@email.com"
  echo "Setup complete"
'

echo "Done! Connect with: sprite-api console $SPRITE_NAME"
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
timeout 5 sprite-api console "$SPRITE_NAME" <<EOF
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
