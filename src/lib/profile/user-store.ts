import { createHash } from 'crypto'

interface RegisteredUser {
  username: string
  passwordHash: string
  createdAt: number
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

    const normalized = username.toLowerCase()
    if (this.usersByName.has(normalized)) {
      throw new ProfileApiError(409, 'USERNAME_TAKEN', 'این نام کاربری قبلاً ثبت شده است.')
    }

    const passwordHash = createHash('sha256').update(password).digest('hex')
    this.usersByName.set(normalized, {
      username,
      passwordHash,
      createdAt: Date.now(),
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

    const normalized = username.toLowerCase()
    const user = this.usersByName.get(normalized)
    if (!user) {
      throw new ProfileApiError(401, 'INVALID_CREDENTIALS', 'نام کاربری یا رمز عبور اشتباه است.')
    }

    const passwordHash = createHash('sha256').update(password).digest('hex')
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

    const normalizedCurrent = currentUsername.toLowerCase()
    const normalizedNext = newUsername.toLowerCase()
    const user = this.usersByName.get(normalizedCurrent)
    if (!user) {
      throw new ProfileApiError(404, 'USER_NOT_FOUND', 'کاربر موردنظر پیدا نشد.')
    }

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

    const normalized = username.toLowerCase()
    const user = this.usersByName.get(normalized)
    if (!user) {
      throw new ProfileApiError(404, 'USER_NOT_FOUND', 'کاربر موردنظر پیدا نشد.')
    }

    const currentPasswordHash = createHash('sha256').update(currentPassword).digest('hex')
    if (user.passwordHash !== currentPasswordHash) {
      throw new ProfileApiError(401, 'INVALID_CREDENTIALS', 'رمز عبور فعلی اشتباه است.')
    }

    user.passwordHash = createHash('sha256').update(nextPassword).digest('hex')
    this.usersByName.set(normalized, user)

    return { username: user.username }
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
