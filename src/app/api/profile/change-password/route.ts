import { asProfileApiError, getUserStore } from '@/lib/profile/user-store'

interface ChangePasswordBody {
  username: string
  currentPassword: string
  newPassword: string
  confirmNewPassword: string
}

export async function POST(request: Request): Promise<Response> {
  try {
    let body: ChangePasswordBody
    try {
      body = (await request.json()) as ChangePasswordBody
    } catch {
      return Response.json(
        { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } },
        { status: 400 }
      )
    }

    const result = getUserStore().changePassword({
      username: body.username ?? '',
      currentPassword: body.currentPassword ?? '',
      nextPassword: body.newPassword ?? '',
      confirmNextPassword: body.confirmNewPassword ?? '',
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
