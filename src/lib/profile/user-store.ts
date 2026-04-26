import { createHash } from 'crypto'

type FriendRelation = 'none' | 'friend' | 'incoming' | 'outgoing'
type NotificationType =
  | 'friend_request_received'
  | 'friend_request_accepted'
  | 'friend_request_rejected'
  | 'friend_request_canceled'
  | 'friend_removed'
  | 'game_invite_received'
  | 'game_invite_accepted'
  | 'game_invite_rejected'

type GameInviteStatus = 'pending'

interface GameInvite {
  id: string
  from: string
  roomId: string
  timeControlMinutes: number
  incrementSeconds: number
  createdAt: number
  status: GameInviteStatus
}

interface ProfileNotification {
  id: string
  type: NotificationType
  actor: string
  createdAt: number
  read: boolean
}

interface RegisteredUser {
  username: string
  passwordHash: string
  createdAt: number
  lastActiveAt: number | null
  friends: string[]
  incomingRequests: string[]
  outgoingRequests: string[]
  incomingGameInvites: GameInvite[]
  notifications: ProfileNotification[]
}

interface NotificationView {
  id: string
  type: NotificationType
  actorUsername: string
  message: string
  createdAt: number
  read: boolean
}

interface FriendPresenceView {
  username: string
  online: boolean
}

interface GameInviteView {
  id: string
  fromUsername: string
  roomId: string
  timeControlMinutes: number
  incrementSeconds: number
  createdAt: number
}

const ONLINE_WINDOW_MS = 35_000

export interface UserStoreSnapshot {
  users: Array<{ normalizedUsername: string; user: RegisteredUser }>
}

class ProfileApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

class UserStore {
  private usersByName = new Map<string, RegisteredUser>()

  private cloneNotifications(notifications: ProfileNotification[]): ProfileNotification[] {
    return notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      actor: notification.actor,
      createdAt: notification.createdAt,
      read: notification.read,
    }))
  }

  private cloneRegisteredUser(user: RegisteredUser): RegisteredUser {
    return {
      username: user.username,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
      friends: [...user.friends],
      incomingRequests: [...user.incomingRequests],
      outgoingRequests: [...user.outgoingRequests],
      incomingGameInvites: Array.isArray(user.incomingGameInvites)
        ? user.incomingGameInvites.map((invite) => ({
            id: invite.id,
            from: invite.from,
            roomId: invite.roomId,
            timeControlMinutes: invite.timeControlMinutes,
            incrementSeconds: invite.incrementSeconds,
            createdAt: invite.createdAt,
            status: invite.status,
          }))
        : [],
      notifications: this.cloneNotifications(user.notifications),
    }
  }

  exportSnapshot(): UserStoreSnapshot {
    const users: Array<{ normalizedUsername: string; user: RegisteredUser }> = []
    this.usersByName.forEach((user, normalizedUsername) => {
      this.ensureSocialState(user)
      users.push({
        normalizedUsername,
        user: this.cloneRegisteredUser(user),
      })
    })
    return { users }
  }

  importSnapshot(snapshot: UserStoreSnapshot): void {
    this.usersByName.clear()
    if (!snapshot || !Array.isArray(snapshot.users)) {
      return
    }

    snapshot.users.forEach((record) => {
      if (!record || typeof record.normalizedUsername !== 'string' || !record.user) {
        return
      }
      const normalized = this.normalizeUsername(record.normalizedUsername)
      if (!normalized) {
        return
      }
      const cloned = this.cloneRegisteredUser(record.user)
      this.ensureSocialState(cloned)
      this.usersByName.set(normalized, cloned)
    })
  }

  private normalizeUsername(username: string): string {
    return username.trim().toLowerCase()
  }

  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex')
  }

  private generateNotificationId(): string {
    return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
  }

  private ensureSocialState(user: RegisteredUser): void {
    if (!Array.isArray(user.friends)) {
      user.friends = []
    }
    if (!Array.isArray(user.incomingRequests)) {
      user.incomingRequests = []
    }
    if (!Array.isArray(user.outgoingRequests)) {
      user.outgoingRequests = []
    }
    if (!Array.isArray(user.incomingGameInvites)) {
      user.incomingGameInvites = []
    }
    if (!Array.isArray(user.notifications)) {
      user.notifications = []
    }
    if (typeof user.lastActiveAt !== 'number' && user.lastActiveAt !== null) {
      user.lastActiveAt = null
    }
  }

  private markUserActive(user: RegisteredUser): void {
    user.lastActiveAt = Date.now()
  }

  private pushUnique(list: string[], value: string): void {
    if (!list.includes(value)) {
      list.push(value)
    }
  }

  private removeValue(list: string[], value: string): void {
    const index = list.indexOf(value)
    if (index >= 0) {
      list.splice(index, 1)
    }
  }

  private replaceValue(list: string[], oldValue: string, newValue: string): void {
    const index = list.indexOf(oldValue)
    if (index < 0) {
      return
    }
    list[index] = newValue
    this.removeDuplicates(list)
  }

  private removeDuplicates(list: string[]): void {
    const seen = new Set<string>()
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const value = list[index]
      if (seen.has(value)) {
        list.splice(index, 1)
      } else {
        seen.add(value)
      }
    }
  }

  private getUserByNormalizedUsername(normalized: string, errorMessage = 'کاربر موردنظر پیدا نشد.'): RegisteredUser {
    const user = this.usersByName.get(normalized)
    if (!user) {
      throw new ProfileApiError(404, 'USER_NOT_FOUND', errorMessage)
    }
    this.ensureSocialState(user)
    return user
  }

  private getDisplayUsername(normalized: string): string | null {
    const user = this.usersByName.get(normalized)
    if (!user) {
      return null
    }
    this.ensureSocialState(user)
    return user.username
  }

  private toDisplayUsernames(usernames: string[]): string[] {
    return usernames
      .map((normalized) => this.getDisplayUsername(normalized))
      .filter((username): username is string => Boolean(username))
      .sort((left, right) => left.localeCompare(right))
  }

  private toDisplayFriendPresence(usernames: string[]): FriendPresenceView[] {
    const now = Date.now()
    const friendPresence = usernames
      .map((normalized) => {
        const user = this.usersByName.get(normalized)
        if (!user) {
          return null
        }
        this.ensureSocialState(user)
        return {
          username: user.username,
          online: user.lastActiveAt !== null && now - user.lastActiveAt <= ONLINE_WINDOW_MS,
        }
      })
      .filter((friend): friend is FriendPresenceView => Boolean(friend))
    friendPresence.sort((left, right) => left.username.localeCompare(right.username))
    return friendPresence
  }

  private toDisplayGameInvites(invites: GameInvite[]): GameInviteView[] {
    return invites
      .filter((invite) => invite.status === 'pending')
      .map((invite) => {
        const fromUsername = this.getDisplayUsername(invite.from)
        if (!fromUsername) {
          return null
        }
        return {
          id: invite.id,
          fromUsername,
          roomId: invite.roomId,
          timeControlMinutes: invite.timeControlMinutes,
          incrementSeconds: invite.incrementSeconds,
          createdAt: invite.createdAt,
        }
      })
      .filter((invite): invite is GameInviteView => Boolean(invite))
      .sort((left, right) => right.createdAt - left.createdAt)
  }

  private addNotification(target: RegisteredUser, type: NotificationType, actor: string): void {
    this.ensureSocialState(target)
    target.notifications.unshift({
      id: this.generateNotificationId(),
      type,
      actor,
      createdAt: Date.now(),
      read: false,
    })
    // Keep the notifications bounded to prevent unbounded memory growth.
    if (target.notifications.length > 200) {
      target.notifications = target.notifications.slice(0, 200)
    }
  }

  private getNotificationMessage(type: NotificationType, actorUsername: string): string {
    if (type === 'friend_request_received') {
      return `${actorUsername} برای شما درخواست دوستی فرستاد.`
    }
    if (type === 'friend_request_accepted') {
      return `${actorUsername} درخواست دوستی شما را تایید کرد.`
    }
    if (type === 'friend_request_rejected') {
      return `${actorUsername} درخواست دوستی شما را رد کرد.`
    }
    if (type === 'friend_request_canceled') {
      return `${actorUsername} درخواست دوستی ارسال‌شده را لغو کرد.`
    }
    if (type === 'game_invite_received') {
      return `${actorUsername} برای شما درخواست بازی فرستاد.`
    }
    if (type === 'game_invite_accepted') {
      return `${actorUsername} دعوت بازی شما را قبول کرد.`
    }
    if (type === 'game_invite_rejected') {
      return `${actorUsername} دعوت بازی شما را رد کرد.`
    }
    return `${actorUsername} شما را از لیست دوستان حذف کرد.`
  }

  private toNotificationView(notification: ProfileNotification): NotificationView {
    const actorUsername = this.getDisplayUsername(notification.actor) ?? 'کاربر ناشناس'
    return {
      id: notification.id,
      type: notification.type,
      actorUsername,
      message: this.getNotificationMessage(notification.type, actorUsername),
      createdAt: notification.createdAt,
      read: notification.read,
    }
  }

  register(input: { username: string; password: string; confirmPassword: string }): { username: string } {
    const username = input.username.trim()
    const password = input.password
    const confirmPassword = input.confirmPassword

    if (username.length < 3) {
      throw new ProfileApiError(400, 'INVALID_USERNAME', 'نام کاربری باید حداقل ۳ کاراکتر باشد.')
    }
    if (password.length < 6) {
      throw new ProfileApiError(400, 'INVALID_PASSWORD', 'رمز عبور باید حداقل ۶ کاراکتر باشد.')
    }
    if (password !== confirmPassword) {
      throw new ProfileApiError(400, 'PASSWORD_MISMATCH', 'تکرار رمز عبور با رمز عبور یکسان نیست.')
    }

    const normalized = this.normalizeUsername(username)
    if (this.usersByName.has(normalized)) {
      throw new ProfileApiError(409, 'USERNAME_TAKEN', 'این نام کاربری قبلاً ثبت شده است.')
    }

    const passwordHash = this.hashPassword(password)
    this.usersByName.set(normalized, {
      username,
      passwordHash,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
      incomingGameInvites: [],
      notifications: [],
    })

    return { username }
  }

  login(input: { username: string; password: string }): { username: string } {
    const username = input.username.trim()
    const password = input.password

    if (!username) {
      throw new ProfileApiError(400, 'INVALID_USERNAME', 'نام کاربری الزامی است.')
    }
    if (!password) {
      throw new ProfileApiError(400, 'INVALID_PASSWORD', 'رمز عبور الزامی است.')
    }

    const normalized = this.normalizeUsername(username)
    const user = this.getUserByNormalizedUsername(normalized, 'نام کاربری یا رمز عبور اشتباه است.')
    const passwordHash = this.hashPassword(password)
    if (user.passwordHash !== passwordHash) {
      throw new ProfileApiError(401, 'INVALID_CREDENTIALS', 'نام کاربری یا رمز عبور اشتباه است.')
    }
    this.markUserActive(user)

    return { username: user.username }
  }

  updateUsername(input: { currentUsername: string; newUsername: string }): { username: string } {
    const currentUsername = input.currentUsername.trim()
    const newUsername = input.newUsername.trim()

    if (!currentUsername) {
      throw new ProfileApiError(400, 'INVALID_USERNAME', 'نام کاربری فعلی الزامی است.')
    }
    if (newUsername.length < 3) {
      throw new ProfileApiError(400, 'INVALID_USERNAME', 'نام کاربری جدید باید حداقل ۳ کاراکتر باشد.')
    }

    const normalizedCurrent = this.normalizeUsername(currentUsername)
    const normalizedNext = this.normalizeUsername(newUsername)
    const user = this.getUserByNormalizedUsername(normalizedCurrent)

    if (normalizedCurrent === normalizedNext) {
      user.username = newUsername
      this.markUserActive(user)
      this.usersByName.set(normalizedCurrent, user)
      return { username: user.username }
    }

    if (this.usersByName.has(normalizedNext)) {
      throw new ProfileApiError(409, 'USERNAME_TAKEN', 'این نام کاربری قبلاً ثبت شده است.')
    }

    this.usersByName.delete(normalizedCurrent)
    user.username = newUsername
    this.markUserActive(user)
    this.usersByName.set(normalizedNext, user)

    this.usersByName.forEach((storedUser) => {
      this.ensureSocialState(storedUser)
      this.replaceValue(storedUser.friends, normalizedCurrent, normalizedNext)
      this.replaceValue(storedUser.incomingRequests, normalizedCurrent, normalizedNext)
      this.replaceValue(storedUser.outgoingRequests, normalizedCurrent, normalizedNext)
      storedUser.notifications.forEach((notification) => {
        if (notification.actor === normalizedCurrent) {
          notification.actor = normalizedNext
        }
      })
    })

    return { username: newUsername }
  }

  changePassword(input: {
    username: string
    currentPassword: string
    nextPassword: string
    confirmNextPassword: string
  }): { username: string } {
    const username = input.username.trim()
    const currentPassword = input.currentPassword
    const nextPassword = input.nextPassword
    const confirmNextPassword = input.confirmNextPassword

    if (!username) {
      throw new ProfileApiError(400, 'INVALID_USERNAME', 'نام کاربری الزامی است.')
    }
    if (!currentPassword) {
      throw new ProfileApiError(400, 'INVALID_PASSWORD', 'رمز عبور فعلی الزامی است.')
    }
    if (nextPassword.length < 6) {
      throw new ProfileApiError(400, 'INVALID_PASSWORD', 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.')
    }
    if (nextPassword !== confirmNextPassword) {
      throw new ProfileApiError(400, 'PASSWORD_MISMATCH', 'تکرار رمز عبور جدید با رمز عبور جدید یکسان نیست.')
    }

    const normalized = this.normalizeUsername(username)
    const user = this.getUserByNormalizedUsername(normalized)
    this.markUserActive(user)

    const currentPasswordHash = this.hashPassword(currentPassword)
    if (user.passwordHash !== currentPasswordHash) {
      throw new ProfileApiError(401, 'INVALID_CREDENTIALS', 'رمز عبور فعلی اشتباه است.')
    }

    user.passwordHash = this.hashPassword(nextPassword)
    this.usersByName.set(normalized, user)

    return { username: user.username }
  }

  getFriendsOverview(input: { username: string }): {
    username: string
    friends: string[]
    friendPresence: FriendPresenceView[]
    incomingRequests: string[]
    outgoingRequests: string[]
    incomingGameInvites: GameInviteView[]
    incomingCount: number
  } {
    const normalized = this.normalizeUsername(input.username)
    if (!normalized) {
      throw new ProfileApiError(400, 'INVALID_USERNAME', 'نام کاربری الزامی است.')
    }

    const user = this.getUserByNormalizedUsername(normalized)
    this.markUserActive(user)
    const friends = this.toDisplayUsernames(user.friends)
    const friendPresence = this.toDisplayFriendPresence(user.friends)
    const incomingRequests = this.toDisplayUsernames(user.incomingRequests)
    const outgoingRequests = this.toDisplayUsernames(user.outgoingRequests)
    const incomingGameInvites = this.toDisplayGameInvites(user.incomingGameInvites)

    return {
      username: user.username,
      friends,
      friendPresence,
      incomingRequests,
      outgoingRequests,
      incomingGameInvites,
      incomingCount: incomingRequests.length,
    }
  }

  searchUsers(input: { username: string; query: string }): {
    users: Array<{ username: string; relation: FriendRelation }>
  } {
    const normalized = this.normalizeUsername(input.username)
    const query = input.query.trim().toLowerCase()
    if (!normalized) {
      throw new ProfileApiError(400, 'INVALID_USERNAME', 'نام کاربری الزامی است.')
    }
    if (query.length < 2) {
      return { users: [] }
    }

    const user = this.getUserByNormalizedUsername(normalized)
    this.markUserActive(user)
    const results: Array<{ username: string; relation: FriendRelation }> = []

    this.usersByName.forEach((candidate, candidateNormalized) => {
      this.ensureSocialState(candidate)
      if (candidateNormalized === normalized) {
        return
      }
      if (!candidate.username.toLowerCase().includes(query)) {
        return
      }

      let relation: FriendRelation = 'none'
      if (user.friends.includes(candidateNormalized)) {
        relation = 'friend'
      } else if (user.incomingRequests.includes(candidateNormalized)) {
        relation = 'incoming'
      } else if (user.outgoingRequests.includes(candidateNormalized)) {
        relation = 'outgoing'
      }

      results.push({ username: candidate.username, relation })
    })

    results.sort((left, right) => left.username.localeCompare(right.username))
    return { users: results.slice(0, 20) }
  }

  sendFriendRequest(input: { fromUsername: string; toUsername: string }): { toUsername: string } {
    const fromNormalized = this.normalizeUsername(input.fromUsername)
    const toNormalized = this.normalizeUsername(input.toUsername)

    if (!fromNormalized || !toNormalized) {
      throw new ProfileApiError(400, 'INVALID_USERNAME', 'نام کاربری فرستنده و گیرنده الزامی است.')
    }
    if (fromNormalized === toNormalized) {
      throw new ProfileApiError(400, 'INVALID_REQUEST', 'نمی‌توانید برای خودتان درخواست دوستی ارسال کنید.')
    }

    const fromUser = this.getUserByNormalizedUsername(fromNormalized)
    const toUser = this.getUserByNormalizedUsername(toNormalized)
    this.markUserActive(fromUser)

    if (fromUser.friends.includes(toNormalized)) {
      throw new ProfileApiError(409, 'ALREADY_FRIENDS', 'این کاربر از قبل در لیست دوستان شما است.')
    }
    if (fromUser.outgoingRequests.includes(toNormalized)) {
      throw new ProfileApiError(409, 'REQUEST_ALREADY_SENT', 'درخواست دوستی قبلاً ارسال شده است.')
    }

    // If target had already requested friendship, resolve instantly as accepted.
    if (fromUser.incomingRequests.includes(toNormalized)) {
      this.removeValue(fromUser.incomingRequests, toNormalized)
      this.removeValue(toUser.outgoingRequests, fromNormalized)
      this.pushUnique(fromUser.friends, toNormalized)
      this.pushUnique(toUser.friends, fromNormalized)
      this.addNotification(toUser, 'friend_request_accepted', fromNormalized)
      return { toUsername: toUser.username }
    }

    this.pushUnique(fromUser.outgoingRequests, toNormalized)
    this.pushUnique(toUser.incomingRequests, fromNormalized)
    this.addNotification(toUser, 'friend_request_received', fromNormalized)
    return { toUsername: toUser.username }
  }

  respondToFriendRequest(input: {
    username: string
    fromUsername: string
    action: 'accept' | 'reject'
  }): { fromUsername: string; action: 'accept' | 'reject' } {
    const usernameNormalized = this.normalizeUsername(input.username)
    const fromNormalized = this.normalizeUsername(input.fromUsername)
    const action = input.action

    if (!usernameNormalized || !fromNormalized) {
      throw new ProfileApiError(400, 'INVALID_USERNAME', 'نام کاربری فرستنده و گیرنده الزامی است.')
    }
    if (action !== 'accept' && action !== 'reject') {
      throw new ProfileApiError(400, 'INVALID_ACTION', 'عملیات درخواست دوستی نامعتبر است.')
    }

    const user = this.getUserByNormalizedUsername(usernameNormalized)
    const sender = this.getUserByNormalizedUsername(fromNormalized)
    this.markUserActive(user)

    if (!user.incomingRequests.includes(fromNormalized)) {
      throw new ProfileApiError(404, 'REQUEST_NOT_FOUND', 'درخواست دوستی موردنظر پیدا نشد.')
    }

    this.removeValue(user.incomingRequests, fromNormalized)
    this.removeValue(sender.outgoingRequests, usernameNormalized)

    if (action === 'accept') {
      this.pushUnique(user.friends, fromNormalized)
      this.pushUnique(sender.friends, usernameNormalized)
      this.addNotification(sender, 'friend_request_accepted', usernameNormalized)
    } else {
      this.addNotification(sender, 'friend_request_rejected', usernameNormalized)
    }

    return { fromUsername: sender.username, action }
  }

  cancelOutgoingRequest(input: { username: string; toUsername: string }): { toUsername: string } {
    const usernameNormalized = this.normalizeUsername(input.username)
    const targetNormalized = this.normalizeUsername(input.toUsername)

    if (!usernameNormalized || !targetNormalized) {
      throw new ProfileApiError(400, 'INVALID_USERNAME', 'نام کاربری فرستنده و گیرنده الزامی است.')
    }

    const user = this.getUserByNormalizedUsername(usernameNormalized)
    const target = this.getUserByNormalizedUsername(targetNormalized)
    this.markUserActive(user)

    if (!user.outgoingRequests.includes(targetNormalized)) {
      throw new ProfileApiError(404, 'REQUEST_NOT_FOUND', 'درخواست دوستی ارسالی پیدا نشد.')
    }

    this.removeValue(user.outgoingRequests, targetNormalized)
    this.removeValue(target.incomingRequests, usernameNormalized)
    target.notifications = target.notifications.filter(
      (notification) => !(notification.type === 'friend_request_received' && notification.actor === usernameNormalized)
    )
    this.addNotification(target, 'friend_request_canceled', usernameNormalized)

    return { toUsername: target.username }
  }

  removeFriend(input: { username: string; friendUsername: string }): { friendUsername: string } {
    const usernameNormalized = this.normalizeUsername(input.username)
    const friendNormalized = this.normalizeUsername(input.friendUsername)

    if (!usernameNormalized || !friendNormalized) {
      throw new ProfileApiError(400, 'INVALID_USERNAME', 'نام کاربری شما و دوستتان الزامی است.')
    }
    if (usernameNormalized === friendNormalized) {
      throw new ProfileApiError(400, 'INVALID_REQUEST', 'این عملیات برای خود کاربر ممکن نیست.')
    }

    const user = this.getUserByNormalizedUsername(usernameNormalized)
    const friend = this.getUserByNormalizedUsername(friendNormalized)
    this.markUserActive(user)

    if (!user.friends.includes(friendNormalized)) {
      throw new ProfileApiError(404, 'FRIEND_NOT_FOUND', 'این کاربر در لیست دوستان شما نیست.')
    }

    this.removeValue(user.friends, friendNormalized)
    this.removeValue(friend.friends, usernameNormalized)
    this.addNotification(friend, 'friend_removed', usernameNormalized)
    this.addNotification(user, 'friend_removed', friendNormalized)

    return { friendUsername: friend.username }
  }

  getNotifications(input: { username: string }): { username: string; unreadCount: number; notifications: NotificationView[] } {
    const normalized = this.normalizeUsername(input.username)
    if (!normalized) {
      throw new ProfileApiError(400, 'INVALID_USERNAME', 'نام کاربری الزامی است.')
    }

    const user = this.getUserByNormalizedUsername(normalized)
    this.markUserActive(user)
    const notifications = [...user.notifications]
      .sort((left, right) => right.createdAt - left.createdAt)
      .map((notification) => this.toNotificationView(notification))
    const unreadCount = notifications.filter((notification) => !notification.read).length

    return {
      username: user.username,
      unreadCount,
      notifications,
    }
  }

  markNotificationsRead(input: { username: string; notificationIds?: string[] }): { unreadCount: number } {
    const normalized = this.normalizeUsername(input.username)
    if (!normalized) {
      throw new ProfileApiError(400, 'INVALID_USERNAME', 'نام کاربری الزامی است.')
    }

    const user = this.getUserByNormalizedUsername(normalized)
    this.markUserActive(user)
    const ids = input.notificationIds ?? []
    const markAll = ids.length === 0

    user.notifications.forEach((notification) => {
      if (markAll || ids.includes(notification.id)) {
        notification.read = true
      }
    })

    const unreadCount = user.notifications.filter((notification) => !notification.read).length
    return { unreadCount }
  }

  sendGameInvite(input: {
    fromUsername: string
    toUsername: string
    roomId: string
    timeControlMinutes: number
    incrementSeconds: number
  }): { toUsername: string; inviteId: string } {
    const fromNormalized = this.normalizeUsername(input.fromUsername)
    const toNormalized = this.normalizeUsername(input.toUsername)
    const roomId = input.roomId.trim().toUpperCase()
    const timeControlMinutes = Math.floor(input.timeControlMinutes)
    const incrementSeconds = Math.floor(input.incrementSeconds)

    if (!fromNormalized || !toNormalized) {
      throw new ProfileApiError(400, 'INVALID_USERNAME', 'نام کاربری فرستنده و گیرنده الزامی است.')
    }
    if (fromNormalized === toNormalized) {
      throw new ProfileApiError(400, 'INVALID_REQUEST', 'ارسال درخواست بازی برای خودتان ممکن نیست.')
    }
    if (roomId.length < 4) {
      throw new ProfileApiError(400, 'INVALID_ROOM_ID', 'کد اتاق بازی نامعتبر است.')
    }
    if (!Number.isFinite(timeControlMinutes) || timeControlMinutes < 1 || timeControlMinutes > 60) {
      throw new ProfileApiError(400, 'INVALID_TIME_CONTROL', 'زمان بازی باید بین ۱ تا ۶۰ دقیقه باشد.')
    }
    if (!Number.isFinite(incrementSeconds) || incrementSeconds < 0 || incrementSeconds > 30) {
      throw new ProfileApiError(400, 'INVALID_INCREMENT', 'اینکریمنت باید بین ۰ تا ۳۰ ثانیه باشد.')
    }

    const fromUser = this.getUserByNormalizedUsername(fromNormalized)
    const toUser = this.getUserByNormalizedUsername(toNormalized)
    this.markUserActive(fromUser)

    if (!fromUser.friends.includes(toNormalized)) {
      throw new ProfileApiError(403, 'FRIEND_REQUIRED', 'فقط می‌توانید برای دوستانتان درخواست بازی بفرستید.')
    }

    const now = Date.now()
    if (toUser.lastActiveAt === null || now - toUser.lastActiveAt > ONLINE_WINDOW_MS) {
      throw new ProfileApiError(409, 'TARGET_OFFLINE', 'این دوست در حال حاضر آنلاین نیست.')
    }

    toUser.incomingGameInvites = toUser.incomingGameInvites.filter(
      (invite) => !(invite.from === fromNormalized && invite.status === 'pending')
    )

    const invite: GameInvite = {
      id: this.generateNotificationId(),
      from: fromNormalized,
      roomId,
      timeControlMinutes,
      incrementSeconds,
      createdAt: Date.now(),
      status: 'pending',
    }
    toUser.incomingGameInvites.unshift(invite)
    if (toUser.incomingGameInvites.length > 50) {
      toUser.incomingGameInvites = toUser.incomingGameInvites.slice(0, 50)
    }
    this.addNotification(toUser, 'game_invite_received', fromNormalized)

    return { toUsername: toUser.username, inviteId: invite.id }
  }

  respondToGameInvite(input: {
    username: string
    inviteId: string
    action: 'accept' | 'reject'
  }): { inviteId: string; action: 'accept' | 'reject' } {
    const normalized = this.normalizeUsername(input.username)
    const inviteId = input.inviteId.trim()
    const action = input.action

    if (!normalized || !inviteId) {
      throw new ProfileApiError(400, 'INVALID_REQUEST', 'اطلاعات پاسخ درخواست بازی ناقص است.')
    }
    if (action !== 'accept' && action !== 'reject') {
      throw new ProfileApiError(400, 'INVALID_ACTION', 'عملیات درخواست بازی نامعتبر است.')
    }

    const user = this.getUserByNormalizedUsername(normalized)
    this.markUserActive(user)
    const inviteIndex = user.incomingGameInvites.findIndex((invite) => invite.id === inviteId && invite.status === 'pending')
    if (inviteIndex < 0) {
      throw new ProfileApiError(404, 'GAME_INVITE_NOT_FOUND', 'درخواست بازی پیدا نشد یا قبلا پاسخ داده شده است.')
    }

    const invite = user.incomingGameInvites[inviteIndex]
    user.incomingGameInvites.splice(inviteIndex, 1)
    const inviter = this.getUserByNormalizedUsername(invite.from, 'فرستنده درخواست بازی پیدا نشد.')
    this.addNotification(inviter, action === 'accept' ? 'game_invite_accepted' : 'game_invite_rejected', normalized)

    return { inviteId, action }
  }

}

declare global {
  // eslint-disable-next-line no-var
  var __profileUserStore: UserStore | undefined
}

export function getUserStore(): UserStore {
  if (!global.__profileUserStore) {
    global.__profileUserStore = new UserStore()
  }
  return global.__profileUserStore
}

export function asProfileApiError(error: unknown): ProfileApiError {
  if (error instanceof ProfileApiError) {
    return error
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'code' in error &&
    'message' in error &&
    typeof (error as { status: unknown }).status === 'number' &&
    typeof (error as { code: unknown }).code === 'string' &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    const normalized = error as { status: number; code: string; message: string }
    return new ProfileApiError(normalized.status, normalized.code, normalized.message)
  }
  return new ProfileApiError(500, 'INTERNAL_ERROR', 'خطای غیرمنتظره سمت سرور رخ داد.')
}
