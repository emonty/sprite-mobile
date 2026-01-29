#!/bin/bash
set -e

# Helper script to create and configure a new sprite with sprite-mobile
# Usage: ./create-sprite.sh <sprite-name> [git-repo-url]
#
# Arguments:
#   sprite-name    Name of the sprite to create
#   git-repo-url   Optional git repository URL to clone on the new sprite
#
# Authentication: Uses simple password auth (no Tailscale required)
# Default password: Demopassword

# Handle Ctrl+C gracefully
trap 'echo ""; echo "Aborted."; exit 130' INT

if [ $# -lt 1 ]; then
    echo "Usage: $0 <sprite-name> [git-repo-url]"
    echo ""
    echo "Example: $0 my-new-sprite"
    echo "         $0 my-new-sprite https://github.com/user/repo"
    echo ""
    echo "This script will:"
    echo "  1. Create a new sprite with the given name"
    echo "  2. Make its URL public"
    echo "  3. Transfer .sprite-config from current sprite"
    echo "  4. Run sprite-setup.sh non-interactively"
    echo "  5. Optionally clone a git repository"
    echo ""
    echo "Authentication: Password auth (default: Demopassword)"
    exit 1
fi

SPRITE_NAME="$1"
GIT_REPO="${2:-}"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Retry function for sprite exec commands (new sprites may need time to be ready)
# Uses -http-post to avoid TTY allocation issues when run from non-interactive contexts
sprite_exec_retry() {
    local max_attempts=5
    local delay=3
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if sprite -s "$SPRITE_NAME" -o "$ORG" exec -http-post -- "$@" 2>&1; then
            return 0
        fi

        if [ $attempt -lt $max_attempts ]; then
            echo "  Attempt $attempt failed, retrying in ${delay}s..."
            sleep $delay
            delay=$((delay * 2))  # Exponential backoff
        fi
        attempt=$((attempt + 1))
    done

    echo "  Failed after $max_attempts attempts"
    return 1
}

echo "============================================"
echo "Creating and Configuring Sprite"
echo "============================================"
echo ""
echo "Target sprite: $SPRITE_NAME"
echo ""

# Check if .sprite-config exists
if [ ! -f "$HOME/.sprite-config" ]; then
    echo "Error: ~/.sprite-config not found"
    echo "This file is required to transfer configuration to the new sprite"
    exit 1
fi

# Determine the organization
ORG=$(sprite org list 2>/dev/null | grep "Currently selected org:" | awk '{print $NF}' || echo "")
if [ -z "$ORG" ]; then
    echo "Error: Could not determine current sprite organization"
    echo "Run 'sprite org list' to check your authentication"
    exit 1
fi

echo "Using organization: $ORG"
echo ""

# Step 1: Create sprite (skip if already exists)
echo "Step 1: Creating sprite..."
if sprite list -o "$ORG" 2>/dev/null | grep -q "^${SPRITE_NAME}$"; then
    echo "  Sprite '$SPRITE_NAME' already exists, skipping creation"
else
    if sprite create -o "$ORG" --skip-console "$SPRITE_NAME" 2>&1 | grep -q "Error"; then
        echo "  Warning: Sprite creation failed, but it may already exist"
    else
        echo "  Created sprite: $SPRITE_NAME"
        echo "  Waiting for sprite to be ready..."
        sleep 5
    fi
fi
echo ""

# Step 2: Make URL public
echo "Step 2: Making URL public..."
sprite -s "$SPRITE_NAME" -o "$ORG" url update --auth public
PUBLIC_URL=$(sprite api /v1/sprites/"$SPRITE_NAME" 2>/dev/null | grep -o '"url"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"\([^"]*\)".*/\1/' | head -1)
if [ -n "$PUBLIC_URL" ]; then
    echo "  Public URL: $PUBLIC_URL"
fi
echo ""

# Step 3: Transfer .sprite-config
echo "Step 3: Transferring configuration..."
# Create a temporary file with the config, excluding sprite-specific values
TEMP_CONFIG=$(mktemp)
# Strip sprite-specific URLs and Tailscale settings (not needed with password auth)
grep -v '^SPRITE_PUBLIC_URL=' "$HOME/.sprite-config" 2>/dev/null | \
  grep -v '^TAILSCALE_SERVE_URL=' | \
  grep -v '^TAILSCALE_AUTH_KEY=' > "$TEMP_CONFIG" || cat "$HOME/.sprite-config" > "$TEMP_CONFIG"
# Encode as base64 to avoid shell escaping issues
CONFIG_B64=$(base64 -w0 "$TEMP_CONFIG" 2>/dev/null || base64 "$TEMP_CONFIG" | tr -d '\n')
rm "$TEMP_CONFIG"
# Transfer and decode on target
sprite_exec_retry bash -c "echo '$CONFIG_B64' | base64 -d > ~/.sprite-config && chmod 600 ~/.sprite-config"
echo "  Transferred ~/.sprite-config (excluded sprite-specific URLs and Tailscale)"

# Transfer Claude credentials if they exist
if [ -f "$HOME/.claude/.credentials.json" ]; then
    echo "  Transferring Claude credentials..."
    CREDS_B64=$(base64 -w0 "$HOME/.claude/.credentials.json" 2>/dev/null || base64 "$HOME/.claude/.credentials.json" | tr -d '\n')
    sprite_exec_retry bash -c "mkdir -p ~/.claude && echo '$CREDS_B64' | base64 -d > ~/.claude/.credentials.json && chmod 600 ~/.claude/.credentials.json"
    echo "  Transferred ~/.claude/.credentials.json"
fi

# Transfer Stripe credentials if they exist
if [ -d "$HOME/.config/stripe" ]; then
    echo "  Transferring Stripe credentials..."
    STRIPE_B64=$(tar -czf - -C "$HOME/.config" stripe 2>/dev/null | base64 -w0 2>/dev/null || tar -czf - -C "$HOME/.config" stripe 2>/dev/null | base64 | tr -d '\n')
    sprite_exec_retry bash -c "mkdir -p ~/.config && echo '$STRIPE_B64' | base64 -d | tar -xzf - -C ~/.config"
    echo "  Transferred ~/.config/stripe"
fi
echo ""

# Step 4: Create CLAUDE.md with sprite information
echo "Step 4: Creating CLAUDE.md with sprite information..."
if [ -n "$PUBLIC_URL" ]; then
    # Generate CLAUDE.md content into a temp file, then base64 transfer
    # (heredocs over sprite exec are unreliable)
    CLAUDE_MD_TMP=$(mktemp)
    cat > "$CLAUDE_MD_TMP" << CLAUDE_EOF
# Claude Instructions

## First Steps

Always read \`/.sprite/llm.txt\` at the start of a session to understand the Sprite environment, available services, checkpoints, and network policy.

## Sprite Information

### Public URL
Your sprite's public URL is: $PUBLIC_URL

### Important Notes for Development

When running development servers (e.g., \`npm run dev\`, \`python -m http.server\`, etc.), **DO NOT** communicate localhost URLs to users.

Instead:
- Always use your public URL: $PUBLIC_URL
- Replace \`localhost\` or \`127.0.0.1\` with your sprite domain
- Example: If a dev server runs on port 3000, tell users to visit \`$PUBLIC_URL\` (not \`localhost:3000\`)
- The sprite-mobile proxy forwards root path requests to localhost:3000 automatically

This ensures users can actually access services you run on this sprite.

## Services

### sprite-mobile (port 8080)
- sprite-mobile UI accessible at \`/vibe-engine/\`
- **Proxies port 3000 to root path** - User dev servers run on port 3000

### Port 3000: Standard Dev Server Port

Port 3000 is reserved for user development servers. sprite-mobile automatically proxies all requests to the root path (\`/\`) to \`localhost:3000\`, making your dev server accessible through the public URL.

**How it works:**
- \`/vibe-engine/*\` - sprite-mobile UI (reserved path)
- \`/*\` - Proxied to your dev server on port 3000

**Framework Examples:**

**Vite (React, Vue, Svelte, etc.):**
\`\`\`bash
npm create vite@latest my-app
cd my-app
npm install
# Edit vite.config.js to set port 3000:
export default {
  server: { port: 3000 }
}
npm run dev
# Access at $PUBLIC_URL/
\`\`\`

**Next.js:**
\`\`\`bash
npx create-next-app@latest my-app
cd my-app
npm run dev -- -p 3000
# Access at $PUBLIC_URL/
\`\`\`

**Python HTTP Server:**
\`\`\`bash
python3 -m http.server 3000
# Access at $PUBLIC_URL/
\`\`\`

**Important Notes:**
- The \`/vibe-engine\` path is reserved for sprite-mobile UI
- Always start your dev server on port 3000
- HMR/live reload works automatically through WebSocket proxying
- No authentication required for proxied requests

## Checkpointing

Claude should proactively manage checkpoints:
- Create checkpoints after significant changes or successful implementations
- Before risky operations, create a checkpoint as a restore point
- Use \`sprite-env checkpoint list\` to view available checkpoints
- Use \`sprite-env checkpoint restore <name>\` to restore if needed

## Git Commits

Do NOT add "Co-Authored-By" lines to commit messages. Just write normal commit messages without any co-author attribution.
CLAUDE_EOF
    CLAUDE_MD_B64=$(base64 -w0 "$CLAUDE_MD_TMP" 2>/dev/null || base64 "$CLAUDE_MD_TMP" | tr -d '\n')
    rm "$CLAUDE_MD_TMP"
    sprite_exec_retry bash -c "echo '$CLAUDE_MD_B64' | base64 -d > ~/CLAUDE.md"
    echo "  Created ~/CLAUDE.md"
else
    echo "  Skipped (no public URL available)"
fi
echo ""

# Step 4b: Clone git repository if specified
if [ -n "$GIT_REPO" ]; then
    echo "Step 4b: Cloning git repository..."
    REPO_DIR=$(basename "$GIT_REPO" .git)
    sprite_exec_retry bash -c "cd ~ && git clone '$GIT_REPO'"
    echo "  Cloned $GIT_REPO into ~/$REPO_DIR"

    # Append project repository info to CLAUDE.md
    REPO_SECTION_TMP=$(mktemp)
    cat > "$REPO_SECTION_TMP" << REPO_EOF

## Project Repository

The repository $GIT_REPO has been cloned to ~/$REPO_DIR.
This is the project you should be working in.
REPO_EOF
    REPO_SECTION_B64=$(base64 -w0 "$REPO_SECTION_TMP" 2>/dev/null || base64 "$REPO_SECTION_TMP" | tr -d '\n')
    rm "$REPO_SECTION_TMP"
    sprite_exec_retry bash -c "echo '$REPO_SECTION_B64' | base64 -d >> ~/CLAUDE.md"
    echo "  Added project repository info to ~/CLAUDE.md"
    echo ""
fi

# Step 5: Download setup script
echo "Step 5: Downloading setup script..."
sprite_exec_retry bash -c "curl -fsSL https://raw.githubusercontent.com/emonty/sprite-mobile/main/scripts/sprite-setup.sh -o ~/sprite-setup.sh && chmod +x ~/sprite-setup.sh"
echo "  Downloaded sprite-setup.sh"
echo ""

# Step 6: Run setup script
echo "Step 6: Running setup script (this may take 3-5 minutes)..."
echo ""
sprite_exec_retry bash -c "set -a && source ~/.sprite-config && set +a && export NON_INTERACTIVE=true && cd ~ && ./sprite-setup.sh --name '$SPRITE_NAME' --url '$PUBLIC_URL' all"
echo ""

# Step 7: Verify services
echo "============================================"
echo "Setup Complete!"
echo "============================================"
echo ""
echo "Sprite: $SPRITE_NAME"
if [ -n "$PUBLIC_URL" ]; then
    echo "Public URL: $PUBLIC_URL"
fi
echo ""
echo "Verifying services..."
sprite_exec_retry sprite-env services list | grep -o '"name":"[^"]*"' | sed 's/"name":"/  - /' | sed 's/"$//'
echo ""
echo "To access the sprite:"
if [ -n "$PUBLIC_URL" ]; then
    echo "  Public: $PUBLIC_URL"
fi
echo "  SSH: sprite -s $SPRITE_NAME shell"
echo ""
