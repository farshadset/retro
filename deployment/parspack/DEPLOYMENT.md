# ParsPack Startup Deployment Guide (Single Instance)

This guide prepares the app for **ParsPack Startup plan** with the current chess runtime architecture.

## Runtime Strategy

- **Current store mode**: `memory`
- **Scaling constraint**: one app instance only
- **Reason**: game state is in-process; multiple workers/nodes would split room state

If you need horizontal scale later, migrate the room store to Redis-backed shared state first, then enable multiple instances.

## 1) Server bootstrap (Ubuntu)

```bash
sudo apt update
sudo apt install -y nginx curl git build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 2) App install

```bash
git clone <REPO_URL> realtime-chess
cd realtime-chess
npm install
cp .env.example .env.production.local
```

Edit `.env.production.local` and keep:

```bash
NODE_ENV=production
PORT=3000
WEB_CONCURRENCY=1
CHESS_STORE_MODE=memory
CHESS_ENFORCE_SINGLE_INSTANCE=true
CHESS_ROOM_STORE_MAX_ROOMS=500
CHESS_ROOM_STORE_TTL_MS=21600000
```

## 3) Build + run with PM2 (single instance)

```bash
npm run build
npx pm2 start ecosystem.config.cjs --env production
npx pm2 save
npx pm2 startup
```

Health check:

```bash
curl http://127.0.0.1:3000/api/health
```

Expected keys:
- `ok: true`
- `runtime.storeMode: "memory"`
- `runtime.singleInstanceOnly: true`

## 4) Nginx reverse proxy (SSE-safe)

```bash
sudo cp deployment/parspack/nginx-realtime-chess.conf /etc/nginx/sites-available/realtime-chess
sudo ln -s /etc/nginx/sites-available/realtime-chess /etc/nginx/sites-enabled/realtime-chess
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

The provided config disables buffering on `/api/chess/rooms/` to keep SSE streams low-latency.

## 5) SSL (recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.ir
```

## 6) Operations

```bash
# deploy updates
git pull
npm install
npm run build
npx pm2 reload realtime-chess --update-env

# logs
npx pm2 logs realtime-chess

# status
npx pm2 status
curl https://your-domain.ir/api/health
```

## 7) Capacity notes for Startup plan

Recommended Startup plan baseline:
- 3 vCPU
- 4GB RAM
- single PM2 instance (`instances: 1`)

This is suitable for your current target (~50 concurrent users) with current feature scope.

## 8) Future scale plan (phase 2)

Before enabling multi-instance:
1. Implement Redis-backed room/session/event storage
2. Set `CHESS_STORE_MODE=redis`
3. Set `REDIS_URL=...`
4. Increase PM2 instances
5. Keep sticky behavior optional (state would be shared)
