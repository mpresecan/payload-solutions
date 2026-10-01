import type { APIRequestContext } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { devUser } from './helpers/credentials.js'

// Runs against `pnpm dev` with the seeded data and the in-memory Resend mock (no RESEND_API_KEY).

// The first visit to a route compiles it in dev, which can take a while.
test.setTimeout(120_000)

let token = ''

test.beforeEach(async ({ page, request }) => {
  const res = await request.post('/api/users/login', { data: devUser })
  token = ((await res.json()) as { token: string }).token
  await page
    .context()
    .addCookies([{ name: 'payload-token', url: 'http://localhost:3500', value: token }])
})

async function campaignId(request: APIRequestContext) {
  const res = await request.get(
    '/api/newsletter-campaigns?where[name][equals]=October%20product%20update&depth=0',
    {
      headers: { Authorization: `JWT ${token}` },
    },
  )
  const { docs } = (await res.json()) as { docs: Array<{ id: number }> }
  return docs[0].id
}

test('should preview the campaign as the subscriber picked from the list', async ({
  page,
  request,
}) => {
  await page.goto(`/admin/collections/newsletter-campaigns/${await campaignId(request)}/preview`)
  const frame = page.locator('.newsletter-preview__frame')
  await expect(frame).toBeVisible({ timeout: 60_000 })

  await page.fill('#field-newsletter-subscriber-search', 'turing')
  await page.locator('.newsletter-preview__person', { hasText: 'Alan Turing' }).click()

  await expect(page.locator('.newsletter-preview__subject-label')).toContainText('alan@example.com')
  await expect
    .poll(async () => (await frame.getAttribute('srcdoc'))?.replaceAll('<!-- -->', ''))
    .toContain('Hello Alan')
  // Alan has no company, so the property's fallback is used.
  await expect.poll(async () => frame.getAttribute('srcdoc')).toContain('your team')
})

test('should send a test email through Resend', async ({ page, request }) => {
  await page.goto(`/admin/collections/newsletter-campaigns/${await campaignId(request)}/preview`)
  await expect(page.locator('.newsletter-preview__frame')).toBeVisible({ timeout: 60_000 })

  await page.fill('#field-newsletter-test-recipient', 'e2e@example.com')
  await page.getByRole('button', { name: 'Send test email' }).click()
  await expect(page.getByText('Test sent to e2e@example.com')).toBeVisible()

  const state = (await (await request.get('/resend-mock/__mock/state')).json()) as {
    emails: Array<{ subject: string; to: string }>
  }
  expect(
    state.emails.some(
      (email) => email.to === 'e2e@example.com' && email.subject.startsWith('[TEST]'),
    ),
  ).toBe(true)
})

test('should offer a full resync above the lists table', async ({ page }) => {
  await page.goto('/admin/collections/newsletter-lists', { timeout: 90_000 })
  // The summary of the last run is fetched on mount, so it showing means the button is hydrated.
  // Seeding the lists already recorded runs, so there is always one.
  await expect(page.locator('.newsletter-resync-all__summary')).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Resync everything with Resend' }).click()
  await expect(page.getByText('Everything is in sync with Resend')).toBeVisible({ timeout: 60_000 })
})
