# Realtime Chess Arena

A high-performance full-stack realtime chess web app with:

- **Next.js frontend** (UI and pages)
- **Go backend** (realtime chess API + SSE)

## Features

- Realtime room-based multiplayer using Server-Sent Events (SSE)
- Create / join game rooms with shareable links
- Legal move validation and game-state engine (checkmate, draw, timeout, resignation)
- Built-in chess clocks with configurable base time + increment
- Live move list, last-move highlight, and player status panels
- Responsive board UX with clean dark theme

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Go 1.22+ (`go-server/`) using `github.com/notnil/chess`
- **Realtime transport**: SSE (`text/event-stream`)
- **Process manager**: PM2 (two processes: web + api)
- **Reverse proxy**: Nginx

## Quick Start (local)

Install JS dependencies:

```bash
npm install
```

Run frontend:

```bash
npm run dev
```

Run Go API in another terminal:

```bash
npm run go:run
```

Frontend: `http://localhost:3000`  
Go API: `http://localhost:4000`

## Environment

Copy template:

```bash
cp .env.example .env.production.local
```

Important vars:

```bash
PORT=3000
NEXT_PUBLIC_CHESS_API_BASE_URL=https://api.your-domain.ir

GO_CHESS_PORT=4000
CHESS_STORE_MODE=memory
CHESS_ROOM_STORE_MAX_ROOMS=500
CHESS_ROOM_STORE_TTL_MS=21600000
```

## API Surface (Go backend)

- `POST /api/chess/rooms` — create room
- `GET /api/chess/rooms/:roomId` — get latest snapshot
- `POST /api/chess/rooms/:roomId/join` — join as player or spectator
- `POST /api/chess/rooms/:roomId/move` — submit move
- `POST /api/chess/rooms/:roomId/resign` — resign game
- `GET /api/chess/rooms/:roomId/events` — subscribe to realtime events (SSE)
- `GET /api/health` — health and runtime details

## Deployment (ParsPack Startup)

Ready deployment artifacts:

- `ecosystem.config.cjs`
- `deployment/parspack/nginx-realtime-chess.conf`
- `deployment/parspack/DEPLOYMENT.md`
- `deployment/parspack/bootstrap.sh` (one-command Ubuntu bootstrap)
- `deployment/parspack/docker-bundle.sh` (build/export Docker offline bundle)
- `docker-compose.yml` + `docker/*` (web/api/gateway containers)

For your current testing target (around 10 concurrent users), this architecture is suitable on a modest VPS.

## Docker offline bundle (for Iran-access VPS)

When your server cannot access international registries, build/export Docker images on your local machine:

```bash
bash deployment/parspack/docker-bundle.sh
```

This creates `docker-dist.tar.gz`. Upload to server and run:

```bash
tar -xzf docker-dist.tar.gz
cd docker-dist
bash run-on-server.sh
```
