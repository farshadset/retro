# Realtime Chess Arena

A high-performance full-stack real-time chess web app built with Next.js 14, TypeScript, and `chess.js`, inspired by modern experiences like chess.com.

## Features

- Realtime room-based multiplayer using Server-Sent Events (SSE)
- Create / join game rooms with shareable links
- Fully legal move validation and game-state engine (checkmate, draw, timeout, resignation)
- Built-in chess clocks with configurable base time + increment
- Live move list, last-move highlight, and player status panels
- Responsive board UX with clean dark theme
- Spectator support when both player slots are occupied
- Health endpoint for runtime verification (`/api/health`)

## Tech Stack

- **Frontend**: Next.js App Router, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js Route Handlers (`/api/chess/...`)
- **Game Engine**: `chess.js`
- **Realtime Transport**: SSE (`text/event-stream`)
- **Process Manager**: PM2 (production single-instance mode)
- **Reverse Proxy**: Nginx (SSE-safe proxy config)

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Run in development

```bash
npm run dev
```

Open `http://localhost:3000`.

### Production build

```bash
npm run build
npm start
```

## Production Runtime Mode (important)

Current production mode is intentionally:

- `CHESS_STORE_MODE=memory`
- `WEB_CONCURRENCY=1`
- PM2 `instances: 1`

This guarantees consistent room state for live chess games with the current in-memory store.

> Do not run multiple workers/instances in this phase.

### Environment template

Use:

```bash
cp .env.example .env.production.local
```

Then keep at least:

```bash
NODE_ENV=production
PORT=3000
WEB_CONCURRENCY=1
CHESS_STORE_MODE=memory
CHESS_ENFORCE_SINGLE_INSTANCE=true
```

## API Surface

- `POST /api/chess/rooms` — create room
- `GET /api/chess/rooms/:roomId` — get latest snapshot
- `POST /api/chess/rooms/:roomId/join` — join as player or spectator
- `POST /api/chess/rooms/:roomId/move` — submit move
- `POST /api/chess/rooms/:roomId/resign` — resign game
- `GET /api/chess/rooms/:roomId/events` — subscribe to realtime events (SSE)
- `GET /api/health` — runtime health/config status

## Project Structure

```text
src/
├── app/
│   ├── api/chess/rooms/**      # Realtime chess API routes
│   ├── api/health/route.ts     # Runtime health endpoint
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/chess/           # Lobby + board + game UI
└── lib/chess/                  # Room store, types, client API, helpers
```

## ParsPack Startup Deployment

Ready-to-use deployment artifacts were added:

- `ecosystem.config.cjs` (PM2 single-instance config)
- `deployment/parspack/nginx-realtime-chess.conf` (SSE-ready Nginx config)
- `deployment/parspack/DEPLOYMENT.md` (step-by-step deploy guide)

Recommended plan baseline:

- 3 vCPU
- 4GB RAM
- Single PM2 instance

## Future Scale Plan (Redis phase)

The runtime config is prepared for a future Redis mode, but the room store is currently memory-based by design.

When you start phase 2:

1. Implement Redis-backed room/session/event storage
2. Set `CHESS_STORE_MODE=redis`
3. Set `REDIS_URL=...`
4. Increase PM2 instances horizontally
