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

const API_BASE_URL = (process.env.NEXT_PUBLIC_CHESS_API_BASE_URL ?? '').trim().replace(/\/$/, '')

function apiUrl(path: string): string {
  if (!path.startsWith('/')) {
    throw new Error('API path must start with "/".')
  }
  return `${API_BASE_URL}${path}`
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
  quickMatch?: boolean
  matchAnyTimeControl?: boolean
}): Promise<SessionResponse> {
  const response = await fetch(apiUrl('/api/chess/rooms'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseApiResponse<SessionResponse>(response)
}

export async function joinRoom(input: { roomId: string; name: string }): Promise<SessionResponse> {
  const response = await fetch(apiUrl(`/api/chess/rooms/${input.roomId}/join`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name }),
  })
  return parseApiResponse<SessionResponse>(response)
}

export async function fetchRoom(roomId: string): Promise<SnapshotResponse> {
  const response = await fetch(apiUrl(`/api/chess/rooms/${roomId}`), {
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
  const response = await fetch(apiUrl(`/api/chess/rooms/${input.roomId}/move`), {
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
  const response = await fetch(apiUrl(`/api/chess/rooms/${input.roomId}/resign`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: input.token }),
  })
  return parseApiResponse<SnapshotResponse>(response)
}

export function roomEventsUrl(roomId: string): string {
  return apiUrl(`/api/chess/rooms/${roomId}/events`)
}
