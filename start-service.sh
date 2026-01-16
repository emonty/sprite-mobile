#!/bin/bash
# Wrapper script to start sprite-mobile with environment from .zshrc
# This avoids logging sensitive tokens in service creation commands

# Source zsh environment (where tokens are stored)
if [ -f "$HOME/.zshrc" ]; then
    # Extract just the export statements to avoid zsh-specific commands
    eval "$(grep '^export' "$HOME/.zshrc" | grep -E 'CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY|GH_TOKEN')"
fi

# Start the service
exec bun --hot run "$HOME/.sprite-mobile/server.ts"
