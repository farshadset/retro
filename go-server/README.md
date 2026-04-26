# Go Realtime Chess API

This service is the realtime backend for the chess app.

## Stack

- Go 1.22+
- `github.com/notnil/chess` for move legality and game rules

## API

- `GET /api/health`
- `POST /api/chess/rooms`
- `GET /api/chess/rooms/:roomId`
- `POST /api/chess/rooms/:roomId/join`
- `POST /api/chess/rooms/:roomId/move`
- `POST /api/chess/rooms/:roomId/resign`
- `GET /api/chess/rooms/:roomId/events` (SSE)

## Run locally

```bash
cd go-server
go run .
```

Default port is `4000`.

## Environment variables

- `GO_CHESS_PORT` (default: `4000`)
- `CHESS_STORE_MODE` (current supported value: `memory`)
- `CHESS_ROOM_STORE_MAX_ROOMS` (default: `500`)
- `CHESS_ROOM_STORE_TTL_MS` (default: `21600000`)

