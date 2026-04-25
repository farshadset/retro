import { test, expect } from '@playwright/test'

test.describe('Home actions and profile registration', () => {
  test('online time selector shows default and persists last choice', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()

    await expect(page.getByTestId('online-time-selector-btn')).toContainText('همه')

    await page.getByTestId('online-play-btn').click()
    await expect(page).toHaveURL(/\/online\?room=/)
    await expect(page.getByText(/Room\s+[A-Z0-9]+/)).toBeVisible()
    await page.evaluate(() => localStorage.removeItem('realtime-chess-session'))
    await page.goto('/')

    await page.getByTestId('online-time-selector-btn').click()
    await page.getByTestId('online-time-option-3-2').click()
    await expect(page.getByTestId('online-time-selector-btn')).toContainText('Blitz • 3+2')

    await page.reload()
    await expect(page.getByTestId('online-time-selector-btn')).toContainText('Blitz • 3+2')
  })

  test('online quick match with همه starts online game without requiring time selection', async ({ page, context }) => {
    const seed = Date.now()
    const firstUser = `quickmatch-a-${seed}`
    const secondUser = `quickmatch-b-${seed}`
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
      await targetPage.getByTestId('footer-tab-home').click()
    }

    await registerUser(page, firstUser)
    await page.getByTestId('online-time-selector-btn').click()
    await page.getByTestId('online-time-option-15-10').click()
    await page.getByTestId('online-play-btn').click()
    await expect(page).toHaveURL(/\/online\?room=/)
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
    await expect(secondPage.getByTestId('online-time-selector-btn')).toContainText('همه')
    await secondPage.getByTestId('online-play-btn').click()
    await expect(secondPage).toHaveURL(/\/online\?room=/)
    const secondRoomId = new URL(secondPage.url()).searchParams.get('room')
    expect(secondRoomId).toBeTruthy()
    await expect(secondPage.getByRole('heading', { name: /Waiting for opponent|In progress/ })).toBeVisible()
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

  test('offline game starts and robot responds to move', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('offline-play-btn').click()

    await expect(page).toHaveURL(/\/offline$/)
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
