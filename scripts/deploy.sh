#!/usr/bin/env bash
# One-command deploy to the OVH VPS.
# Usage: npm run deploy
#
# Requires (one-time setup, see DEPLOY_VPS.md):
#   1. Passwordless SSH:  ssh-copy-id ubuntu@57.131.139.53
#   2. Passwordless restart on the VPS (sudoers rule for `systemctl restart notteshe`)
set -euo pipefail

VPS="ubuntu@57.131.139.53"
REMOTE="/home/ubuntu/notteshe"

echo "→ Building (node-server preset)…"
npm run build:vps

echo "→ Uploading changed files…"
rsync -avz --delete .output "$VPS:$REMOTE/"

echo "→ Uploading env vars…"
rsync -avz .env.production "$VPS:$REMOTE/.env.production"
rsync -avz .env.production "$VPS:$REMOTE/.env"

echo "→ Restarting the app…"
ssh "$VPS" 'sudo systemctl restart notteshe'

echo "✓ Deployed → https://notteshe.com"
