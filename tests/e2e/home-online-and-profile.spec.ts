import { test, expect } from '@playwright/test'

test.describe('Home actions and profile registration', () => {
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

    await page.getByTestId('footer-tab-home').click()
    await page.getByTestId('online-play-btn').click()
    await expect(page).toHaveURL(/\/online\?room=/)
    await expect(page.getByText(/Room\s+[A-Z0-9]+/)).toBeVisible()

    await secondContext.close()
  })
})
