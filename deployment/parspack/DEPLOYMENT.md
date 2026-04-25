# ParsPack Deployment Guide (Next.js + Go)

This guide deploys:

- Next.js frontend on port `3000`
- Go realtime API on port `4000`
- Nginx reverse proxy in front

## 1) Server bootstrap

```bash
sudo apt update
sudo apt install -y nginx curl git build-essential

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Go 1.22 (skip if already installed)
wget https://go.dev/dl/go1.22.2.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.22.2.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.profile
source ~/.profile

node -v
npm -v
go version
```

## 2) Clone and configure app

```bash
git clone <REPO_URL> realtime-chess
cd realtime-chess
npm install
cp .env.example .env.production.local
```

Edit `.env.production.local`:

```bash
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_CHESS_API_BASE_URL=https://your-domain.ir

GO_CHESS_PORT=4000
CHESS_STORE_MODE=memory
CHESS_ROOM_STORE_MAX_ROOMS=500
CHESS_ROOM_STORE_TTL_MS=21600000
```

## 3) Build web + Go API

```bash
npm run build
npm run go:build
```

This creates the Go binary in project root as `./chess-api`.

## 4) Start with PM2

```bash
npx pm2 start ecosystem.config.cjs --env production
npx pm2 save
npx pm2 startup
```

Verify:

```bash
npx pm2 status
curl http://127.0.0.1:4000/api/health
```

## 5) Configure Nginx

```bash
sudo cp deployment/parspack/nginx-realtime-chess.conf /etc/nginx/sites-available/realtime-chess
sudo ln -s /etc/nginx/sites-available/realtime-chess /etc/nginx/sites-enabled/realtime-chess
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

The provided config routes:

- `/api/*` -> Go API (`127.0.0.1:4000`)
- all other routes -> Next.js (`127.0.0.1:3000`)

and keeps SSE low latency with buffering disabled.

## 6) SSL

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.ir
```

## 7) Deploy updates

```bash
git pull
npm install
npm run build
npm run go:build
npx pm2 reload realtime-chess-web realtime-chess-api --update-env
```

## 8) Useful checks

```bash
# frontend through nginx
curl https://your-domain.ir

# go backend through nginx
curl https://your-domain.ir/api/health

# direct process logs
npx pm2 logs realtime-chess-web
npx pm2 logs realtime-chess-api
```

## 9) One-command bootstrap (fresh Ubuntu)

If you want full automated setup on a fresh server, run:

```bash
curl -fsSL https://raw.githubusercontent.com/farshadset/retro/cursor/chess-realtime-app-5487/deployment/parspack/bootstrap.sh -o bootstrap.sh
bash bootstrap.sh your-domain.ir
```

Optional env vars:

```bash
BRANCH=cursor/chess-realtime-app-5487
APP_DIR=/opt/realtime-chess
ENABLE_SSL=true
CERTBOT_EMAIL=you@example.com
bash bootstrap.sh your-domain.ir
```

The script installs Node + Go + Nginx, builds both services, runs PM2, configures Nginx, and can provision SSL.

## 10) Docker offline bundle (best for Iran-access VPS)

If your VPS cannot pull global images/packages reliably, build everything locally and upload a ready bundle.

### Build bundle on your local machine (with international internet)

```bash
bash deployment/parspack/docker-bundle.sh
```

Output:
- `docker-dist.tar.gz`

### Deploy bundle on VPS

```bash
scp docker-dist.tar.gz root@YOUR_SERVER_IP:/opt/
ssh root@YOUR_SERVER_IP
cd /opt
tar -xzf docker-dist.tar.gz
cd docker-dist
cp .env.example .env
# edit .env and set NEXT_PUBLIC_CHESS_API_BASE_URL=https://your-domain.ir
bash run-on-server.sh
```

This starts 3 containers:
- `retrochess-web` (Next.js)
- `retrochess-api` (Go)
- `retrochess-gateway` (Nginx on port 80)
