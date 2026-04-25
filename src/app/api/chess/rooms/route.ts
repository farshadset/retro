import { getRoomStore } from '@/lib/chess/room-store'
import { asApiError, jsonResponse, parseJson } from '@/lib/chess/http'

interface CreateRoomBody {
  name: string
  timeControlMinutes?: number
  incrementSeconds?: number
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseJson<CreateRoomBody>(request)
    const minutes = Number(body.timeControlMinutes ?? 10)
    const incrementSeconds = Number(body.incrementSeconds ?? 2)

    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 60) {
      return jsonResponse(
        { error: { code: 'INVALID_TIME_CONTROL', message: 'timeControlMinutes must be between 1 and 60.' } },
        400
      )
    }
    if (!Number.isFinite(incrementSeconds) || incrementSeconds < 0 || incrementSeconds > 30) {
      return jsonResponse(
        { error: { code: 'INVALID_INCREMENT', message: 'incrementSeconds must be between 0 and 30.' } },
        400
      )
    }

    const store = getRoomStore()
    const { snapshot, session } = store.createRoom({
      name: body.name ?? '',
      timeControlMs: Math.floor(minutes * 60_000),
      incrementMs: Math.floor(incrementSeconds * 1_000),
    })

    return jsonResponse({
      snapshot,
      session: {
        token: session.token,
        playerId: session.playerId,
        color: session.color,
        name: session.name,
      },
    })
  } catch (error: unknown) {
    const apiError = asApiError(error)
    return jsonResponse({ error: { code: apiError.code, message: apiError.message } }, apiError.status)
  }
}
