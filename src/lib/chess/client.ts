import { RoomSession, RoomSnapshot } from './types'

interface ApiErrorPayload {
  error?: {
    code?: string
    message?: string
  }
}

interface SessionResponse {
  snapshot: RoomSnapshot
  session: RoomSession
}

interface SnapshotResponse {
  snapshot: RoomSnapshot
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & ApiErrorPayload
  if (!response.ok) {
    throw new Error(payload.error?.message ?? 'Request failed.')
  }
  return payload
}

export async function createRoom(input: {
  name: string
  timeControlMinutes: number
  incrementSeconds: number
}): Promise<SessionResponse> {
  const response = await fetch('/api/chess/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseApiResponse<SessionResponse>(response)
}

export async function joinRoom(input: { roomId: string; name: string }): Promise<SessionResponse> {
  const response = await fetch(`/api/chess/rooms/${input.roomId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name }),
  })
  return parseApiResponse<SessionResponse>(response)
}

export async function fetchRoom(roomId: string): Promise<SnapshotResponse> {
  const response = await fetch(`/api/chess/rooms/${roomId}`, {
    method: 'GET',
    cache: 'no-store',
  })
  return parseApiResponse<SnapshotResponse>(response)
}

export async function makeMove(input: {
  roomId: string
  token: string
  from: string
  to: string
  promotion?: 'q' | 'r' | 'b' | 'n'
}): Promise<SnapshotResponse> {
  const response = await fetch(`/api/chess/rooms/${input.roomId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: input.token,
      from: input.from,
      to: input.to,
      promotion: input.promotion,
    }),
  })
  return parseApiResponse<SnapshotResponse>(response)
}

export async function resign(input: { roomId: string; token: string }): Promise<SnapshotResponse> {
  const response = await fetch(`/api/chess/rooms/${input.roomId}/resign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: input.token }),
  })
  return parseApiResponse<SnapshotResponse>(response)
}
