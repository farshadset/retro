import { getRoomStore } from '@/lib/chess/room-store'
import { asApiError, jsonResponse, parseJson } from '@/lib/chess/http'

interface JoinRoomBody {
  name: string
  clientId?: string
}

interface Params {
  params: {
    roomId: string
  }
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
  try {
    const body = await parseJson<JoinRoomBody>(request)
    const store = getRoomStore()
    const { snapshot, session } = store.joinRoom({
      roomId: params.roomId,
      name: body.name ?? '',
      clientId: typeof body.clientId === 'string' ? body.clientId : undefined,
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
