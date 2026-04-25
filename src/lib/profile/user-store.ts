import { createHash } from 'crypto'

interface RegisteredUser {
  username: string
  passwordHash: string
  createdAt: number
  friends: string[]
  incomingRequests: string[]
  outgoingRequests: string[]
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

  private normalizeUsername(username: string): string {
    return username.trim().toLowerCase()
  }

  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex')
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
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
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
      this.usersByName.set(normalizedCurrent, user)
      return { username: user.username }
    }

    if (this.usersByName.has(normalizedNext)) {
      throw new ProfileApiError(409, 'USERNAME_TAKEN', 'این نام کاربری قبلاً ثبت شده است.')
    }

    this.usersByName.delete(normalizedCurrent)
    user.username = newUsername
    this.usersByName.set(normalizedNext, user)

    this.usersByName.forEach((storedUser) => {
      this.ensureSocialState(storedUser)
      this.replaceValue(storedUser.friends, normalizedCurrent, normalizedNext)
      this.replaceValue(storedUser.incomingRequests, normalizedCurrent, normalizedNext)
      this.replaceValue(storedUser.outgoingRequests, normalizedCurrent, normalizedNext)
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
    incomingRequests: string[]
    outgoingRequests: string[]
    incomingCount: number
  } {
    const normalized = this.normalizeUsername(input.username)
    if (!normalized) {
      throw new ProfileApiError(400, 'INVALID_USERNAME', 'نام کاربری الزامی است.')
    }

    const user = this.getUserByNormalizedUsername(normalized)
    const friends = this.toDisplayUsernames(user.friends)
    const incomingRequests = this.toDisplayUsernames(user.incomingRequests)
    const outgoingRequests = this.toDisplayUsernames(user.outgoingRequests)

    return {
      username: user.username,
      friends,
      incomingRequests,
      outgoingRequests,
      incomingCount: incomingRequests.length,
    }
  }

  searchUsers(input: {
    username: string
    query: string
  }): {
    users: Array<{ username: string; relation: 'none' | 'friend' | 'incoming' | 'outgoing' }>
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
    const results: Array<{ username: string; relation: 'none' | 'friend' | 'incoming' | 'outgoing' }> = []

    this.usersByName.forEach((candidate, candidateNormalized) => {
      this.ensureSocialState(candidate)
      if (candidateNormalized === normalized) {
        return
      }
      if (!candidate.username.toLowerCase().includes(query)) {
        return
      }

      let relation: 'none' | 'friend' | 'incoming' | 'outgoing' = 'none'
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
    return {
      users: results.slice(0, 20),
    }
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

    if (fromUser.friends.includes(toNormalized)) {
      throw new ProfileApiError(409, 'ALREADY_FRIENDS', 'این کاربر از قبل در لیست دوستان شما است.')
    }

    // If the target user already requested friendship, accept both sides automatically.
    if (fromUser.incomingRequests.includes(toNormalized)) {
      this.removeValue(fromUser.incomingRequests, toNormalized)
      this.removeValue(toUser.outgoingRequests, fromNormalized)
      this.pushUnique(fromUser.friends, toNormalized)
      this.pushUnique(toUser.friends, fromNormalized)
      return { toUsername: toUser.username }
    }

    this.pushUnique(fromUser.outgoingRequests, toNormalized)
    this.pushUnique(toUser.incomingRequests, fromNormalized)
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

    if (!user.incomingRequests.includes(fromNormalized)) {
      throw new ProfileApiError(404, 'REQUEST_NOT_FOUND', 'درخواست دوستی موردنظر پیدا نشد.')
    }

    this.removeValue(user.incomingRequests, fromNormalized)
    this.removeValue(sender.outgoingRequests, usernameNormalized)

    if (action === 'accept') {
      this.pushUnique(user.friends, fromNormalized)
      this.pushUnique(sender.friends, usernameNormalized)
    }

    return { fromUsername: sender.username, action }
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
