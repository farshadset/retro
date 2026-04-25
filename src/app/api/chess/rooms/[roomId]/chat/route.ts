import { getRoomStore } from '@/lib/chess/room-store'
import { asApiError, jsonResponse, parseJson } from '@/lib/chess/http'

interface ChatBody {
  token: string
  kind: 'text' | 'sticker'
  value?: string
  content: string
}

interface Params {
  params: {
    roomId: string
  }
}

export async function POST(request: Request, { params }: Params): Promise<Response> {
  try {
    const body = await parseJson<ChatBody>(request)
    const messageValue = (body.value ?? body.content ?? '').trim()
    const store = getRoomStore()
    const snapshot = store.sendChatMessage({
      roomId: params.roomId,
      token: body.token ?? '',
      kind: body.kind,
      value: messageValue,
    })
    return jsonResponse({ snapshot })
  } catch (error: unknown) {
    const apiError = asApiError(error)
    return jsonResponse({ error: { code: apiError.code, message: apiError.message } }, apiError.status)
  }
}
