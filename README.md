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

## Tech Stack

- **Frontend**: Next.js App Router, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js Route Handlers (`/api/chess/...`)
- **Game Engine**: `chess.js`
- **Realtime Transport**: SSE (`text/event-stream`)

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

## API Surface

- `POST /api/chess/rooms` — create room
- `GET /api/chess/rooms/:roomId` — get latest snapshot
- `POST /api/chess/rooms/:roomId/join` — join as player or spectator
- `POST /api/chess/rooms/:roomId/move` — submit move
- `POST /api/chess/rooms/:roomId/resign` — resign game
- `GET /api/chess/rooms/:roomId/events` — subscribe to realtime events (SSE)

## Project Structure

```text
src/
├── app/
│   ├── api/chess/rooms/**      # Realtime chess API routes
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/chess/           # Lobby + board + game UI
└── lib/chess/                  # Room store, types, client API, helpers
```
