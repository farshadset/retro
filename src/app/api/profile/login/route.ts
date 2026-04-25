import { asProfileApiError, getUserStore } from '@/lib/profile/user-store'

interface LoginBody {
  username: string
  password: string
}

export async function POST(request: Request): Promise<Response> {
  try {
    let body: LoginBody
    try {
      body = (await request.json()) as LoginBody
    } catch {
      return Response.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } },
        { status: 400 }
      )
    }

    const result = getUserStore().login({
      username: body.username ?? '',
      password: body.password ?? '',
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
