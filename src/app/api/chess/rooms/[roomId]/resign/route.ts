import { getRoomStore } from '@/lib/chess/room-store'
import { asApiError, jsonResponse, parseJson } from '@/lib/chess/http'

interface ResignBody {
  token: string
}

interface Params {
  params: {
    roomId: string
  }
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
  try {
    const body = await parseJson<ResignBody>(request)
    const store = getRoomStore()
    const snapshot = store.resign({
      roomId: params.roomId,
      token: body.token ?? '',
    })
    return jsonResponse({ snapshot })
  } catch (error: unknown) {
    const apiError = asApiError(error)
    return jsonResponse({ error: { code: apiError.code, message: apiError.message } }, apiError.status)
  }
}
