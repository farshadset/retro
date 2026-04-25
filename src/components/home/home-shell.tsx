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
  profileName,
  draftName,
  password,
  confirmPassword,
  onDraftNameChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSave,
  isSubmitting,
}: {
  profileName: string
  draftName: string
  password: string
  confirmPassword: string
  onDraftNameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onSave: () => void
  isSubmitting: boolean
}) {
  return (
    <section className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-5 shadow-lg">
      <h2 className="text-center text-xl font-bold text-slate-100">پروفایل</h2>
      <p className="text-center text-sm text-slate-300">
        نام کاربری‌ات را ثبت کن تا در بازی آنلاین با همین نام دیده شوی.
      </p>
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
      <button
        type="button"
        onClick={onSave}
        disabled={isSubmitting}
        data-testid="profile-save-btn"
        className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'در حال ثبت...' : 'ثبت نام / ذخیره پروفایل'}
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
  const [profileName, setProfileName] = useState('')
  const [draftName, setDraftName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)
  const [isStartingOnline, setIsStartingOnline] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(PROFILE_USERNAME_STORAGE_KEY)?.trim() ?? ''
    if (!stored) return
    setProfileName(stored)
    setDraftName(stored)
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
    if (password !== confirmPassword) {
      setBannerMessage('تکرار رمز عبور با رمز عبور یکسان نیست.')
      return
    }

    setIsRegistering(true)
    setBannerMessage(null)
    try {
      const response = await fetch('/api/profile/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: normalized,
          password,
          confirmPassword,
        }),
      })
      const payload = await parseJsonSafe(response)
      if (!response.ok) {
        setBannerMessage(payload.error?.message ?? 'ثبت نام انجام نشد.')
        return
      }

      const savedName = payload.user?.username ?? normalized
      localStorage.setItem(PROFILE_USERNAME_STORAGE_KEY, savedName)
      setProfileName(savedName)
      setDraftName(savedName)
      setPassword('')
      setConfirmPassword('')
      setBannerMessage('ثبت نام با موفقیت انجام شد.')
    } catch {
      setBannerMessage('خطا در ارتباط با سرور ثبت نام.')
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
              profileName={profileName}
              draftName={draftName}
              onDraftNameChange={setDraftName}
              onSave={handleSaveProfile}
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
