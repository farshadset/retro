import { getRoomStore } from '@/lib/chess/room-store'
import { asApiError, jsonResponse, parseJson } from '@/lib/chess/http'

interface CreateRoomBody {
  name: string
  timeControlMinutes?: number
  incrementSeconds?: number
  quickMatch?: boolean
  matchAnyTimeControl?: boolean
  excludeRoomId?: string
  clientId?: string
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseJson<CreateRoomBody>(request)
    const minutes = Number(body.timeControlMinutes ?? 10)
    const incrementSeconds = Number(body.incrementSeconds ?? 2)
    const quickMatch = Boolean(body.quickMatch)
    const matchAnyTimeControl = Boolean(body.matchAnyTimeControl)
    const excludeRoomId = (body.excludeRoomId ?? '').trim()
    const clientId = (body.clientId ?? '').trim()

    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
      return jsonResponse(
        { error: { code: 'INVALID_TIME_CONTROL', message: 'timeControlMinutes must be between 1 and 1440.' } },
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
    const result = quickMatch
      ? store.quickMatch({
          name: body.name ?? '',
          clientId: clientId || undefined,
          timeControlMs: Math.floor(minutes * 60_000),
          incrementMs: Math.floor(incrementSeconds * 1_000),
          matchAnyTimeControl,
          excludeRoomId: excludeRoomId || undefined,
        })
      : store.createRoom({
          name: body.name ?? '',
          clientId: clientId || undefined,
          timeControlMs: Math.floor(minutes * 60_000),
          incrementMs: Math.floor(incrementSeconds * 1_000),
        })

    return jsonResponse({
      snapshot: result.snapshot,
      session: {
        token: result.session.token,
        playerId: result.session.playerId,
        color: result.session.color,
        name: result.session.name,
      },
    })
  } catch (error: unknown) {
    const apiError = asApiError(error)
    return jsonResponse({ error: { code: apiError.code, message: apiError.message } }, apiError.status)
  }
}
