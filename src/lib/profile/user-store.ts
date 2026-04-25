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
