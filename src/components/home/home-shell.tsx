'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createRoom } from '@/lib/chess/client'
import { PROFILE_USERNAME_STORAGE_KEY } from '@/lib/profile/constants'

type FooterTab = 'home' | 'profile' | 'puzzle' | 'news'

interface FooterItem {
  id: FooterTab
  label: string
}

const FOOTER_ITEMS: FooterItem[] = [
  { id: 'home', label: 'خانه' },
  { id: 'profile', label: 'پروفایل' },
  { id: 'puzzle', label: 'پازل' },
  { id: 'news', label: 'اخبار' },
]

type RegisterResponse = {
  user?: { username: string }
  error?: { message?: string }
}

async function parseJsonSafe(response: Response): Promise<RegisterResponse> {
  try {
    return (await response.json()) as RegisterResponse
  } catch {
    return {}
  }
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm17.71-10.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0l-1.96 1.96 3.75 3.75 2.13-2.79Z"
        fill="currentColor"
      />
    </svg>
  )
}

function HomeContent({
  onStartOnline,
  onSoon,
  isStartingOnline,
}: {
  onStartOnline: () => void
  onSoon: () => void
  isStartingOnline: boolean
}) {
  return (
    <section className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-5 shadow-lg">
      <h2 className="text-center text-xl font-bold text-slate-100">صفحه خانه</h2>
      <p className="text-center text-sm text-slate-300">برای ادامه یکی از گزینه‌های زیر را انتخاب کنید.</p>
      <div className="space-y-3">
        <button
          type="button"
          onClick={onStartOnline}
          disabled={isStartingOnline}
          data-testid="online-play-btn"
          className="w-full rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-base font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isStartingOnline ? 'در حال ورود...' : 'بازی آنلاین'}
        </button>
        <button
          type="button"
          onClick={onSoon}
          data-testid="friend-play-btn"
          className="w-full rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-base font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
        >
          بازی با دوست
        </button>
        <button
          type="button"
          onClick={onSoon}
          data-testid="offline-play-btn"
          className="w-full rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-base font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
        >
          بازی آفلاین
        </button>
      </div>
    </section>
  )
}

function ProfileContent({
  isAuthenticated,
  mode,
  onModeChange,
  profileName,
  draftName,
  password,
  confirmPassword,
  usernameEditValue,
  onUsernameEditValueChange,
  isEditingUsername,
  onToggleUsernameEdit,
  onSaveUsername,
  currentPassword,
  onCurrentPasswordChange,
  newPassword,
  onNewPasswordChange,
  confirmNewPassword,
  onConfirmNewPasswordChange,
  onChangePassword,
  onDraftNameChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  isSubmitting,
}: {
  isAuthenticated: boolean
  mode: 'login' | 'register'
  onModeChange: (mode: 'login' | 'register') => void
  profileName: string
  draftName: string
  password: string
  confirmPassword: string
  usernameEditValue: string
  onUsernameEditValueChange: (value: string) => void
  isEditingUsername: boolean
  onToggleUsernameEdit: () => void
  onSaveUsername: () => void
  currentPassword: string
  onCurrentPasswordChange: (value: string) => void
  newPassword: string
  onNewPasswordChange: (value: string) => void
  confirmNewPassword: string
  onConfirmNewPasswordChange: (value: string) => void
  onChangePassword: () => void
  onDraftNameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onSubmit: () => void
  isSubmitting: boolean
}) {
  const isRegisterMode = mode === 'register'

  if (isAuthenticated) {
    return (
      <section className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-5 shadow-lg">
        <h2 className="text-center text-xl font-bold text-slate-100">پروفایل من</h2>
        <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
          <p className="text-xs text-slate-400">نام کاربری</p>
          <div className="flex items-center gap-2">
            {isEditingUsername ? (
              <>
                <input
                  value={usernameEditValue}
                  onChange={(event) => onUsernameEditValueChange(event.target.value)}
                  data-testid="profile-username-edit-input"
                  className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
                  placeholder="نام کاربری جدید"
                />
                <button
                  type="button"
                  onClick={onSaveUsername}
                  disabled={isSubmitting}
                  data-testid="profile-username-save-btn"
                  className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  ذخیره
                </button>
              </>
            ) : (
              <>
                <p className="flex-1 text-sm font-semibold text-slate-100" data-testid="profile-username-value">
                  {profileName}
                </p>
                <button
                  type="button"
                  onClick={onToggleUsernameEdit}
                  data-testid="profile-username-edit-btn"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-600 p-2 text-slate-200 transition hover:bg-slate-800"
                  aria-label="ویرایش نام کاربری"
                >
                  <PencilIcon />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
          <p className="text-sm font-semibold text-slate-200">تغییر رمز عبور</p>
          <label className="block space-y-2">
            <span className="text-xs text-slate-400">رمز عبور فعلی</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => onCurrentPasswordChange(event.target.value)}
              data-testid="profile-current-password-input"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs text-slate-400">رمز عبور جدید</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => onNewPasswordChange(event.target.value)}
              data-testid="profile-new-password-input"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-xs text-slate-400">تکرار رمز عبور جدید</span>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(event) => onConfirmNewPasswordChange(event.target.value)}
              data-testid="profile-confirm-new-password-input"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
            />
          </label>
          <button
            type="button"
            onClick={onChangePassword}
            disabled={isSubmitting}
            data-testid="profile-change-password-btn"
            className="w-full rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            تغییر رمز عبور
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-5 shadow-lg">
      <h2 className="text-center text-xl font-bold text-slate-100">ورود / ثبت‌نام</h2>
      <p className="text-center text-sm text-slate-300">
        برای بازی با نام کاربری خودت، ابتدا وارد شو یا حساب جدید بساز.
      </p>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-950/60 p-1">
        <button
          type="button"
          onClick={() => onModeChange('login')}
          data-testid="profile-mode-login"
          className={[
            'rounded-lg px-3 py-2 text-sm font-semibold transition',
            !isRegisterMode ? 'bg-cyan-400 text-slate-950' : 'text-slate-200 hover:bg-slate-800',
          ].join(' ')}
        >
          ورود
        </button>
        <button
          type="button"
          onClick={() => onModeChange('register')}
          data-testid="profile-mode-register"
          className={[
            'rounded-lg px-3 py-2 text-sm font-semibold transition',
            isRegisterMode ? 'bg-cyan-400 text-slate-950' : 'text-slate-200 hover:bg-slate-800',
          ].join(' ')}
        >
          ثبت‌نام
        </button>
      </div>
      <label className="block space-y-2">
        <span className="text-sm text-slate-200">نام اکانت</span>
        <input
          value={draftName}
          onChange={(event) => onDraftNameChange(event.target.value)}
          data-testid="profile-name-input"
          className="w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
          placeholder="مثال: ali_chess"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm text-slate-200">رمز عبور</span>
        <input
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          data-testid="profile-password-input"
          className="w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
          placeholder="حداقل ۶ کاراکتر"
        />
      </label>
      {isRegisterMode ? (
        <label className="block space-y-2">
          <span className="text-sm text-slate-200">تکرار رمز عبور</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
            data-testid="profile-confirm-password-input"
            className="w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
            placeholder="دوباره وارد کنید"
          />
        </label>
      ) : null}
      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        data-testid={isRegisterMode ? 'profile-register-btn' : 'profile-login-btn'}
        className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'در حال پردازش...' : isRegisterMode ? 'ثبت‌نام' : 'ورود'}
      </button>
      {profileName ? (
        <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-center text-sm text-emerald-200" data-testid="profile-current-name">
          نام ذخیره شده: {profileName}
        </p>
      ) : null}
    </section>
  )
}

function PlaceholderContent({ title }: { title: string }) {
  return (
    <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/70 p-6 text-center">
      <h2 className="text-xl font-bold text-slate-100">{title}</h2>
      <p className="mt-2 text-sm text-slate-400">این بخش در مرحله بعدی تکمیل می‌شود.</p>
    </section>
  )
}

export function HomeShell() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<FooterTab>('home')
  const [profileMode, setProfileMode] = useState<'login' | 'register'>('login')
  const [profileName, setProfileName] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [usernameEditValue, setUsernameEditValue] = useState('')
  const [isEditingUsername, setIsEditingUsername] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)
  const [isStartingOnline, setIsStartingOnline] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(PROFILE_USERNAME_STORAGE_KEY)?.trim() ?? ''
    if (!stored) return
    setProfileName(stored)
    setUsernameEditValue(stored)
    setDraftName(stored)
    setIsAuthenticated(true)
  }, [])

  const handleStartOnline = async () => {
    const preferredName = profileName.trim() || 'Guest'
    setIsStartingOnline(true)
    setBannerMessage(null)
    try {
      const response = await createRoom({
        name: preferredName,
        timeControlMinutes: 10,
        incrementSeconds: 2,
      })
      localStorage.setItem(
        'realtime-chess-session',
        JSON.stringify({ roomId: response.snapshot.roomId, session: response.session })
      )
      router.push(`/online?room=${response.snapshot.roomId}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'شروع بازی آنلاین ممکن نشد.'
      setBannerMessage(message)
    } finally {
      setIsStartingOnline(false)
    }
  }

  const handleSoon = () => {
    setBannerMessage('این گزینه در مرحله بعدی تکمیل می‌شود. فعلاً بازی آنلاین فعال است.')
  }

  const handleSaveProfile = async () => {
    const normalized = draftName.trim()
    if (normalized.length < 3) {
      setBannerMessage('نام اکانت باید حداقل ۳ کاراکتر باشد.')
      return
    }
    if (password.length < 6) {
      setBannerMessage('رمز عبور باید حداقل ۶ کاراکتر باشد.')
      return
    }
    if (profileMode === 'register' && password !== confirmPassword) {
      setBannerMessage('تکرار رمز عبور با رمز عبور یکسان نیست.')
      return
    }

    setIsRegistering(true)
    setBannerMessage(null)
    try {
      const endpoint = profileMode === 'register' ? '/api/profile/register' : '/api/profile/login'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          profileMode === 'register'
            ? {
                username: normalized,
                password,
                confirmPassword,
              }
            : {
                username: normalized,
                password,
              }
        ),
      })
      const payload = await parseJsonSafe(response)
      if (!response.ok) {
        setBannerMessage(payload.error?.message ?? 'عملیات پروفایل انجام نشد.')
        return
      }

      const savedName = payload.user?.username ?? normalized
      localStorage.setItem(PROFILE_USERNAME_STORAGE_KEY, savedName)
      setProfileName(savedName)
      setUsernameEditValue(savedName)
      setDraftName(savedName)
      setIsAuthenticated(true)
      setActiveTab('profile')
      setPassword('')
      setConfirmPassword('')
      setBannerMessage(profileMode === 'register' ? 'ثبت نام با موفقیت انجام شد.' : 'ورود با موفقیت انجام شد.')
    } catch {
      setBannerMessage('خطا در ارتباط با سرور پروفایل.')
    } finally {
      setIsRegistering(false)
    }
  }

  const handleSaveUsername = async () => {
    const currentUsername = profileName.trim()
    const newUsername = usernameEditValue.trim()

    if (newUsername.length < 3) {
      setBannerMessage('نام کاربری باید حداقل ۳ کاراکتر باشد.')
      return
    }
    if (!currentUsername) {
      setBannerMessage('ابتدا وارد حساب کاربری شوید.')
      return
    }

    setIsRegistering(true)
    setBannerMessage(null)
    try {
      const response = await fetch('/api/profile/update-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUsername,
          newUsername,
        }),
      })
      const payload = await parseJsonSafe(response)
      if (!response.ok) {
        setBannerMessage(payload.error?.message ?? 'تغییر نام کاربری انجام نشد.')
        return
      }

      const savedName = payload.user?.username ?? newUsername
      localStorage.setItem(PROFILE_USERNAME_STORAGE_KEY, savedName)
      setProfileName(savedName)
      setUsernameEditValue(savedName)
      setDraftName(savedName)
      setIsEditingUsername(false)
      setBannerMessage('نام کاربری با موفقیت تغییر کرد.')
    } catch {
      setBannerMessage('خطا در ارتباط با سرور پروفایل.')
    } finally {
      setIsRegistering(false)
    }
  }

  const handleChangePassword = async () => {
    if (!profileName.trim()) {
      setBannerMessage('ابتدا وارد حساب کاربری شوید.')
      return
    }
    if (!currentPassword) {
      setBannerMessage('رمز عبور فعلی را وارد کنید.')
      return
    }
    if (newPassword.length < 6) {
      setBannerMessage('رمز عبور جدید باید حداقل ۶ کاراکتر باشد.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setBannerMessage('تکرار رمز عبور جدید با هم یکسان نیست.')
      return
    }

    setIsRegistering(true)
    setBannerMessage(null)
    try {
      const response = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: profileName.trim(),
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      })
      const payload = await parseJsonSafe(response)
      if (!response.ok) {
        setBannerMessage(payload.error?.message ?? 'تغییر رمز عبور انجام نشد.')
        return
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setBannerMessage('رمز عبور با موفقیت تغییر کرد.')
    } catch {
      setBannerMessage('خطا در ارتباط با سرور پروفایل.')
    } finally {
      setIsRegistering(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100" dir="rtl">
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-4">
          {bannerMessage ? (
            <p className="rounded-lg bg-cyan-500/10 px-4 py-3 text-center text-sm text-cyan-100" data-testid="home-banner-message">
              {bannerMessage}
            </p>
          ) : null}
          {activeTab === 'home' ? (
            <HomeContent
              onStartOnline={handleStartOnline}
              onSoon={handleSoon}
              isStartingOnline={isStartingOnline}
            />
          ) : null}
          {activeTab === 'profile' ? (
            <ProfileContent
              isAuthenticated={isAuthenticated}
              mode={profileMode}
              onModeChange={(mode) => {
                setProfileMode(mode)
                setPassword('')
                setConfirmPassword('')
                setBannerMessage(null)
              }}
              profileName={profileName}
              draftName={draftName}
              usernameEditValue={usernameEditValue}
              onUsernameEditValueChange={setUsernameEditValue}
              isEditingUsername={isEditingUsername}
              onToggleUsernameEdit={() => {
                setIsEditingUsername(true)
                setUsernameEditValue(profileName)
              }}
              onSaveUsername={handleSaveUsername}
              currentPassword={currentPassword}
              onCurrentPasswordChange={setCurrentPassword}
              newPassword={newPassword}
              onNewPasswordChange={setNewPassword}
              confirmNewPassword={confirmNewPassword}
              onConfirmNewPasswordChange={setConfirmNewPassword}
              onChangePassword={handleChangePassword}
              onDraftNameChange={setDraftName}
              onSubmit={handleSaveProfile}
              password={password}
              confirmPassword={confirmPassword}
              onPasswordChange={setPassword}
              onConfirmPasswordChange={setConfirmPassword}
              isSubmitting={isRegistering}
            />
          ) : null}
          {activeTab === 'puzzle' ? <PlaceholderContent title="پازل" /> : null}
          {activeTab === 'news' ? <PlaceholderContent title="اخبار" /> : null}
        </div>
      </div>

      <footer className="sticky bottom-0 border-t border-slate-700 bg-slate-950/95 px-3 pb-4 pt-3 backdrop-blur">
        <nav className="mx-auto grid w-full max-w-md grid-cols-4 gap-2">
          {FOOTER_ITEMS.map((item) => {
            const isActive = item.id === activeTab
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                data-testid={`footer-tab-${item.id}`}
                className={[
                  'rounded-xl px-3 py-3 text-sm font-bold transition',
                  isActive ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700',
                ].join(' ')}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
      </footer>
    </main>
  )
}
