import { asProfileApiError, getUserStore, type UserStoreSnapshot } from '@/lib/profile/user-store'

type JsonRecord = Record<string, unknown>
const PROFILE_STORE_URL = process.env.PROFILE_STORE_URL?.trim() ?? ''
const PROFILE_STORE_TOKEN = process.env.PROFILE_STORE_TOKEN?.trim() ?? ''

function badRequest(message: string): Response {
  return Response.json({ error: { code: 'INVALID_REQUEST', message } }, { status: 400 })
}

function persistenceError(code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status: 503 })
}

type ProfileAction =
  | 'health'
  | 'touch'
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
  | 'game-invite-send'
  | 'game-invite-respond'
  | 'notifications'
  | 'mark-notifications-read'

function normalizeAction(action: string): ProfileAction | null {
  const normalized = action.trim()
  if (!normalized) {
    return null
  }

  if (normalized === 'health') return 'health'
  if (normalized === 'touch' || normalized === 'touch-presence' || normalized === 'touchPresence') return 'touch'
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
  if (
    normalized === 'game-invite-send' ||
    normalized === 'gameInviteSend' ||
    normalized === 'sendGameInvite'
  ) {
    return 'game-invite-send'
  }
  if (
    normalized === 'game-invite-respond' ||
    normalized === 'gameInviteRespond' ||
    normalized === 'respondGameInvite'
  ) {
    return 'game-invite-respond'
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

function persistenceHeaders(): HeadersInit {
  if (!PROFILE_STORE_TOKEN) {
    return {}
  }
  return {
    Authorization: `Bearer ${PROFILE_STORE_TOKEN}`,
  }
}

async function hydrateStoreFromPersistence(): Promise<Response | null> {
  if (!PROFILE_STORE_URL) {
    return null
  }

  try {
    const response = await fetch(PROFILE_STORE_URL, {
      method: 'GET',
      headers: persistenceHeaders(),
      cache: 'no-store',
    })
    if (!response.ok) {
      return persistenceError('PERSISTENCE_READ_FAILED', 'خواندن دیتابیس پروفایل انجام نشد.')
    }
    const snapshot = (await response.json()) as UserStoreSnapshot
    getUserStore().importSnapshot(snapshot)
    return null
  } catch {
    return persistenceError('PERSISTENCE_READ_FAILED', 'اتصال به دیتابیس پروفایل انجام نشد.')
  }
}

async function saveStoreToPersistence(): Promise<Response | null> {
  if (!PROFILE_STORE_URL) {
    return null
  }

  try {
    const snapshot = getUserStore().exportSnapshot()
    const response = await fetch(PROFILE_STORE_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...persistenceHeaders(),
      },
      body: JSON.stringify(snapshot),
      cache: 'no-store',
    })
    if (!response.ok) {
      return persistenceError('PERSISTENCE_WRITE_FAILED', 'ذخیره دیتابیس پروفایل انجام نشد.')
    }
    return null
  } catch {
    return persistenceError('PERSISTENCE_WRITE_FAILED', 'اتصال به دیتابیس پروفایل برای ذخیره انجام نشد.')
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const action = normalizeAction(searchParams.get('action') ?? '')

    if (!action) {
      return badRequest('پارامتر action الزامی است.')
    }

    if (action === 'health') {
      if (PROFILE_STORE_URL) {
        return Response.json({ status: 'ok', persistence: 'configured' }, { status: 200 })
      }
      if (process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV !== 'production') {
        return Response.json({ status: 'ok', persistence: 'in-memory-dev' }, { status: 200 })
      }
      return persistenceError('PERSISTENCE_NOT_CONFIGURED', 'دیتابیس پروفایل در محیط تولید تنظیم نشده است.')
    }

    const hydrationError = await hydrateStoreFromPersistence()
    if (hydrationError) {
      return hydrationError
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
    const hydrationError = await hydrateStoreFromPersistence()
    if (hydrationError) {
      return hydrationError
    }

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

    if (action === 'touch') {
      const result = getUserStore().touch({
        username: (body.username as string | undefined) ?? '',
      })
      const persistenceWriteError = await saveStoreToPersistence()
      if (persistenceWriteError) {
        return persistenceWriteError
      }
      return Response.json({ user: result }, { status: 200 })
    }

    if (action === 'register') {
      const result = getUserStore().register({
        username: (body.username as string | undefined) ?? '',
        password: (body.password as string | undefined) ?? '',
        confirmPassword: (body.confirmPassword as string | undefined) ?? '',
      })
      const persistenceWriteError = await saveStoreToPersistence()
      if (persistenceWriteError) {
        return persistenceWriteError
      }
      return Response.json({ user: result }, { status: 201 })
    }

    if (action === 'login') {
      const result = getUserStore().login({
        username: (body.username as string | undefined) ?? '',
        password: (body.password as string | undefined) ?? '',
      })
      const persistenceWriteError = await saveStoreToPersistence()
      if (persistenceWriteError) {
        return persistenceWriteError
      }
      return Response.json({ user: result }, { status: 200 })
    }

    if (action === 'update-username') {
      const result = getUserStore().updateUsername({
        currentUsername: (body.currentUsername as string | undefined) ?? '',
        newUsername: (body.newUsername as string | undefined) ?? '',
      })
      const persistenceWriteError = await saveStoreToPersistence()
      if (persistenceWriteError) {
        return persistenceWriteError
      }
      return Response.json({ user: result }, { status: 200 })
    }

    if (action === 'change-password') {
      const result = getUserStore().changePassword({
        username: (body.username as string | undefined) ?? '',
        currentPassword: (body.currentPassword as string | undefined) ?? '',
        nextPassword: (body.newPassword as string | undefined) ?? '',
        confirmNextPassword: (body.confirmNewPassword as string | undefined) ?? '',
      })
      const persistenceWriteError = await saveStoreToPersistence()
      if (persistenceWriteError) {
        return persistenceWriteError
      }
      return Response.json({ user: result }, { status: 200 })
    }

    if (action === 'friend-request') {
      const result = getUserStore().sendFriendRequest({
        fromUsername: (body.fromUsername as string | undefined) ?? '',
        toUsername: (body.toUsername as string | undefined) ?? '',
      })
      const persistenceWriteError = await saveStoreToPersistence()
      if (persistenceWriteError) {
        return persistenceWriteError
      }
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
      const persistenceWriteError = await saveStoreToPersistence()
      if (persistenceWriteError) {
        return persistenceWriteError
      }
      return Response.json({ request: result }, { status: 200 })
    }

    if (action === 'friend-cancel-request') {
      const result = getUserStore().cancelOutgoingRequest({
        username: (body.username as string | undefined) ?? '',
        toUsername: (body.toUsername as string | undefined) ?? '',
      })
      const persistenceWriteError = await saveStoreToPersistence()
      if (persistenceWriteError) {
        return persistenceWriteError
      }
      return Response.json({ request: result }, { status: 200 })
    }

    if (action === 'friend-remove') {
      const result = getUserStore().removeFriend({
        username: (body.username as string | undefined) ?? '',
        friendUsername: (body.friendUsername as string | undefined) ?? '',
      })
      const persistenceWriteError = await saveStoreToPersistence()
      if (persistenceWriteError) {
        return persistenceWriteError
      }
      return Response.json({ friend: result }, { status: 200 })
    }

    if (action === 'game-invite-send') {
      const result = getUserStore().sendGameInvite({
        fromUsername: (body.fromUsername as string | undefined) ?? '',
        toUsername: (body.toUsername as string | undefined) ?? '',
        roomId: (body.roomId as string | undefined) ?? '',
        timeControlMinutes: Number(body.timeControlMinutes ?? 0),
        incrementSeconds: Number(body.incrementSeconds ?? 0),
      })
      const persistenceWriteError = await saveStoreToPersistence()
      if (persistenceWriteError) {
        return persistenceWriteError
      }
      return Response.json({ invite: result }, { status: 200 })
    }

    if (action === 'game-invite-respond') {
      const maybeAction = body.action
      if (maybeAction !== 'accept' && maybeAction !== 'reject') {
        return badRequest('مقدار action برای پاسخ درخواست بازی نامعتبر است.')
      }

      const result = getUserStore().respondToGameInvite({
        username: (body.username as string | undefined) ?? '',
        inviteId: (body.inviteId as string | undefined) ?? '',
        action: maybeAction,
      })
      const persistenceWriteError = await saveStoreToPersistence()
      if (persistenceWriteError) {
        return persistenceWriteError
      }
      return Response.json({ response: result }, { status: 200 })
    }

    if (action === 'mark-notifications-read') {
      const notificationIds = Array.isArray(body.notificationIds)
        ? body.notificationIds.filter((item): item is string => typeof item === 'string')
        : []
      const result = getUserStore().markNotificationsRead({
        username: (body.username as string | undefined) ?? '',
        notificationIds,
      })
      const persistenceWriteError = await saveStoreToPersistence()
      if (persistenceWriteError) {
        return persistenceWriteError
      }
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
