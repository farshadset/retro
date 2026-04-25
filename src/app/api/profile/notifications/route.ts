import { asProfileApiError, getUserStore } from '@/lib/profile/user-store'

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username') ?? ''

    const result = getUserStore().getNotifications({ username })
    return Response.json(result, { status: 200 })
  } catch (error: unknown) {
    const apiError = asProfileApiError(error)
    return Response.json(
      { error: { code: apiError.code, message: apiError.message } },
      { status: apiError.status }
    )
  }
}

interface MarkNotificationsReadBody {
  username: string
  notificationIds?: string[]
}

export async function POST(request: Request): Promise<Response> {
  try {
    let body: MarkNotificationsReadBody
    try {
      body = (await request.json()) as MarkNotificationsReadBody
    } catch {
      return Response.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } },
        { status: 400 }
      )
    }

    const result = getUserStore().markNotificationsRead({
      username: body.username ?? '',
      notificationIds: Array.isArray(body.notificationIds) ? body.notificationIds : [],
    })

    return Response.json(result, { status: 200 })
  } catch (error: unknown) {
    const apiError = asProfileApiError(error)
    return Response.json(
      { error: { code: apiError.code, message: apiError.message } },
      { status: apiError.status }
    )
  }
}
