import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { devUser } from './helpers/credentials.js'

/** The admin keeps the session in a cookie, so every test signs in first. */
async function login(page: Page) {
  await page.goto('/admin/login', { waitUntil: 'networkidle' })
  if (!(await page.locator('#field-email').isVisible().catch(() => false))) {
    await expect(page).toHaveTitle(/Dashboard/)
    return
  }
  await page.fill('#field-email', devUser.email)
  await page.fill('#field-password', devUser.password)
  // The login form is client-side: a click that lands before hydration is swallowed, and on a cold
  // dev server hydration waits on Next compiling the route. Retry the submit until it takes.
  await expect(async () => {
    await page.locator('.form-submit button').click()
    await expect(page).toHaveTitle(/Dashboard/, { timeout: 15_000 })
  }).toPass({ timeout: 120_000 })
}

/** Opens one email by its label and switches to the Preview & test tab. */
async function openPreview(page: Page, label: string) {
  await page.goto('/admin/collections/transactional-emails')
  await page.getByRole('link', { exact: true, name: label }).click()
  await page.getByRole('link', { name: 'Preview & test' }).click()
  await expect(page).toHaveURL(/\/preview$/)
}

test('should render admin panel logo', async ({ page }) => {
  await login(page)
  await expect(page.locator('.graphic-icon')).toBeVisible()
})

test.describe('Preview & test', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('renders the email with the sample data resolved into subject, body and recipients', async ({ page }) => {
    await openPreview(page, 'Welcome')

    // The panel renders a skeleton until the first /preview call returns.
    const subject = page.locator('.emails-preview__subject-text')
    await expect(subject).toBeVisible({ timeout: 30_000 })
    await expect(subject).toContainText('Welcome to')
    // Variables are filled in server-side: nothing raw should reach the preview.
    await expect(subject).not.toContainText('{{')
    await expect(page.locator('.emails-preview__preheader')).toContainText('Your account is ready.')

    // The body is rendered HTML in a sandboxed iframe, not markup on the page.
    const frame = page.frameLocator('iframe[title="Email preview"]')
    await expect(frame.getByText('Thanks for creating an account')).toBeVisible()
    await expect(frame.getByRole('link', { name: 'Open your dashboard' })).toBeVisible()
    await expect(frame.locator('body')).not.toContainText('{{')

    // Who it would go to, resolved from the same sample data.
    await expect(page.locator('.emails-preview__recipients')).toContainText('@')

    // The plain-text alternative is rendered from the same copy.
    await page.getByText('Plain text', { exact: true }).click()
    const text = page.locator('.emails-preview__text')
    await expect(text).toBeVisible()
    await expect(text).toContainText('Thanks for creating an account')
    await expect(text).not.toContainText('{{')
  })

  test('re-renders when the sample data changes', async ({ page }) => {
    await openPreview(page, 'Password reset')

    const frame = page.frameLocator('iframe[title="Email preview"]')
    await expect(frame.getByText('Someone asked to reset the password')).toBeVisible({ timeout: 30_000 })
    await expect(frame.locator('body')).toContainText('60 minutes')

    // Editing the sample form triggers a fresh render of the same email.
    const minutes = page.locator('.emails-sample-form__field', { hasText: 'Expires In Minutes' }).locator('input')
    await minutes.fill('15')
    await expect(frame.locator('body')).toContainText('15 minutes', { timeout: 15_000 })
  })
})
