import { asProfileApiError, getUserStore } from '@/lib/profile/user-store'

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username') ?? ''
    const query = searchParams.get('query') ?? ''

    const result = getUserStore().searchUsers({
      username,
      query,
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
