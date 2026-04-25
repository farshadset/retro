import { asProfileApiError, getUserStore } from '@/lib/profile/user-store'

type JsonRecord = Record<string, unknown>

function badRequest(message: string): Response {
  return Response.json({ error: { code: 'INVALID_REQUEST', message } }, { status: 400 })
}

type ProfileAction =
  | 'register'
  | 'login'
  | 'friends'
  | 'search-users'
  | 'update-username'
  | 'change-password'
  | 'friend-request'
  | 'friend-respond'
  | 'friend-cancel-request'
  | 'friend-remove'
  | 'notifications'
  | 'mark-notifications-read'

function normalizeAction(action: string): ProfileAction | null {
  const normalized = action.trim()
  if (!normalized) {
    return null
  }

  if (normalized === 'register') return 'register'
  if (normalized === 'login') return 'login'
  if (normalized === 'friends' || normalized === 'friendsOverview') return 'friends'
  if (normalized === 'search-users' || normalized === 'searchUsers') return 'search-users'
  if (normalized === 'update-username' || normalized === 'updateUsername') return 'update-username'
  if (normalized === 'change-password' || normalized === 'changePassword') return 'change-password'
  if (normalized === 'friend-request' || normalized === 'friendRequest' || normalized === 'sendFriendRequest') {
    return 'friend-request'
  }
  if (normalized === 'friend-respond' || normalized === 'friendRespond' || normalized === 'respondFriendRequest') {
    return 'friend-respond'
  }
  if (
    normalized === 'friend-cancel-request' ||
    normalized === 'friendCancelRequest' ||
    normalized === 'cancelOutgoingRequest'
  ) {
    return 'friend-cancel-request'
  }
  if (normalized === 'friend-remove' || normalized === 'friendRemove' || normalized === 'removeFriend') {
    return 'friend-remove'
  }
  if (normalized === 'notifications') return 'notifications'
  if (normalized === 'mark-notifications-read' || normalized === 'markNotificationsRead') {
    return 'mark-notifications-read'
  }
  return null
}

async function readJsonBody(request: Request): Promise<JsonRecord | Response> {
  try {
    return (await request.json()) as JsonRecord
  } catch {
    return Response.json(
      { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } },
      { status: 400 }
    )
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const action = normalizeAction(searchParams.get('action') ?? '')

    if (!action) {
      return badRequest('پارامتر action الزامی است.')
    }

    if (action === 'friends') {
      const username = searchParams.get('username') ?? ''
      const result = getUserStore().getFriendsOverview({ username })
      return Response.json(result, { status: 200 })
    }

    if (action === 'search-users') {
      const username = searchParams.get('username') ?? ''
      const query = searchParams.get('query') ?? ''
      const result = getUserStore().searchUsers({ username, query })
      return Response.json(result, { status: 200 })
    }

    if (action === 'notifications') {
      const username = searchParams.get('username') ?? ''
      const result = getUserStore().getNotifications({ username })
      return Response.json(result, { status: 200 })
    }

    return badRequest('مقدار action نامعتبر است.')
  } catch (error: unknown) {
    const apiError = asProfileApiError(error)
    return Response.json(
      { error: { code: apiError.code, message: apiError.message } },
      { status: apiError.status }
    )
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const parsedBody = await readJsonBody(request)
    if (parsedBody instanceof Response) {
      return parsedBody
    }
    const body = parsedBody
    const { searchParams } = new URL(request.url)
    const actionFromQuery = searchParams.get('action') ?? ''
    const actionFromBody = typeof body.action === 'string' ? body.action : ''
    const action = normalizeAction(actionFromQuery || actionFromBody)
    if (!action) {
      return badRequest('پارامتر action الزامی است.')
    }

    if (action === 'register') {
      const result = getUserStore().register({
        username: (body.username as string | undefined) ?? '',
        password: (body.password as string | undefined) ?? '',
        confirmPassword: (body.confirmPassword as string | undefined) ?? '',
      })
      return Response.json({ user: result }, { status: 201 })
    }

    if (action === 'login') {
      const result = getUserStore().login({
        username: (body.username as string | undefined) ?? '',
        password: (body.password as string | undefined) ?? '',
      })
      return Response.json({ user: result }, { status: 200 })
    }

    if (action === 'update-username') {
      const result = getUserStore().updateUsername({
        currentUsername: (body.currentUsername as string | undefined) ?? '',
        newUsername: (body.newUsername as string | undefined) ?? '',
      })
      return Response.json({ user: result }, { status: 200 })
    }

    if (action === 'change-password') {
      const result = getUserStore().changePassword({
        username: (body.username as string | undefined) ?? '',
        currentPassword: (body.currentPassword as string | undefined) ?? '',
        nextPassword: (body.newPassword as string | undefined) ?? '',
        confirmNextPassword: (body.confirmNewPassword as string | undefined) ?? '',
      })
      return Response.json({ user: result }, { status: 200 })
    }

    if (action === 'friend-request') {
      const result = getUserStore().sendFriendRequest({
        fromUsername: (body.fromUsername as string | undefined) ?? '',
        toUsername: (body.toUsername as string | undefined) ?? '',
      })
      return Response.json({ request: result }, { status: 200 })
    }

    if (action === 'friend-respond') {
      const maybeAction = body.action
      if (maybeAction !== 'accept' && maybeAction !== 'reject') {
        return badRequest('مقدار action برای پاسخ درخواست دوستی نامعتبر است.')
      }
      const friendAction = maybeAction
      const result = getUserStore().respondToFriendRequest({
        username: (body.username as string | undefined) ?? '',
        fromUsername: (body.fromUsername as string | undefined) ?? '',
        action: friendAction,
      })
      return Response.json({ request: result }, { status: 200 })
    }

    if (action === 'friend-cancel-request') {
      const result = getUserStore().cancelOutgoingRequest({
        username: (body.username as string | undefined) ?? '',
        toUsername: (body.toUsername as string | undefined) ?? '',
      })
      return Response.json({ request: result }, { status: 200 })
    }

    if (action === 'friend-remove') {
      const result = getUserStore().removeFriend({
        username: (body.username as string | undefined) ?? '',
        friendUsername: (body.friendUsername as string | undefined) ?? '',
      })
      return Response.json({ friend: result }, { status: 200 })
    }

    if (action === 'mark-notifications-read') {
      const notificationIds = Array.isArray(body.notificationIds)
        ? body.notificationIds.filter((item): item is string => typeof item === 'string')
        : []
      const result = getUserStore().markNotificationsRead({
        username: (body.username as string | undefined) ?? '',
        notificationIds,
      })
      return Response.json(result, { status: 200 })
    }

    return badRequest('مقدار action نامعتبر است.')
  } catch (error: unknown) {
    const apiError = asProfileApiError(error)
    return Response.json(
      { error: { code: apiError.code, message: apiError.message } },
      { status: apiError.status }
    )
  }
}
