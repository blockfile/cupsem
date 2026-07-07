# cupsem backend — server deployment guide

Run these on the **server** over SSH (not on your Windows machine). Assumes a fresh
**Ubuntu 22.04 LTS** VPS and a sudo-capable user. Adjust versions/codenames if you use
a different Ubuntu release (notes inline).

> **No domain yet:** nginx will serve over **HTTP on port 80 by IP**. certbot is
> installed now, but an HTTPS cert can only be issued once a domain points at this
> server (final section). Don't run certbot before then.

---

## 0. Prerequisites

- An Ubuntu 22.04 server you can SSH into, e.g. `ssh youruser@SERVER_IP`.
- The server's public IP (call it `SERVER_IP`).

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git build-essential curl ufw
```

## 1. Node.js 20 LTS + npm

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # expect v20.x  (backend requires >= 20)
npm -v
```

## 2. MongoDB (REQUIRED — backend connects on startup)

Pick **one**:

### Option A — MongoDB Atlas (managed, simplest, no server install)
1. Create a free M0 cluster at https://www.mongodb.com/atlas
2. Add a database user + allow the server IP under Network Access.
3. Copy the SRV connection string — you'll put it in `.env` as `MONGODB_URI`
   (`mongodb+srv://user:pass@cluster.xxxx.mongodb.net`). Then **skip to step 3**.

### Option B — local MongoDB Community 7.0 (self-hosted)
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
  | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
  | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
mongosh --eval 'db.runCommand({ ping: 1 })'   # expect { ok: 1 }
```
> Ubuntu 24.04 (noble): MongoDB 7.0's `jammy` repo works, or use the `8.0` repo with
> codename `noble`. Match the codename to your release.
> Local default URI is `mongodb://127.0.0.1:27017` (the backend's default).

## 3. pm2 (process manager — keeps the backend running + restarts on boot/crash)

```bash
sudo npm install -g pm2
pm2 -v
```

## 4. nginx + certbot

```bash
sudo apt install -y nginx
sudo apt install -y certbot python3-certbot-nginx
```

## 5. Create /var/www and clone the backend

```bash
sudo mkdir -p /var/www
sudo chown -R "$USER":"$USER" /var/www
cd /var/www
git clone https://github.com/blockfile/cupsem.git
cd cupsem
npm install
```

## 6. Configure the environment

```bash
cp .env.example .env
nano .env
```

Set at minimum:
```
PORT=3000

# Keep TRUE until you are ready to move real funds (simulates everything, safe).
DRY_RUN=true

# Mongo: Atlas SRV string, or the local default below.
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=cupsem

# Mints — dual rewards: 40% buys $CUPSY, 40% buys $ANSEM, 20% reserve
TOKEN_MINT=<your holder-token mint (create it on pump.fun)>
CUPSY_MINT=6NwarBvDkXhByqVp2Qkq5i9XbtA2B3Bwe8SWGu9vpump
ANSEM_MINT=9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump
CUPSY_BUY_PCT=40
ANSEM_BUY_PCT=40

# Frontend origins allowed to call the API (comma-separated). Add your site here.
CORS_ORIGINS=https://yourfrontend.com

# Protects POST /api/run|pause|resume. Generate one: `openssl rand -hex 32`
API_KEY=<long-random-string>

# ── Only when going LIVE (DRY_RUN=false) ──
# RPC_URL=https://<paid-rpc-helius-or-similar>
# WALLET_PRIVATE_KEY=<base58 or JSON-array secret key>
```

> **Leave `DRY_RUN=true` for the first boot.** Flip to `false` only after you've set a
> funded `WALLET_PRIVATE_KEY` and a paid `RPC_URL`, and you've confirmed everything looks
> right. In DRY_RUN nothing on-chain is touched.

## 7. Start with pm2

```bash
cd /var/www/cupsem
pm2 start server.js --name cupsem
pm2 save
pm2 startup        # prints a `sudo ... ` command — copy/paste & run it to enable on boot
pm2 logs cupsem # watch the logs; Ctrl-C to exit
```

Verify it's up locally:
```bash
curl http://127.0.0.1:3000/        # expect the cupsem JSON banner
```

## 8. nginx reverse proxy (HTTP, no domain yet)

```bash
sudo tee /etc/nginx/sites-available/cupsem >/dev/null <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;          # replace with your domain when you have one

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Server-Sent Events (GET /api/stream): no buffering, keep alive.
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/cupsem /etc/nginx/sites-enabled/cupsem
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t           # config test — must say "ok"/"successful"
sudo systemctl reload nginx
```

## 9. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status
```

Now `http://SERVER_IP/` should return the cupsem banner, and
`http://SERVER_IP/summary` / `http://SERVER_IP/countdown` should return JSON.

## 10. Later — add HTTPS once you have a domain

1. Point the domain's **A record** (and `www`) to `SERVER_IP`. Wait for DNS to propagate.
2. Put the domain into nginx: edit `server_name _;` → `server_name yourdomain.com www.yourdomain.com;`, then `sudo nginx -t && sudo systemctl reload nginx`.
3. Issue the cert (auto-configures HTTPS + renewal):
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo certbot renew --dry-run    # confirm auto-renewal works
```
4. Update the backend `.env` `CORS_ORIGINS` to the `https://` domain and `pm2 restart cupsem`.

---

## Updating the deploy later

```bash
cd /var/www/cupsem
git pull
npm install            # if dependencies changed
pm2 restart cupsem
```

## Going live (real funds) — checklist
- [ ] Paid `RPC_URL` set (public RPC can't enumerate ~55k $CUPSY accounts).
- [ ] Funded `WALLET_PRIVATE_KEY` set (needs SOL beyond the 20% reserve for first-run ATA rent).
- [ ] `TOKEN_MINT` is the real holder-token mint; `CUPSY_MINT` and `ANSEM_MINT` correct.
- [ ] `DRY_RUN=false`, then `pm2 restart cupsem` and watch `pm2 logs cupsem` for the first cycle.
