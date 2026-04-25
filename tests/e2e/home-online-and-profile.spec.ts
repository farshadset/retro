import { test, expect } from '@playwright/test'

test.describe('Home actions and profile registration', () => {
  test('profile supports register, login, edit username, change password, and online game', async ({ page, context }) => {
    const uniqueUser = `testuser-${Date.now()}`
    const password = 'secret123'
    const updatedUser = `${uniqueUser}-new`
    const newPassword = 'secret999'

    await page.goto('/')

    await page.getByTestId('footer-tab-profile').click()
    await page.getByTestId('profile-mode-register').click()
    await page.getByTestId('profile-name-input').fill(uniqueUser)
    await page.getByTestId('profile-password-input').fill(password)
    await page.getByTestId('profile-confirm-password-input').fill(password)
    await page.getByTestId('profile-register-btn').click()

    await expect(page.getByTestId('home-banner-message')).toContainText('ثبت نام با موفقیت انجام شد')
    await expect(page.getByTestId('profile-username-value')).toContainText(uniqueUser)

    await page.getByTestId('profile-username-edit-btn').click()
    await page.getByTestId('profile-username-edit-input').fill(updatedUser)
    await page.getByTestId('profile-username-save-btn').click()
    await expect(page.getByTestId('home-banner-message')).toContainText('نام کاربری با موفقیت تغییر کرد')
    await expect(page.getByTestId('profile-username-value')).toContainText(updatedUser)

    await page.getByTestId('profile-current-password-input').fill(password)
    await page.getByTestId('profile-new-password-input').fill(newPassword)
    await page.getByTestId('profile-confirm-new-password-input').fill('different-pass')
    await page.getByTestId('profile-change-password-btn').click()
    await expect(page.getByTestId('home-banner-message')).toContainText('تکرار رمز عبور جدید با هم یکسان نیست')

    await page.getByTestId('profile-confirm-new-password-input').fill(newPassword)
    await page.getByTestId('profile-change-password-btn').click()
    await expect(page.getByTestId('home-banner-message')).toContainText('رمز عبور با موفقیت تغییر کرد')

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
    await secondPage.getByTestId('profile-name-input').fill(updatedUser)
    await secondPage.getByTestId('profile-password-input').fill(newPassword)
    await secondPage.getByTestId('profile-login-btn').click()
    await expect(secondPage.getByTestId('home-banner-message')).toContainText('ورود با موفقیت انجام شد')
    await expect(secondPage.getByTestId('profile-username-value')).toContainText(updatedUser)

    const thirdContext = await context.browser()?.newContext()
    if (!thirdContext) {
      throw new Error('Could not create third browser context')
    }
    const thirdPage = await thirdContext.newPage()
    await thirdPage.goto('/')
    await thirdPage.getByTestId('footer-tab-profile').click()
    await thirdPage.getByTestId('profile-mode-register').click()
    await thirdPage.getByTestId('profile-name-input').fill(updatedUser)
    await thirdPage.getByTestId('profile-password-input').fill(password)
    await thirdPage.getByTestId('profile-confirm-password-input').fill(password)
    await thirdPage.getByTestId('profile-register-btn').click()
    await expect(thirdPage.getByTestId('home-banner-message')).toContainText('این نام کاربری قبلاً ثبت شده است')
    await thirdContext.close()
    await secondContext.close()
  })
})
