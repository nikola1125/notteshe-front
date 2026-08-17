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
HEALTH_URL="https://notteshe.com/"

echo "→ Building (node-server preset)…"
npm run build:vps

echo "→ Uploading changed files…"
rsync -avz --delete .output "$VPS:$REMOTE/"

echo "→ Uploading env vars…"
# --chmod locks the uploaded secrets to owner-only (600) so no other local
# process on the VPS can read DATABASE_URL / POK / Mailjet / etc.
rsync -avz --chmod=F600 .env.production "$VPS:$REMOTE/.env.production"
rsync -avz --chmod=F600 .env.production "$VPS:$REMOTE/.env"
# Belt-and-suspenders in case an older file already exists world-readable.
ssh "$VPS" "chmod 600 $REMOTE/.env $REMOTE/.env.production"

echo "→ Restarting the app…"
ssh "$VPS" 'sudo systemctl restart notteshe'

# Health-gate: don't report success until the app is actually serving again.
# This narrows the window where a deploy "finishes" while nginx still 502s.
echo "→ Waiting for health…"
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo 000)
  if [ "$code" = "200" ]; then
    echo "✓ Deployed → https://notteshe.com (healthy after ${i}s)"
    exit 0
  fi
  sleep 1
done

echo "⚠ Deployed but health check did not return 200 within 30s — check the service."
exit 1
