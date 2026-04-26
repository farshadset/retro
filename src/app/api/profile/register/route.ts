import { asProfileApiError, getUserStore } from '@/lib/profile/user-store'

interface RegisterBody {
  username: string
  password: string
  confirmPassword: string
}

export async function POST(request: Request): Promise<Response> {
  try {
    let body: RegisterBody
    try {
      body = (await request.json()) as RegisterBody
    } catch {
      return Response.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } },
        { status: 400 }
      )
    }

    const result = getUserStore().register({
      username: body.username ?? '',
      password: body.password ?? '',
      confirmPassword: body.confirmPassword ?? '',
    })

    return Response.json({ user: result }, { status: 201 })
  } catch (error: unknown) {
    const apiError = asProfileApiError(error)
    return Response.json(
      { error: { code: apiError.code, message: apiError.message } },
      { status: apiError.status }
    )
  }
}
