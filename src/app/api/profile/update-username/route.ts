import { asProfileApiError, getUserStore } from '@/lib/profile/user-store'

interface UpdateUsernameBody {
  currentUsername: string
  newUsername: string
}

export async function POST(request: Request): Promise<Response> {
  try {
    let body: UpdateUsernameBody
    try {
      body = (await request.json()) as UpdateUsernameBody
    } catch {
      return Response.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } },
        { status: 400 }
      )
    }

    const result = getUserStore().updateUsername({
      currentUsername: body.currentUsername ?? '',
      newUsername: body.newUsername ?? '',
    })

    return Response.json({ user: result }, { status: 200 })
  } catch (error: unknown) {
    const apiError = asProfileApiError(error)
    return Response.json(
      { error: { code: apiError.code, message: apiError.message } },
      { status: apiError.status }
    )
  }
}
