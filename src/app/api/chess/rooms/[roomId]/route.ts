import { getRoomStore } from '@/lib/chess/room-store'
import { asApiError, jsonResponse } from '@/lib/chess/http'

interface RouteContext {
  params: {
    roomId: string
  }
}

export async function GET(_: Request, context: RouteContext): Promise<Response> {
  try {
    const store = getRoomStore()
    const snapshot = store.getRoomSnapshot(context.params.roomId)
    return jsonResponse({ snapshot })
  } catch (error: unknown) {
    const apiError = asApiError(error)
    return jsonResponse({ error: { code: apiError.code, message: apiError.message } }, apiError.status)
  }
}
