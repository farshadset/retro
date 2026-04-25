import { test, expect } from '@playwright/test'

test.describe('Home actions and profile registration', () => {
  test('profile supports register and login, and online game opens correctly', async ({ page, context }) => {
    const uniqueUser = `testuser-${Date.now()}`
    const password = 'secret123'

    await page.goto('/')

    await page.getByTestId('footer-tab-profile').click()
    await page.getByTestId('profile-mode-register').click()
    await page.getByTestId('profile-name-input').fill(uniqueUser)
    await page.getByTestId('profile-password-input').fill(password)
    await page.getByTestId('profile-confirm-password-input').fill(password)
    await page.getByTestId('profile-register-btn').click()

    await expect(page.getByTestId('home-banner-message')).toContainText('ثبت نام با موفقیت انجام شد')
    await expect(page.getByTestId('profile-current-name')).toContainText(uniqueUser)

    await page.getByTestId('footer-tab-home').click()
    await page.getByTestId('online-play-btn').click()
    await expect(page).toHaveURL(/\/online\?room=/)
    await expect(page.getByText(/Room\s+[A-Z0-9]+/)).toBeVisible()

    const secondContext = await context.browser()?.newContext()
    if (!secondContext) {
      throw new Error('Could not create second browser context')
    }
    const secondPage = await secondContext.newPage()
    await secondPage.goto('/')
    await secondPage.getByTestId('footer-tab-profile').click()
    await secondPage.getByTestId('profile-mode-login').click()
    await secondPage.getByTestId('profile-name-input').fill(uniqueUser)
    await secondPage.getByTestId('profile-password-input').fill(password)
    await secondPage.getByTestId('profile-login-btn').click()
    await expect(secondPage.getByTestId('home-banner-message')).toContainText('ورود با موفقیت انجام شد')
    await expect(secondPage.getByTestId('profile-current-name')).toContainText(uniqueUser)

    await secondPage.getByTestId('profile-mode-register').click()
    await secondPage.getByTestId('profile-name-input').fill(uniqueUser)
    await secondPage.getByTestId('profile-password-input').fill(password)
    await secondPage.getByTestId('profile-confirm-password-input').fill(password)
    await secondPage.getByTestId('profile-register-btn').click()
    await expect(secondPage.getByTestId('home-banner-message')).toContainText('این نام کاربری قبلاً ثبت شده است')
    await secondContext.close()
  })
})
