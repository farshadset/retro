import { test, expect } from '@playwright/test'

test.describe('Home actions and profile registration', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('realtime-chess-waiting-actions-delay-ms', '250')
    })
  })

  test('online time selector shows default and persists last choice', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()

    await expect(page.getByTestId('online-time-selector-btn')).toContainText('Rapid • 10+2')

    await page.getByTestId('online-play-btn').click()
    await expect(page).toHaveURL(/(\/online\?room=|\?room=)/)
    await expect(page.getByText(/Room\s+[A-Z0-9]+/)).toBeVisible()
    await page.evaluate(() => localStorage.removeItem('realtime-chess-session'))
    await page.goto('/')

    await page.getByTestId('online-time-selector-btn').click()
    await page.getByTestId('online-time-option-3-2').click()
    await expect(page.getByTestId('online-time-selector-btn')).toContainText('Blitz • 3+2')

    await page.reload()
    await expect(page.getByTestId('online-time-selector-btn')).toContainText('Blitz • 3+2')
  })

  test('online quick match starts online game without requiring extra setup', async ({ page, context }) => {
    const seed = Date.now()
    const firstUser = `quickmatch-a-${seed}`
    const secondUser = `quickmatch-b-${seed}`
    const password = 'secret123'

    const registerUser = async (targetPage: import('@playwright/test').Page, username: string) => {
      await targetPage.goto('/')
      await targetPage.evaluate(() => localStorage.clear())
      await targetPage.reload()
      await expect
        .poll(async () => {
          return targetPage.evaluate(async () => {
            const response = await fetch('/api/profile?action=health')
            if (!response.ok) {
              return 'not-ready'
            }
            const payload = await response.json()
            return payload.status ?? 'not-ready'
          })
        })
        .toBe('ok')
      await targetPage.getByTestId('footer-tab-profile').click()
      await targetPage.getByTestId('profile-mode-register').click()
      await targetPage.getByTestId('profile-name-input').fill(username)
      await targetPage.getByTestId('profile-password-input').fill(password)
      await targetPage.getByTestId('profile-confirm-password-input').fill(password)
      await targetPage.getByTestId('profile-register-btn').click()
      await expect(targetPage.getByTestId('profile-username-value')).toContainText(username)
      await targetPage.getByTestId('footer-tab-home').click()
    }

    await registerUser(page, firstUser)
    await page.getByTestId('online-time-selector-btn').click()
    await page.getByTestId('online-time-option-15-10').click()
    await page.getByTestId('online-play-btn').click()
    await expect(page).toHaveURL(/(\/online\?room=|\?room=)/)
    const firstRoomId = new URL(page.url()).searchParams.get('room')
    expect(firstRoomId).toBeTruthy()
    await expect(page.getByRole('heading', { name: 'Waiting for opponent' })).toBeVisible()
    await page.goto('/')

    const secondContext = await context.browser()?.newContext()
    if (!secondContext) {
      throw new Error('Could not create second browser context')
    }
    const secondPage = await secondContext.newPage()
    await registerUser(secondPage, secondUser)
    await expect(secondPage.getByTestId('online-time-selector-btn')).toContainText('Rapid • 10+2')
    await secondPage.getByTestId('online-play-btn').click()
    await expect(secondPage).toHaveURL(/\/online\?room=/)
    const secondRoomId = new URL(secondPage.url()).searchParams.get('room')
    expect(secondRoomId).toBeTruthy()
    await expect(secondPage.getByRole('heading', { name: /Waiting for opponent|In progress/ })).toBeVisible()
    await secondContext.close()
  })

  test('waiting actions panel appears and retry/share options are shown', async ({ page }) => {
    await page.goto('/online')

    await expect(page).toHaveURL(/(\/online\?room=|\?room=)/)
    await expect(page.getByRole('heading', { name: 'Waiting for opponent' })).toBeVisible()
    await expect(page.getByTestId('waiting-actions-panel')).toBeVisible({ timeout: 4000 })
    await expect(page.getByTestId('waiting-retry-btn')).toBeVisible()
    await expect(page.getByTestId('waiting-share-btn')).toBeVisible()
  })

  test('online game shows messenger-style chat with sticker categories', async ({ page, context }) => {
    const seed = Date.now()
    const firstUser = `chat-a-${seed}`
    const secondUser = `chat-b-${seed}`
    const password = 'secret123'

    const registerUser = async (targetPage: import('@playwright/test').Page, username: string) => {
      await targetPage.goto('/')
      await targetPage.evaluate(() => localStorage.clear())
      await targetPage.reload()
      await expect
        .poll(async () => {
          return targetPage.evaluate(async () => {
            const response = await fetch('/api/profile?action=health')
            if (!response.ok) {
              return 'not-ready'
            }
            const payload = await response.json()
            return payload.status ?? 'not-ready'
          })
        })
        .toBe('ok')
      await targetPage.getByTestId('footer-tab-profile').click()
      await targetPage.getByTestId('profile-mode-register').click()
      await targetPage.getByTestId('profile-name-input').fill(username)
      await targetPage.getByTestId('profile-password-input').fill(password)
      await targetPage.getByTestId('profile-confirm-password-input').fill(password)
      await targetPage.getByTestId('profile-register-btn').click()
      await expect(targetPage.getByTestId('profile-username-value')).toContainText(username)
      await targetPage.getByTestId('footer-tab-home').click()
    }

    await registerUser(page, firstUser)
    await page.getByTestId('online-play-btn').click()
    await expect(page).toHaveURL(/(\/online\?room=|\?room=)/)
    const firstRoomId = new URL(page.url()).searchParams.get('room')
    expect(firstRoomId).toBeTruthy()

    const secondContext = await context.browser()?.newContext()
    if (!secondContext) {
      throw new Error('Could not create second browser context')
    }
    const secondPage = await secondContext.newPage()
    await registerUser(secondPage, secondUser)
    await secondPage.getByTestId('online-play-btn').click()
    await expect(secondPage).toHaveURL(/(\/online\?room=|\?room=)/)

    await page.getByTestId('chat-toggle-btn').click()
    await secondPage.getByTestId('chat-toggle-btn').click()
    await expect(page.getByTestId('chat-panel')).toBeVisible()
    await expect(page.getByTestId('chat-resign-btn')).toBeVisible()
    await expect(page.getByTestId('chat-composer-tab-text')).toBeVisible()
    await expect(page.getByTestId('chat-composer-tab-sticker')).toBeVisible()
    await expect(page.getByTestId('chat-quick-ایول')).toBeVisible()
    await page.getByTestId('chat-quick-ایول').click()
    await expect(page.getByTestId('chat-message-list')).toContainText('ایول')

    await page.getByTestId('chat-composer-tab-sticker').click()
    await expect(page.getByTestId('chat-sticker-category-reaction')).toBeVisible()
    await expect(page.getByTestId('chat-sticker-category-chess')).toBeVisible()
    await page.getByTestId('chat-sticker-category-chess').click()
    await expect(page.getByTestId(`chat-sticker-${encodeURIComponent('♔')}`)).toBeVisible()
    await page.getByTestId(`chat-sticker-${encodeURIComponent('♔')}`).click()
    await expect(page.getByTestId('chat-message-list')).toContainText('♔')

    await expect.poll(async () => {
      return secondPage.evaluate(async (roomId) => {
        const response = await fetch(`/api/chess/rooms/${roomId}`)
        const payload = await response.json()
        const chatMessages = payload.snapshot?.chatMessages ?? []
        return (
          chatMessages.some((message: { value?: string }) => message.value === 'ایول') &&
          chatMessages.some((message: { value?: string }) => message.value === '♔')
        )
      }, firstRoomId ?? '')
    }).toBe(true)

    await secondContext.close()
  })

  test('home shows bot and personal options', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('offline-play-btn')).toContainText('بازی با بات')
    await expect(page.getByTestId('personal-play-btn')).toContainText('بازی شخصی')

    await page.getByTestId('personal-play-btn').click()
    await expect(page).toHaveURL(/\/personal$/)
    await expect(page.getByTestId('personal-status-label')).toContainText('نوبت سفید')
  })

  test('news tab has default اخبار and switches to ویدیو and آموزش', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('footer-tab-news').click()
    await expect(page.getByTestId('news-section-tab-news')).toHaveClass(/bg-cyan-400/)
    await expect(page.getByTestId('news-section-title')).toContainText('اخبار')

    await page.getByTestId('news-section-tab-video').click()
    await expect(page.getByTestId('news-section-tab-video')).toHaveClass(/bg-cyan-400/)
    await expect(page.getByTestId('news-section-title')).toContainText('ویدیو')

    await page.getByTestId('news-section-tab-education').click()
    await expect(page.getByTestId('news-section-tab-education')).toHaveClass(/bg-cyan-400/)
    await expect(page.getByTestId('news-section-title')).toContainText('آموزش')
  })

  test('friend play shows friends with online indicator', async ({ page, context }) => {
    const seed = Date.now()
    const userA = `friendplay-a-${seed}`
    const userB = `friendplay-b-${seed}`
    const password = 'secret123'

    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()

    await page.getByTestId('footer-tab-profile').click()
    await page.getByTestId('profile-mode-register').click()
    await page.getByTestId('profile-name-input').fill(userA)
    await page.getByTestId('profile-password-input').fill(password)
    await page.getByTestId('profile-confirm-password-input').fill(password)
    await page.getByTestId('profile-register-btn').click()

    const secondContext = await context.browser()?.newContext()
    if (!secondContext) {
      throw new Error('Could not create second browser context')
    }
    const secondPage = await secondContext.newPage()
    await secondPage.goto('/')
    await secondPage.evaluate(() => localStorage.clear())
    await secondPage.reload()
    await secondPage.getByTestId('footer-tab-profile').click()
    await secondPage.getByTestId('profile-mode-register').click()
    await secondPage.getByTestId('profile-name-input').fill(userB)
    await secondPage.getByTestId('profile-password-input').fill(password)
    await secondPage.getByTestId('profile-confirm-password-input').fill(password)
    await secondPage.getByTestId('profile-register-btn').click()

    await page.getByTestId('friends-search-input').fill(userB)
    await expect(page.getByTestId(`friends-send-request-${userB}`)).toBeVisible({ timeout: 10000 })
    await page.getByTestId(`friends-send-request-${userB}`).click()
    await expect(secondPage.getByTestId(`friends-incoming-row-${userA}`)).toBeVisible({ timeout: 10000 })
    await secondPage.getByTestId(`friends-accept-${userA}`).click()
    await expect(page.getByTestId(`friends-list-row-${userB}`)).toBeVisible({ timeout: 10000 })

    await page.getByTestId('footer-tab-home').click()
    await page.getByTestId('friend-play-btn').click()

    await expect(page.getByTestId('friend-play-panel')).toBeVisible()
    await expect(page.getByTestId(`friend-play-row-${userB}`)).toBeVisible()
    await expect(page.getByTestId(`friend-play-status-dot-${userB}`)).toHaveClass(/bg-emerald-500/)

    await secondContext.close()
  })

  test('friend play sends invite with selected time and starts both players equal', async ({ page, context }) => {
    const seed = Date.now()
    const userA = `invite-a-${seed}`
    const userB = `invite-b-${seed}`
    const password = 'secret123'

    const registerUser = async (targetPage: import('@playwright/test').Page, username: string) => {
      await targetPage.goto('/')
      await targetPage.evaluate(() => localStorage.clear())
      await targetPage.reload()
      await targetPage.getByTestId('footer-tab-profile').click()
      await targetPage.getByTestId('profile-mode-register').click()
      await targetPage.getByTestId('profile-name-input').fill(username)
      await targetPage.getByTestId('profile-password-input').fill(password)
      await targetPage.getByTestId('profile-confirm-password-input').fill(password)
      await targetPage.getByTestId('profile-register-btn').click()
      await expect(targetPage.getByTestId('profile-username-value')).toContainText(username)
    }

    await registerUser(page, userA)
    const secondContext = await context.browser()?.newContext()
    if (!secondContext) {
      throw new Error('Could not create second browser context')
    }
    const secondPage = await secondContext.newPage()
    await registerUser(secondPage, userB)

    await page.getByTestId('friends-search-input').fill(userB)
    await expect(page.getByTestId(`friends-send-request-${userB}`)).toBeVisible({ timeout: 10000 })
    await page.getByTestId(`friends-send-request-${userB}`).click()
    await expect(secondPage.getByTestId(`friends-incoming-row-${userA}`)).toBeVisible({ timeout: 10000 })
    await secondPage.getByTestId(`friends-accept-${userA}`).click()
    await expect(page.getByTestId(`friends-list-row-${userB}`)).toBeVisible({ timeout: 10000 })

    await page.getByTestId('footer-tab-home').click()
    await secondPage.getByTestId('footer-tab-home').click()
    await page.getByTestId('friend-play-btn').click()
    await secondPage.getByTestId('friend-play-btn').click()

    await expect(page.getByTestId(`friend-play-start-${userB}`)).toBeVisible({ timeout: 10000 })
    await page.getByTestId(`friend-play-start-${userB}`).click()
    await expect(page.getByTestId('friend-invite-modal')).toBeVisible()
    await page.getByTestId('friend-invite-time-select').selectOption('10-2')
    await page.getByTestId('friend-invite-send-btn').click()

    await expect(secondPage.getByTestId(/^friend-play-invite-row-/)).toBeVisible({ timeout: 15000 })
    const inviteRow = secondPage.getByTestId(/^friend-play-invite-row-/).first()
    await expect(inviteRow).toContainText('10+2')
    const inviteId = (await inviteRow.getAttribute('data-testid'))?.replace('friend-play-invite-row-', '')
    expect(inviteId).toBeTruthy()
    await secondPage.getByTestId(`friend-play-invite-accept-${inviteId}`).click()

    await expect(page).toHaveURL(/\/online\?room=/, { timeout: 20000 })
    await expect(secondPage).toHaveURL(/\/online\?room=/, { timeout: 20000 })
    const roomA = new URL(page.url()).searchParams.get('room')
    const roomB = new URL(secondPage.url()).searchParams.get('room')
    expect(roomA).toBeTruthy()
    expect(roomB).toBeTruthy()
    expect(roomA).toBe(roomB)

    await expect.poll(async () => {
      const roomId = roomA ?? ''
      if (!roomId) {
        return null
      }
      return page.evaluate(async (id) => {
        const response = await fetch(`/api/chess/rooms/${id}`)
        const payload = await response.json()
        return payload.snapshot
          ? {
              whiteTimeMs: payload.snapshot.whiteTimeMs,
              blackTimeMs: payload.snapshot.blackTimeMs,
              incrementMs: payload.snapshot.incrementMs,
              timeControlMs: payload.snapshot.timeControlMs,
              status: payload.snapshot.status,
            }
          : null
      }, roomId)
    }).toMatchObject({
      timeControlMs: 600000,
      incrementMs: 2000,
    })

    const snapshot = await page.evaluate(async (id) => {
      const response = await fetch(`/api/chess/rooms/${id}`)
      const payload = await response.json()
      return payload.snapshot
    }, roomA ?? '')
    expect(snapshot.whiteTimeMs).toBeLessThanOrEqual(600000)
    expect(snapshot.blackTimeMs).toBeLessThanOrEqual(600000)
    expect(snapshot.whiteTimeMs).toBeGreaterThan(590000)
    expect(snapshot.blackTimeMs).toBeGreaterThan(590000)
    expect(Math.abs(snapshot.whiteTimeMs - snapshot.blackTimeMs)).toBeLessThan(2000)
    expect(snapshot.status).toBe('active')

    await secondContext.close()
  })

  test('offline game starts and robot responds to move', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('offline-play-btn').click()

    await expect(page).toHaveURL(/\/offline$/)
    await expect(page.getByTestId('offline-bot-level-select')).toBeVisible()
    await expect(page.getByTestId('offline-bot-rating-label')).toContainText('ریتینگ')
    await page.getByTestId('offline-bot-level-select').selectOption('expert')
    await expect(page.getByTestId('offline-bot-rating-label')).toContainText('استاد')
    await expect(page.getByTestId('offline-bot-rating-label')).toContainText('2000')
    await expect(page.getByTestId('offline-status-label')).toContainText('Your turn')

    await page.getByTestId('chess-square-e2').click()
    await page.getByTestId('chess-square-e4').click()

    await expect(page.getByTestId('offline-status-label')).toContainText('Robot is thinking...')
    await expect(page.getByText('e4')).toBeVisible()
    await expect(page.getByText('e4').first()).toBeVisible()

    await expect(page.getByTestId('offline-status-label')).toContainText('Your turn', { timeout: 10000 })
    await expect(page.locator('li')).toHaveCount(2, { timeout: 10000 })
  })

  test('profile supports register, notifications, cancel request, unfriend, and online game', async ({ page, context }) => {
    const seed = Date.now()
    const userA = `testuser-a-${seed}`
    const userB = `testuser-b-${seed}`
    const password = 'secret123'

    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()

    await page.getByTestId('footer-tab-profile').click()
    await page.getByTestId('profile-mode-register').click()
    await page.getByTestId('profile-name-input').fill(userA)
    await page.getByTestId('profile-password-input').fill(password)
    await page.getByTestId('profile-confirm-password-input').fill(password)
    await page.getByTestId('profile-register-btn').click()
    await expect(page.getByTestId('profile-username-value')).toContainText(userA)

    const secondContext = await context.browser()?.newContext()
    if (!secondContext) {
      throw new Error('Could not create second browser context')
    }

    const secondPage = await secondContext.newPage()
    await secondPage.goto('/')
    await secondPage.evaluate(() => localStorage.clear())
    await secondPage.reload()
    await secondPage.getByTestId('footer-tab-profile').click()
    await secondPage.getByTestId('profile-mode-register').click()
    await secondPage.getByTestId('profile-name-input').fill(userB)
    await secondPage.getByTestId('profile-password-input').fill(password)
    await secondPage.getByTestId('profile-confirm-password-input').fill(password)
    await secondPage.getByTestId('profile-register-btn').click()
    await expect(secondPage.getByTestId('profile-username-value')).toContainText(userB)

    // Send request from A to B, then cancel it.
    await page.getByTestId('friends-search-input').fill(userB)
    await expect(page.getByTestId(`friends-send-request-${userB}`)).toBeVisible()
    await page.getByTestId(`friends-send-request-${userB}`).click()
    await expect(page.getByTestId(`friends-outgoing-row-${userB}`)).toBeVisible()
    await page.getByTestId(`friends-cancel-request-${userB}`).click()
    await expect(page.getByTestId('home-banner-message')).toContainText(`درخواست ارسالی به ${userB} لغو شد.`)
    await expect(page.getByTestId(`friends-outgoing-row-${userB}`)).toHaveCount(0)

    // Send request again and accept it on B.
    await page.getByTestId(`friends-send-request-${userB}`).click()
    await expect(secondPage.getByTestId(`friends-incoming-row-${userA}`)).toBeVisible({ timeout: 10000 })
    await secondPage.getByTestId(`friends-accept-${userA}`).click()
    await expect(secondPage.getByTestId('friends-list')).toContainText(userA)

    // B sees notification from A and marks all read.
    await secondPage.getByTestId('profile-panel-notifications').click()
    await expect(secondPage.getByTestId('notifications-list')).toContainText('درخواست دوستی')
    await secondPage.getByTestId('notifications-mark-all-read').click()
    await expect(secondPage.getByTestId('notifications-unread-count')).toHaveCount(0)

    // A sees acceptance notification.
    await page.getByTestId('profile-panel-notifications').click()
    await expect(page.getByTestId('notifications-list')).toContainText('درخواست دوستی شما را تایید کرد')

    // Unfriend from A and verify removal.
    await page.getByTestId('profile-panel-friends').click()
    await page.getByTestId(`friends-remove-${userB}`).click()
    await expect(page.getByTestId(`friends-list-row-${userB}`)).toHaveCount(0)

    await secondPage.getByTestId('profile-panel-friends').click()
    await expect(secondPage.getByTestId(`friends-list-row-${userA}`)).toHaveCount(0)

    await secondPage.getByTestId('profile-panel-notifications').click()
    await expect(secondPage.getByTestId('notifications-list')).toContainText('از لیست دوستان حذف کرد')

    await page.getByTestId('profile-logout-btn').click()
    await expect(page.getByTestId('profile-login-btn')).toBeVisible()
    await page.getByTestId('footer-tab-home').click()
    await page.getByTestId('footer-tab-profile').click()
    await expect(page.getByTestId('profile-login-btn')).toBeVisible()

    await page.getByTestId('footer-tab-home').click()
    await page.getByTestId('online-time-selector-btn').click()
    await page.getByTestId('online-time-option-10-2').click()
    await page.getByTestId('online-play-btn').click()
    await expect(page).toHaveURL(/\/online\?room=/)
    await expect(page.getByText(/Room\s+[A-Z0-9]+/)).toBeVisible()

    await secondContext.close()
  })
})
