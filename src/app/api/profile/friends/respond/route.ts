import { asProfileApiError, getUserStore } from '@/lib/profile/user-store'

interface RespondFriendRequestBody {
  username: string
  fromUsername: string
  action: 'accept' | 'reject'
}

export async function POST(request: Request): Promise<Response> {
  try {
    let body: RespondFriendRequestBody
    try {
      body = (await request.json()) as RespondFriendRequestBody
    } catch {
      return Response.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } },
        { status: 400 }
      )
    }

    const result = getUserStore().respondToFriendRequest({
      username: body.username ?? '',
      fromUsername: body.fromUsername ?? '',
      action: body.action,
    })

    return Response.json({ request: result }, { status: 200 })
  } catch (error: unknown) {
    const apiError = asProfileApiError(error)
    return Response.json(
      { error: { code: apiError.code, message: apiError.message } },
      { status: apiError.status }
    )
  }
}
