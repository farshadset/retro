import { asProfileApiError, getUserStore } from '@/lib/profile/user-store'

interface RemoveFriendBody {
  username: string
  friendUsername: string
}

export async function POST(request: Request): Promise<Response> {
  try {
    let body: RemoveFriendBody
    try {
      body = (await request.json()) as RemoveFriendBody
    } catch {
      return Response.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } },
        { status: 400 }
      )
    }

    const result = getUserStore().removeFriend({
      username: body.username ?? '',
      friendUsername: body.friendUsername ?? '',
    })

    return Response.json({ friend: result }, { status: 200 })
  } catch (error: unknown) {
    const apiError = asProfileApiError(error)
    return Response.json(
      { error: { code: apiError.code, message: apiError.message } },
      { status: apiError.status }
    )
  }
}
