'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createRoom } from '@/lib/chess/client'
import { PROFILE_USERNAME_STORAGE_KEY } from '@/lib/profile/constants'

type FooterTab = 'home' | 'profile' | 'puzzle' | 'news'
type ProfileMode = 'login' | 'register'
type FriendRelation = 'none' | 'friend' | 'incoming' | 'outgoing'
type ProfilePanel = 'friends' | 'notifications'
type HomePanel = 'menu' | 'friend-play'
type NotificationType =
  | 'friend_request_received'
  | 'friend_request_accepted'
  | 'friend_request_rejected'
  | 'friend_request_canceled'
  | 'friend_removed'

interface FriendPresenceItem {
  username: string
  online: boolean
}

interface NotificationItem {
  id: string
  type: NotificationType
  actorUsername: string
  message: string
  createdAt: number
  read: boolean
}

interface FooterItem {
  id: FooterTab
  label: string
}

interface ApiResponse {
  status?: string
  persistence?: string
  user?: { username: string }
  friends?: string[]
  friendPresence?: FriendPresenceItem[]
  incomingRequests?: string[]
  outgoingRequests?: string[]
  incomingCount?: number
  users?: Array<{ username: string; relation: FriendRelation }>
  notifications?: NotificationItem[]
  unreadCount?: number
  error?: { code?: string; message?: string }
}

const FOOTER_ITEMS: FooterItem[] = [
  { id: 'home', label: 'خانه' },
  { id: 'profile', label: 'پروفایل' },
  { id: 'puzzle', label: 'پازل' },
  { id: 'news', label: 'اخبار' },
]

async function parseJsonSafe(response: Response): Promise<ApiResponse> {
  try {
    return (await response.json()) as ApiResponse
  } catch {
    return {}
  }
}

function formatNotificationTime(timestamp: number): string {
  const now = Date.now()
  const diffMs = Math.max(0, now - timestamp)
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) {
    return 'همین الان'
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} دقیقه پیش`
  }
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours} ساعت پیش`
  }
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) {
    return `${diffDays} روز پیش`
  }
  return new Date(timestamp).toLocaleDateString('fa-IR')
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M19 11H13V5h-2v6H5v2h6v6h2v-6h6z" fill="currentColor" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="currentColor" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="m19 6.4-1.4-1.4L12 10.6 6.4 5 5 6.4l5.6 5.6L5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6z" fill="currentColor" />
    </svg>
  )
}

function HomeContent({
  onStartOnline,
  onOpenFriendPlay,
  onStartOffline,
  onBackToMenu,
  homePanel,
  friendPresence,
  isStartingOnline,
}: {
  onStartOnline: () => void
  onOpenFriendPlay: () => void
  onStartOffline: () => void
  onBackToMenu: () => void
  homePanel: HomePanel
  friendPresence: FriendPresenceItem[]
  isStartingOnline: boolean
}) {
  if (homePanel === 'friend-play') {
    return (
      <section
        className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-5 shadow-lg"
        data-testid="friend-play-panel"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-100">انتخاب دوست برای بازی</h2>
          <button
            type="button"
            onClick={onBackToMenu}
            data-testid="friend-play-back-btn"
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            بازگشت
          </button>
        </div>
        <p className="text-sm text-slate-300">وضعیت آنلاین دوستانت را اینجا می‌بینی.</p>
        {friendPresence.length === 0 ? (
          <p className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-3 text-sm text-slate-400" data-testid="friend-play-empty">
            هنوز دوستی نداری. اول از تب پروفایل دوست اضافه کن.
          </p>
        ) : (
          <div className="space-y-2" data-testid="friend-play-list">
            {friendPresence.map((friend) => (
              <div
                key={friend.username}
                data-testid={`friend-play-row-${friend.username}`}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/65 px-3 py-2"
              >
                <p className="text-sm font-semibold text-slate-100">{friend.username}</p>
                <div className="inline-flex items-center gap-2 text-xs">
                  <span
                    data-testid={`friend-play-status-dot-${friend.username}`}
                    className={[
                      'h-2.5 w-2.5 rounded-full',
                      friend.online ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]' : 'bg-slate-500',
                    ].join(' ')}
                  />
                  <span className={friend.online ? 'text-emerald-300' : 'text-slate-400'}>
                    {friend.online ? 'آنلاین' : 'آفلاین'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    )
  }

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
          onClick={onOpenFriendPlay}
          data-testid="friend-play-btn"
          className="w-full rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-base font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
        >
          بازی با دوست
        </button>
        <button
          type="button"
          onClick={onStartOffline}
          data-testid="offline-play-btn"
          className="w-full rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-base font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
        >
          بازی آفلاین
        </button>
      </div>
    </section>
  )
}

interface ProfileContentProps {
  isAuthenticated: boolean
  mode: ProfileMode
  onModeChange: (mode: ProfileMode) => void
  profileName: string
  draftName: string
  password: string
  confirmPassword: string
  onDraftNameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onSubmit: () => void
  isSubmitting: boolean
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
  friends: string[]
  incomingRequests: string[]
  outgoingRequests: string[]
  incomingRequestCount: number
  friendSearchQuery: string
  onFriendSearchQueryChange: (value: string) => void
  friendSearchResults: Array<{ username: string; relation: FriendRelation }>
  onSendFriendRequest: (targetUsername: string) => void
  onRespondFriendRequest: (fromUsername: string, action: 'accept' | 'reject') => void
  onCancelOutgoingRequest: (toUsername: string) => void
  onRemoveFriend: (friendUsername: string) => void
  activePanel: ProfilePanel
  onPanelChange: (panel: ProfilePanel) => void
  notifications: NotificationItem[]
  notificationUnreadCount: number
  onMarkNotificationsRead: (notificationIds?: string[]) => void
  onLogout: () => void
  friendsLoading: boolean
}

function ProfileContent(props: ProfileContentProps) {
  const {
    isAuthenticated,
    mode,
    onModeChange,
    profileName,
    draftName,
    password,
    confirmPassword,
    onDraftNameChange,
    onPasswordChange,
    onConfirmPasswordChange,
    onSubmit,
    isSubmitting,
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
    friends,
    incomingRequests,
    outgoingRequests,
    incomingRequestCount,
    friendSearchQuery,
    onFriendSearchQueryChange,
    friendSearchResults,
    onSendFriendRequest,
    onRespondFriendRequest,
    onCancelOutgoingRequest,
    onRemoveFriend,
    activePanel,
    onPanelChange,
    notifications,
    notificationUnreadCount,
    onMarkNotificationsRead,
    onLogout,
    friendsLoading,
  } = props

  const isRegisterMode = mode === 'register'

  if (isAuthenticated) {
    return (
      <section className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-100">پروفایل من</h2>
          <button
            type="button"
            onClick={onLogout}
            data-testid="profile-logout-btn"
            className="rounded-md border border-rose-400/60 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/10"
          >
            خروج
          </button>
        </div>

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

        <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-900/80 p-1">
            <button
              type="button"
              onClick={() => onPanelChange('friends')}
              data-testid="profile-panel-friends"
              className={[
                'rounded-lg px-3 py-2 text-sm font-semibold transition',
                activePanel === 'friends' ? 'bg-cyan-400 text-slate-950' : 'text-slate-200 hover:bg-slate-800',
              ].join(' ')}
            >
              دوستان
            </button>
            <button
              type="button"
              onClick={() => onPanelChange('notifications')}
              data-testid="profile-panel-notifications"
              className={[
                'relative rounded-lg px-3 py-2 text-sm font-semibold transition',
                activePanel === 'notifications' ? 'bg-cyan-400 text-slate-950' : 'text-slate-200 hover:bg-slate-800',
              ].join(' ')}
            >
              نوتیف‌ها
              {notificationUnreadCount > 0 ? (
                <span className="mr-2 rounded-full bg-rose-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white" data-testid="notifications-unread-count">
                  {notificationUnreadCount}
                </span>
              ) : null}
            </button>
          </div>

          {activePanel === 'friends' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-200">مدیریت دوستان</p>
                {incomingRequestCount > 0 ? (
                  <span
                    data-testid="friends-incoming-count"
                    className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-200"
                  >
                    {incomingRequestCount} درخواست جدید
                  </span>
                ) : null}
              </div>

              <label className="block space-y-2">
                <span className="text-xs text-slate-400">جستجوی کاربران</span>
                <input
                  value={friendSearchQuery}
                  onChange={(event) => onFriendSearchQueryChange(event.target.value)}
                  data-testid="friends-search-input"
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-400 transition focus:ring-2"
                  placeholder="نام کاربری دوستت را جستجو کن"
                />
              </label>

              {friendSearchQuery.trim().length >= 2 ? (
                <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/70 p-2">
                  {friendSearchResults.length === 0 ? (
                    <p className="text-xs text-slate-400" data-testid="friends-search-empty">
                      کاربری پیدا نشد.
                    </p>
                  ) : (
                    friendSearchResults.map((result) => (
                      <div
                        key={result.username}
                        className="flex items-center justify-between rounded-md border border-slate-700 px-2 py-1.5"
                        data-testid={`friends-search-row-${result.username}`}
                      >
                        <p className="text-sm text-slate-100">{result.username}</p>
                        {result.relation === 'none' ? (
                          <button
                            type="button"
                            onClick={() => onSendFriendRequest(result.username)}
                            disabled={friendsLoading}
                            data-testid={`friends-send-request-${result.username}`}
                            className="inline-flex items-center justify-center rounded-md bg-emerald-500 p-1.5 text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={`ارسال درخواست دوستی برای ${result.username}`}
                          >
                            <PlusIcon />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">
                            {result.relation === 'friend'
                              ? 'دوست'
                              : result.relation === 'incoming'
                                ? 'درخواست از او'
                                : 'درخواست ارسال شده'}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-xs text-slate-400">درخواست‌های دریافتی</p>
                {incomingRequests.length === 0 ? (
                  <p className="text-xs text-slate-500" data-testid="friends-incoming-empty">
                    فعلاً درخواستی نداری.
                  </p>
                ) : (
                  incomingRequests.map((requester) => (
                    <div
                      key={requester}
                      className="flex items-center justify-between rounded-md border border-slate-700 px-2 py-1.5"
                      data-testid={`friends-incoming-row-${requester}`}
                    >
                      <p className="text-sm text-slate-100">{requester} درخواست دوستی ارسال کرده است.</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onRespondFriendRequest(requester, 'accept')}
                          disabled={friendsLoading}
                          data-testid={`friends-accept-${requester}`}
                          className="inline-flex items-center justify-center rounded-md bg-emerald-500 p-1.5 text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`تایید درخواست ${requester}`}
                        >
                          <CheckIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRespondFriendRequest(requester, 'reject')}
                          disabled={friendsLoading}
                          data-testid={`friends-reject-${requester}`}
                          className="inline-flex items-center justify-center rounded-md bg-rose-500 p-1.5 text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`رد درخواست ${requester}`}
                        >
                          <CrossIcon />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-400">لیست دوستان</p>
                {friends.length === 0 ? (
                  <p className="text-xs text-slate-500" data-testid="friends-list-empty">
                    هنوز دوستی اضافه نشده است.
                  </p>
                ) : (
                  <div className="space-y-1" data-testid="friends-list">
                    {friends.map((friend) => (
                      <div
                        key={friend}
                        className="flex items-center justify-between rounded-md border border-slate-700 px-2 py-1.5"
                        data-testid={`friends-list-row-${friend}`}
                      >
                        <p className="text-sm text-slate-100">{friend}</p>
                        <button
                          type="button"
                          onClick={() => onRemoveFriend(friend)}
                          disabled={friendsLoading}
                          data-testid={`friends-remove-${friend}`}
                          className="rounded-md border border-rose-400/60 px-2 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          حذف دوست
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {outgoingRequests.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">درخواست‌های ارسالی شما</p>
                  <div className="space-y-1">
                    {outgoingRequests.map((target) => (
                      <div
                        key={target}
                        className="flex items-center justify-between rounded-md border border-slate-700 px-2 py-1.5"
                        data-testid={`friends-outgoing-row-${target}`}
                      >
                        <p className="text-xs text-slate-300">{target}</p>
                        <button
                          type="button"
                          onClick={() => onCancelOutgoingRequest(target)}
                          disabled={friendsLoading}
                          data-testid={`friends-cancel-request-${target}`}
                          className="rounded-md border border-slate-500 px-2 py-1 text-xs text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          لغو
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-200">نوتیف‌ها</p>
                <button
                  type="button"
                  onClick={() => onMarkNotificationsRead()}
                  disabled={friendsLoading || notifications.length === 0}
                  data-testid="notifications-mark-all-read"
                  className="rounded-md border border-slate-500 px-2 py-1 text-xs text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  علامت خوانده‌شده برای همه
                </button>
              </div>
              {notifications.length === 0 ? (
                <p className="text-xs text-slate-500" data-testid="notifications-empty">
                  هنوز نوتیفی وجود ندارد.
                </p>
              ) : (
                <div className="space-y-2" data-testid="notifications-list">
                  {notifications.map((notification) => (
                    <button
                      type="button"
                      key={notification.id}
                      onClick={() => {
                        if (!notification.read) {
                          onMarkNotificationsRead([notification.id])
                        }
                      }}
                      data-testid={`notification-item-${notification.id}`}
                      className={[
                        'w-full rounded-md border px-3 py-2 text-right transition',
                        notification.read
                          ? 'border-slate-700 bg-slate-900/70 text-slate-300'
                          : 'border-cyan-500/50 bg-cyan-500/10 text-cyan-100',
                      ].join(' ')}
                    >
                      <p className="text-sm">{notification.message}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{formatNotificationTime(notification.createdAt)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
  const [profileMode, setProfileMode] = useState<ProfileMode>('login')
  const [activePanel, setActivePanel] = useState<ProfilePanel>('friends')
  const [homePanel, setHomePanel] = useState<HomePanel>('menu')
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
  const [friends, setFriends] = useState<string[]>([])
  const [incomingRequests, setIncomingRequests] = useState<string[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<string[]>([])
  const [incomingRequestCount, setIncomingRequestCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0)
  const [friendPresence, setFriendPresence] = useState<FriendPresenceItem[]>([])
  const [friendSearchQuery, setFriendSearchQuery] = useState('')
  const [friendSearchResults, setFriendSearchResults] = useState<Array<{ username: string; relation: FriendRelation }>>([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [bannerMessage, setBannerMessage] = useState<string | null>(null)
  const [isStartingOnline, setIsStartingOnline] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [storageReady, setStorageReady] = useState(false)

  const clearAuthState = useCallback((message?: string) => {
    localStorage.removeItem(PROFILE_USERNAME_STORAGE_KEY)
    setIsAuthenticated(false)
    setProfileName('')
    setDraftName('')
    setUsernameEditValue('')
    setIsEditingUsername(false)
    setFriends([])
    setIncomingRequests([])
    setOutgoingRequests([])
    setIncomingRequestCount(0)
    setFriendPresence([])
    setNotifications([])
    setNotificationUnreadCount(0)
    setHomePanel('menu')
    setActivePanel('friends')
    setFriendSearchQuery('')
    setFriendSearchResults([])
    if (message) {
      setBannerMessage(message)
    }
  }, [])

  const loadFriendsOverview = useCallback(async (username: string, silent = false): Promise<boolean> => {
    const normalized = username.trim()
    if (!normalized) {
      return false
    }

    try {
      const response = await fetch(
        `/api/profile?action=friendsOverview&username=${encodeURIComponent(normalized)}`
      )
      const payload = await parseJsonSafe(response)
      if (!response.ok) {
        if (payload.error?.code === 'USER_NOT_FOUND') {
          clearAuthState('برای ادامه دوباره وارد حساب کاربری شوید.')
          return false
        }
        if (!silent) {
          setBannerMessage(payload.error?.message ?? 'دریافت لیست دوستان انجام نشد.')
        }
        return false
      }

      setFriends(payload.friends ?? [])
      const fallbackPresence = (payload.friends ?? []).map((username) => ({ username, online: false }))
      setFriendPresence(payload.friendPresence ?? fallbackPresence)
      setIncomingRequests(payload.incomingRequests ?? [])
      setOutgoingRequests(payload.outgoingRequests ?? [])
      setIncomingRequestCount(payload.incomingCount ?? 0)
      return true
    } catch {
      if (!silent) {
        setBannerMessage('خطا در دریافت اطلاعات دوستان.')
      }
      return false
    }
  }, [clearAuthState])

  const loadNotifications = useCallback(async (username: string, silent = false): Promise<boolean> => {
    const normalized = username.trim()
    if (!normalized) {
      return false
    }

    try {
      const response = await fetch(
        `/api/profile?action=notifications&username=${encodeURIComponent(normalized)}`
      )
      const payload = await parseJsonSafe(response)
      if (!response.ok) {
        if (payload.error?.code === 'USER_NOT_FOUND') {
          clearAuthState('برای ادامه دوباره وارد حساب کاربری شوید.')
          return false
        }
        if (!silent) {
          setBannerMessage(payload.error?.message ?? 'دریافت نوتیف‌ها انجام نشد.')
        }
        return false
      }

      setNotifications(payload.notifications ?? [])
      setNotificationUnreadCount(payload.unreadCount ?? 0)
      return true
    } catch {
      if (!silent) {
        setBannerMessage('خطا در دریافت نوتیف‌ها.')
      }
      return false
    }
  }, [clearAuthState])

  const searchUsers = useCallback(async (username: string, query: string, signal?: AbortSignal): Promise<boolean> => {
    const normalizedUsername = username.trim()
    const normalizedQuery = query.trim()
    if (!normalizedUsername || normalizedQuery.length < 2) {
      setFriendSearchResults([])
      return false
    }

    try {
      const response = await fetch(
        `/api/profile?action=searchUsers&username=${encodeURIComponent(normalizedUsername)}&query=${encodeURIComponent(normalizedQuery)}`,
        { signal }
      )
      const payload = await parseJsonSafe(response)
      if (!response.ok) {
        setBannerMessage(payload.error?.message ?? 'جستجوی کاربران انجام نشد.')
        return false
      }

      setFriendSearchResults(payload.users ?? [])
      return true
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(PROFILE_USERNAME_STORAGE_KEY)?.trim() ?? ''
    if (!stored) {
      return
    }
    setProfileName(stored)
    setUsernameEditValue(stored)
    setDraftName(stored)
    setIsAuthenticated(true)
  }, [])

  useEffect(() => {
    let cancelled = false

    const checkStorage = async () => {
      try {
        const response = await fetch('/api/profile?action=health')
        const payload = await parseJsonSafe(response)
        if (!cancelled) {
          setStorageReady(response.ok && payload.status === 'ok')
        }
      } catch {
        if (!cancelled) {
          setStorageReady(false)
        }
      }
    }

    void checkStorage()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !profileName.trim()) {
      setFriends([])
      setFriendPresence([])
      setIncomingRequests([])
      setOutgoingRequests([])
      setIncomingRequestCount(0)
      setNotifications([])
      setNotificationUnreadCount(0)
      setHomePanel('menu')
      return
    }
    void loadFriendsOverview(profileName, true)
    void loadNotifications(profileName, true)
  }, [isAuthenticated, loadFriendsOverview, loadNotifications, profileName])

  useEffect(() => {
    if (!isAuthenticated || !profileName.trim()) {
      return
    }

    const interval = setInterval(() => {
      void loadFriendsOverview(profileName, true)
      void loadNotifications(profileName, true)
    }, 3000)

    return () => clearInterval(interval)
  }, [isAuthenticated, loadFriendsOverview, loadNotifications, profileName])

  useEffect(() => {
    if (!isAuthenticated || !profileName.trim() || friendSearchQuery.trim().length < 2) {
      setFriendSearchResults([])
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => {
      void searchUsers(profileName, friendSearchQuery, controller.signal)
    }, 250)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [friendSearchQuery, isAuthenticated, profileName, searchUsers])

  useEffect(() => {
    if (activeTab !== 'home') {
      setHomePanel('menu')
    }
  }, [activeTab])

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

  const handleStartOffline = () => {
    router.push('/offline')
  }

  const handleOpenFriendPlay = () => {
    if (!isAuthenticated || !profileName.trim()) {
      setBannerMessage('برای دیدن لیست دوستان اول وارد حساب کاربری شوید.')
      setActiveTab('profile')
      return
    }
    setHomePanel('friend-play')
    void loadFriendsOverview(profileName, true)
  }

  const handleBackToHomeMenu = () => {
    setHomePanel('menu')
  }

  const handleSubmitAuth = async () => {
    if (!storageReady) {
      setBannerMessage('ذخیره‌سازی پایدار حساب کاربری روی سرور فعال نیست. لطفاً به ادمین اطلاع دهید.')
      return
    }
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

    setIsSubmitting(true)
    setBannerMessage(null)
    try {
      const response = await fetch(`/api/profile?action=${profileMode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          profileMode === 'register'
            ? { username: normalized, password, confirmPassword }
            : { username: normalized, password }
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
      setDraftName(savedName)
      setUsernameEditValue(savedName)
      setIsAuthenticated(true)
      setActiveTab('profile')
      setPassword('')
      setConfirmPassword('')
      setFriendSearchQuery('')
      setFriendSearchResults([])
      await loadFriendsOverview(savedName, true)
      setBannerMessage(profileMode === 'register' ? 'ثبت نام با موفقیت انجام شد.' : 'ورود با موفقیت انجام شد.')
    } catch {
      setBannerMessage('خطا در ارتباط با سرور پروفایل.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveUsername = async () => {
    const currentUsername = profileName.trim()
    const newUsername = usernameEditValue.trim()

    if (!currentUsername) {
      setBannerMessage('ابتدا وارد حساب کاربری شوید.')
      return
    }
    if (newUsername.length < 3) {
      setBannerMessage('نام کاربری باید حداقل ۳ کاراکتر باشد.')
      return
    }

    setIsSubmitting(true)
    setBannerMessage(null)
    try {
      const response = await fetch('/api/profile?action=updateUsername', {
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
      setDraftName(savedName)
      setUsernameEditValue(savedName)
      setIsEditingUsername(false)
      setFriendSearchQuery('')
      setFriendSearchResults([])
      await loadFriendsOverview(savedName, true)
      setBannerMessage('نام کاربری با موفقیت تغییر کرد.')
    } catch {
      setBannerMessage('خطا در ارتباط با سرور پروفایل.')
    } finally {
      setIsSubmitting(false)
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

    setIsSubmitting(true)
    setBannerMessage(null)
    try {
      const response = await fetch('/api/profile?action=changePassword', {
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
      setIsSubmitting(false)
    }
  }

  const handleSendFriendRequest = async (targetUsername: string) => {
    const fromUsername = profileName.trim()
    if (!fromUsername) {
      setBannerMessage('ابتدا وارد حساب کاربری شوید.')
      return
    }

    setFriendsLoading(true)
    setBannerMessage(null)
    try {
      const response = await fetch('/api/profile?action=sendFriendRequest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUsername,
          toUsername: targetUsername,
        }),
      })
      const payload = await parseJsonSafe(response)
      if (!response.ok) {
        setBannerMessage(payload.error?.message ?? 'ارسال درخواست دوستی انجام نشد.')
        return
      }

      await loadFriendsOverview(fromUsername, true)
      await searchUsers(fromUsername, friendSearchQuery)
      setBannerMessage(`درخواست دوستی برای ${targetUsername} ارسال شد.`)
    } catch {
      setBannerMessage('خطا در ارسال درخواست دوستی.')
    } finally {
      setFriendsLoading(false)
    }
  }

  const handleRespondFriendRequest = async (fromUsername: string, action: 'accept' | 'reject') => {
    const username = profileName.trim()
    if (!username) {
      setBannerMessage('ابتدا وارد حساب کاربری شوید.')
      return
    }

    setFriendsLoading(true)
    setBannerMessage(null)
    try {
      const response = await fetch('/api/profile?action=respondFriendRequest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          fromUsername,
          action,
        }),
      })
      const payload = await parseJsonSafe(response)
      if (!response.ok) {
        setBannerMessage(payload.error?.message ?? 'پاسخ به درخواست دوستی انجام نشد.')
        return
      }

      await loadFriendsOverview(username, true)
      await searchUsers(username, friendSearchQuery)
      setBannerMessage(action === 'accept' ? `درخواست ${fromUsername} تایید شد.` : `درخواست ${fromUsername} رد شد.`)
    } catch {
      setBannerMessage('خطا در ثبت پاسخ درخواست دوستی.')
    } finally {
      setFriendsLoading(false)
    }
  }

  const handleCancelOutgoingRequest = async (toUsername: string) => {
    const username = profileName.trim()
    if (!username) {
      setBannerMessage('ابتدا وارد حساب کاربری شوید.')
      return
    }

    setFriendsLoading(true)
    setBannerMessage(null)
    try {
      const response = await fetch('/api/profile?action=cancelOutgoingRequest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          toUsername,
        }),
      })
      const payload = await parseJsonSafe(response)
      if (!response.ok) {
        setBannerMessage(payload.error?.message ?? 'لغو درخواست دوستی انجام نشد.')
        return
      }

      await loadFriendsOverview(username, true)
      await searchUsers(username, friendSearchQuery)
      setBannerMessage(`درخواست ارسالی به ${toUsername} لغو شد.`)
    } catch {
      setBannerMessage('خطا در لغو درخواست دوستی.')
    } finally {
      setFriendsLoading(false)
    }
  }

  const handleRemoveFriend = async (friendUsername: string) => {
    const username = profileName.trim()
    if (!username) {
      setBannerMessage('ابتدا وارد حساب کاربری شوید.')
      return
    }

    setFriendsLoading(true)
    setBannerMessage(null)
    try {
      const response = await fetch('/api/profile?action=removeFriend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          friendUsername,
        }),
      })
      const payload = await parseJsonSafe(response)
      if (!response.ok) {
        setBannerMessage(payload.error?.message ?? 'حذف دوست انجام نشد.')
        return
      }

      await loadFriendsOverview(username, true)
      await searchUsers(username, friendSearchQuery)
      setBannerMessage(`${friendUsername} از لیست دوستان حذف شد.`)
    } catch {
      setBannerMessage('خطا در حذف دوست.')
    } finally {
      setFriendsLoading(false)
    }
  }

  const handleMarkNotificationsRead = async (notificationIds?: string[]) => {
    const username = profileName.trim()
    if (!username) {
      return
    }

    setFriendsLoading(true)
    try {
      const response = await fetch('/api/profile?action=markNotificationsRead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          notificationIds: notificationIds ?? [],
        }),
      })
      const payload = await parseJsonSafe(response)
      if (!response.ok) {
        setBannerMessage(payload.error?.message ?? 'به‌روزرسانی نوتیف‌ها انجام نشد.')
        return
      }

      if (typeof payload.unreadCount === 'number') {
        setNotificationUnreadCount(payload.unreadCount)
      }
      await loadNotifications(username, true)
    } catch {
      setBannerMessage('خطا در به‌روزرسانی نوتیف‌ها.')
    } finally {
      setFriendsLoading(false)
    }
  }

  const handleLogout = () => {
    clearAuthState('با موفقیت از حساب کاربری خارج شدید.')
    setProfileMode('login')
    setPassword('')
    setConfirmPassword('')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmNewPassword('')
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
              onOpenFriendPlay={handleOpenFriendPlay}
              onStartOffline={handleStartOffline}
              onBackToMenu={handleBackToHomeMenu}
              homePanel={homePanel}
              friendPresence={friendPresence}
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
              password={password}
              confirmPassword={confirmPassword}
              onDraftNameChange={setDraftName}
              onPasswordChange={setPassword}
              onConfirmPasswordChange={setConfirmPassword}
              onSubmit={handleSubmitAuth}
              isSubmitting={isSubmitting}
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
              friends={friends}
              incomingRequests={incomingRequests}
              outgoingRequests={outgoingRequests}
              incomingRequestCount={incomingRequestCount}
              friendSearchQuery={friendSearchQuery}
              onFriendSearchQueryChange={setFriendSearchQuery}
              friendSearchResults={friendSearchResults}
              onSendFriendRequest={handleSendFriendRequest}
              onRespondFriendRequest={handleRespondFriendRequest}
              onCancelOutgoingRequest={handleCancelOutgoingRequest}
              onRemoveFriend={handleRemoveFriend}
              activePanel={activePanel}
              onPanelChange={setActivePanel}
              notifications={notifications}
              notificationUnreadCount={notificationUnreadCount}
              onMarkNotificationsRead={handleMarkNotificationsRead}
              onLogout={handleLogout}
              friendsLoading={friendsLoading}
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
                onClick={() => {
                  setActiveTab(item.id)
                  if (item.id !== 'home') {
                    setHomePanel('menu')
                  }
                }}
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
