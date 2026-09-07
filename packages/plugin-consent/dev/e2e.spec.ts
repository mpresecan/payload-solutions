import { expect, test } from '@playwright/test'

import { devUser } from './helpers/credentials.js'

test.describe('admin', () => {
  test('logs in and shows the Privacy group and the consent overview widget', async ({ page }) => {
    await page.goto('/admin')
    await page.fill('#field-email', devUser.email)
    await page.fill('#field-password', devUser.password)
    await page.click('.form-submit button')
    await expect(page).toHaveTitle(/Dashboard/)
    await expect(page.getByText('Payload Consent', { exact: true })).toBeVisible()
    await expect(page.locator('#nav-consent-trackers')).toBeVisible()
    await expect(page.locator('#nav-consent-categories')).toBeVisible()
    await expect(page.locator('#nav-legal-pages')).toBeVisible()
  })
})

test.describe('frontend (opt-in jurisdiction)', () => {
  test.use({ extraHTTPHeaders: { 'x-vercel-ip-country': 'DE' } })

  test('shows the banner, gates content, records the decision and remembers it', async ({ context, page }) => {
    await page.goto('/')
    const banner = page.locator('[data-consent-banner]')
    await expect(banner).toBeVisible()
    await expect(banner.getByRole('button', { name: 'Reject all' })).toBeVisible()
    await expect(banner.getByRole('button', { name: 'Accept all' })).toBeVisible()
    await expect(page.locator('[data-consent-gate="blocked"]')).toBeVisible()
    await expect(page.locator('script[data-consent-tracker]')).toHaveCount(1) // GA4 is Consent-Mode-managed, loads immediately
    // Consent Mode defaults were emitted exactly once, all denied except security_storage.
    const defaults = await page.evaluate(() => {
      const layer = (window as unknown as { dataLayer?: IArguments[] }).dataLayer ?? []
      return Array.from(layer)
        .map((args) => Array.from(args as unknown as unknown[]))
        .filter((args) => args[0] === 'consent' && args[1] === 'default')
        .map((args) => args[2] as Record<string, string>)
    })
    expect(defaults).toHaveLength(1)
    expect(defaults[0]).toMatchObject({ ad_storage: 'denied', analytics_storage: 'denied', security_storage: 'granted' })

    const recorded = page.waitForResponse((r) => r.url().includes('/api/consent/records') && r.request().method() === 'POST')
    await banner.getByRole('button', { name: 'Accept all' }).click()
    expect((await recorded).status()).toBe(201)

    await expect(banner).toBeHidden()
    await expect(page.locator('[data-consent-gate="granted"]')).toBeVisible()
    await expect(page.locator('[data-consent-analytics]')).toHaveText('true')
    await expect(page.locator('script[data-consent-tracker]')).toHaveCount(1) // PostHog is an SDK tracker: nothing else to inject
    const cookie = (await context.cookies()).find((c) => c.name === 'pl-consent')
    expect(cookie?.value).toBeTruthy()

    await page.reload()
    await expect(page.locator('[data-consent-banner]')).toHaveCount(0)
    await expect(page.locator('[data-consent-gate="granted"]')).toBeVisible()

    // Footer link reopens preferences; switching analytics off flags a reload.
    await page.locator('[data-consent-manage]').click()
    const dialog = page.locator('[data-consent-preferences]')
    await expect(dialog).toBeVisible()
    await dialog.locator('#consent-analytics').uncheck()
    await dialog.getByRole('button', { name: 'Save preferences' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.locator('[data-consent-analytics]')).toHaveText('false')
  })

  test('renders markdown tables in the privacy policy as real tables', async ({ page }) => {
    await page.goto('/legal/privacy')
    const table = page.locator('[data-legal-page="privacy"] [data-lexical-table]').first()
    await expect(table).toBeVisible()
    await expect(table.locator('thead th')).toHaveText(['Category', 'Examples', 'Purpose', 'Legal basis'])
    await expect(table.locator('tbody tr').first().locator('td').first()).toHaveText('Account data')
    // Nothing left rendering as literal markdown.
    await expect(page.locator('[data-legal-page="privacy"]')).not.toContainText('| --- |')
  })

  test('renders the cookie policy with the generated cookie table', async ({ page }) => {
    await page.goto('/legal/cookies')
    await expect(page.locator('[data-legal-page="cookies"] h1')).toHaveText('Cookie Policy')
    const table = page.locator('[data-consent-cookie-table]')
    await expect(table).toBeVisible()
    await expect(table.getByText('PostHog', { exact: true })).toBeVisible()
    await expect(table.getByText('Google Analytics 4', { exact: true })).toBeVisible()
    await expect(page.locator('[data-consent-policy-version]')).toContainText('Version')
  })
})

test.describe('frontend (no consent required)', () => {
  test.use({ extraHTTPHeaders: { 'x-vercel-ip-country': 'US' } })

  test('opt-out jurisdiction grants by default and shows a dismissable notice', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-consent-banner]')).toBeVisible()
    await expect(page.locator('[data-consent-gate="granted"]')).toBeVisible()
    await expect(page.locator('[data-consent-analytics]')).toHaveText('true')
  })
})
