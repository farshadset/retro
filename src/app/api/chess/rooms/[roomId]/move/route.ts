import { getRoomStore } from '@/lib/chess/room-store'
import { asApiError, jsonResponse, parseJson } from '@/lib/chess/http'

interface MoveBody {
  token: string
  from: string
  to: string
  promotion?: 'q' | 'r' | 'b' | 'n'
}

export async function POST(
  request: Request,
  context: { params: { roomId: string } }
): Promise<Response> {
  try {
    const body = await parseJson<MoveBody>(request)
    const roomId = context.params.roomId
    const snapshot = getRoomStore().makeMove({
      roomId,
      token: body.token ?? '',
      from: body.from ?? '',
      to: body.to ?? '',
      promotion: body.promotion,
    })
    return jsonResponse({ snapshot })
  } catch (error: unknown) {
    const apiError = asApiError(error)
    return jsonResponse({ error: { code: apiError.code, message: apiError.message } }, apiError.status)
  }
}
