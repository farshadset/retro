import { asProfileApiError, getUserStore } from '@/lib/profile/user-store'

interface FriendRequestBody {
  fromUsername: string
  toUsername: string
}

export async function POST(request: Request): Promise<Response> {
  try {
    let body: FriendRequestBody
    try {
      body = (await request.json()) as FriendRequestBody
    } catch {
      return Response.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } },
        { status: 400 }
      )
    }

    const result = getUserStore().sendFriendRequest({
      fromUsername: body.fromUsername ?? '',
      toUsername: body.toUsername ?? '',
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
