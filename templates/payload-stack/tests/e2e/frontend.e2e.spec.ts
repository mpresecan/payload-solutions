import { expect, test } from '@playwright/test'

const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

test.describe('Marketing site', () => {
  test('renders the homepage from stack.config.ts', async ({ page }) => {
    await page.goto(base)
    await expect(page.locator('h1').first()).toBeVisible()
    await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible()
  })

  test('serves seeded legal pages', async ({ page }) => {
    await page.goto(`${base}/legal/privacy`)
    await expect(page.locator('h1')).toHaveText(/privacy policy/i)
  })
})

test.describe('Authentication and onboarding', () => {
  test('signs up, creates an organization and reaches the dashboard', async ({ page }) => {
    const stamp = Date.now().toString(36)
    const email = `e2e+${stamp}@example.test`
    const password = 'Long-Enough-Passw0rd!'

    await page.goto(`${base}/auth/sign-up`)
    await page.locator('input[name="name"]').fill('E2E Tester')
    await page.locator('input[name="email"]').fill(email)
    await page.locator('input[name="password"]').first().fill(password)
    const confirm = page.locator('input[name="confirmPassword"]')
    if (await confirm.count()) await confirm.fill(password)
    await page.getByRole('button', { name: /sign up/i }).click()

    // Sign-up lands on /dashboard, which sends users without an organization to /onboarding.
    await page.waitForURL(/\/onboarding|\/dashboard/, { timeout: 60_000 })
    const orgName = page.locator('#org-name')
    const needsOnboarding = await orgName.waitFor({ timeout: 15_000 }).then(
      () => true,
      () => false,
    )
    if (needsOnboarding) {
      await orgName.fill(`E2E Org ${stamp}`)
      await page.getByRole('button', { name: /continue/i }).click()
      await page.waitForURL(/\/dashboard/, { timeout: 60_000 })
    }

    await page.goto(`${base}/dashboard`)
    await expect(page.getByText(/welcome back/i)).toBeVisible()
  })

  test('keeps regular users out of the Payload admin', async ({ page }) => {
    await page.goto(`${base}/admin`)
    await expect(page).toHaveURL(/\/admin\/(login|unauthorized)/)
  })
})
