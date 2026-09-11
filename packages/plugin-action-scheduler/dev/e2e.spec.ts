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
  await expect(async () => {
    await page.locator('.form-submit button').click()
    await expect(page).toHaveTitle(/Dashboard/, { timeout: 15_000 })
  }).toPass({ timeout: 120_000 })
}

test.describe('Scheduled Actions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/admin/collections/scheduled-actions')
  })

  test('shows the queue strip, status tabs and the code series', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Run queue' })).toBeVisible()
    await expect(page.getByText(/Runner (active|stale)|No runner yet/)).toBeVisible()
    await expect(page.locator('.pas-header__tabs')).toContainText('Pending')
    await expect(page.locator('.pas-cell__hook', { hasText: 'analytics.rollup' })).toBeVisible()
    await expect(page.getByText('Every hour', { exact: false }).first()).toBeVisible()
  })

  test('creates an action from the admin, runs the queue and opens its log', async ({ page }) => {
    await page.goto('/admin/collections/scheduled-actions/create')
    await page.fill('#field-hook', 'orders.remind')
    await page.locator('.json-field textarea, .json-field .monaco-editor').first().click()
    await page.keyboard.type('{"orderId": "e2e"}')
    await page.locator('#action-save').click()
    await expect(page.locator('.payload-toast-container')).toContainText(/created successfully/i)

    await page.goto('/admin/collections/scheduled-actions')
    await page.getByRole('button', { name: 'Run queue' }).click()
    await expect(page.locator('.payload-toast-container')).toContainText(/Ran \d+/)
    await page.locator('.pas-header__tabs').getByText('Completed').click()
    await page.locator('.pas-cell__result').first().click()
    await expect(page.locator('.pas-drawer__timeline')).toContainText('Completed')
  })
})
