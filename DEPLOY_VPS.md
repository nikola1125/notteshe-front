# Deploying Notteshe to the OVH VPS

VPS: `ubuntu@57.131.139.53` · Ubuntu 24.04 · 4 vCore / 8 GB / 75 GB
App runs as a Node server (Nitro `node-server`) behind nginx with Let's Encrypt SSL.

The build output in `.output/` is self-contained — no `node_modules` needed on the server.

---

## Phase 1 — Build locally (on your Mac)

```bash
cd /Users/comi/Documents/notteshe
npm run build:vps          # produces ./.output (self-contained, ~12 MB)
```

## Phase 2 — Create the production env file (on your Mac)

Copy `.env.local` to `.env.production` and change these for production:

```
NODE_ENV=production
PORT=3000
BETTER_AUTH_URL=https://notteshe.al        # or your final domain (https)
APP_URL=https://notteshe.al                # used for POK webhooks
BETTER_AUTH_SECRET=<run: openssl rand -base64 32>   # replace the placeholder!
# keep: DATABASE_URL, CLOUDINARY_*, GOOGLE_CLIENT_*, RESEND_API_KEY, EMAIL_FROM,
#       POK_KEY_ID, POK_KEY_SECRET, POK_MERCHANT_ID, POK_ENV
```

> Until DNS + SSL are ready you can temporarily set BETTER_AUTH_URL / APP_URL to
> `http://57.131.139.53`, then switch to the https domain after Phase 6.

## Phase 3 — First-time VPS setup (SSH in and run once)

```bash
ssh ubuntu@57.131.139.53

# system
sudo apt update && sudo apt -y upgrade

# Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v

# nginx + certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# app directory
mkdir -p /home/ubuntu/notteshe
exit
```

## Phase 4 — Upload the app (from your Mac)

```bash
cd /Users/comi/Documents/notteshe
rsync -avz --delete .output ubuntu@57.131.139.53:/home/ubuntu/notteshe/
scp .env.production ubuntu@57.131.139.53:/home/ubuntu/notteshe/.env
```

## Phase 5 — Run it as a service (SSH in)

```bash
ssh ubuntu@57.131.139.53
sudo tee /etc/systemd/system/notteshe.service >/dev/null <<'EOF'
[Unit]
Description=Notteshe
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/notteshe
ExecStart=/usr/bin/node --env-file=/home/ubuntu/notteshe/.env /home/ubuntu/notteshe/.output/server/index.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now notteshe
sudo systemctl status notteshe --no-pager      # should say "active (running)"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000   # expect 200
```

## Phase 6 — nginx reverse proxy + SSL (SSH in)

Point your domain's DNS **first** (Phase 7), then:

```bash
sudo tee /etc/nginx/sites-available/notteshe >/dev/null <<'EOF'
server {
    listen 80;
    server_name notteshe.al www.notteshe.al;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/notteshe /etc/nginx/sites-enabled/notteshe
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# SSL (needs DNS already pointing here)
sudo certbot --nginx -d notteshe.al -d www.notteshe.al
```

## Phase 7 — DNS

Point the domain at the VPS:

```
A     @      57.131.139.53
A     www    57.131.139.53
```

- `.al` → set these records in the **Host.al** DNS panel.
- `.com` → set them wherever you register it (Cloudflare / Namecheap).

## Phase 8 — Post-deploy checklist

- Set BETTER_AUTH_URL and APP_URL in `.env` to `https://<domain>` and restart:
  `sudo systemctl restart notteshe`
- Add the production callback to **Google OAuth** (Google Cloud Console →
  Credentials → Authorized redirect URIs): `https://<domain>/api/auth/callback/google`
  and origin `https://<domain>`.
- POK webhooks will use APP_URL — make sure it's the https domain.

---

## Updating the site later

**One command:**
```bash
npm run deploy
```
This builds, uploads only changed files, and restarts the app. (It runs `scripts/deploy.sh`.)

### One-time setup for `npm run deploy`

So the deploy runs without stopping for passwords, do these once:

1. **Passwordless SSH** — from your Mac:
   ```bash
   ssh-copy-id ubuntu@57.131.139.53      # enter the VPS password once
   ```

2. **Passwordless restart** — on the VPS, allow the `ubuntu` user to restart the app
   without a sudo password:
   ```bash
   echo 'ubuntu ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart notteshe' | sudo tee /etc/sudoers.d/notteshe-restart
   sudo chmod 440 /etc/sudoers.d/notteshe-restart
   ```

After that, every update is just `npm run deploy`.

### Manual equivalent (if you ever skip the script)
```bash
npm run build:vps
rsync -avz --delete .output ubuntu@57.131.139.53:/home/ubuntu/notteshe/
ssh ubuntu@57.131.139.53 'sudo systemctl restart notteshe'
```

> If the VPS IP ever changes, update it in `scripts/deploy.sh`.
