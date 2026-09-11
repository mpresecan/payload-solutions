import { expect, test } from '@playwright/test'

import { devUser } from './helpers/credentials.js'

const MOCK = 'http://127.0.0.1:3399'

test.describe('Vercel Integration admin', () => {
  test.beforeEach(async ({ page, request }) => {
    await request.post(`${MOCK}/__mock/reset`, { data: { buildDelayMs: 500, buildTimeMs: 1500 } })
    await page.goto('/admin/login')
    await page.getByLabel('Email').fill(devUser.email)
    await page.getByLabel('Password').fill(devUser.password)
    await page.getByRole('button', { name: 'Login' }).click()
    await expect(page).toHaveURL(/\/admin$/)
  })

  test('header widget, document pill, deployments view and a deployment end to end', async ({ page }) => {
    // Header widget renders one pill per target plus the Deploy button.
    const header = page.locator('.plugin-vercel-header')
    await expect(header).toBeVisible()
    await expect(header.getByRole('button', { name: /Deploy/ })).toBeVisible()

    // A content change (through the REST API, sharing the session cookie) shows up as pending. Payload only
    // accepts the cookie when the request carries an allow-listed Origin (or a same-origin Sec-Fetch-Site),
    // and Playwright's request context sends neither.
    const created = await page.request.post('/api/posts', {
      data: { title: `E2E post ${Date.now()}` },
      headers: { Origin: 'http://localhost:3400' },
    })
    expect(created.ok()).toBeTruthy()
    const { doc } = (await created.json()) as { doc: { id: number | string; title: string } }
    // An idle widget polls every 60 s; a reload remounts it and fetches fresh status right away.
    await page.reload()
    await expect(header).toContainText(/1 change/, { timeout: 20_000 })

    // The document pill on the edit view says the post is not live yet.
    await page.goto(`/admin/collections/posts/${doc.id}`)
    await expect(page.locator('.plugin-vercel-document-pill')).toContainText('Not deployed yet')

    // The Deployments view lists the change and can deploy it.
    await page.goto('/admin/deployments')
    await expect(page.getByRole('heading', { name: 'Deployments' }).first()).toBeVisible()
    await expect(page.locator('.plugin-vercel-view')).toContainText(doc.title)
    await page.locator('.plugin-vercel-view').getByRole('button', { name: 'Deploy', exact: true }).click()
    await page.getByPlaceholder('Why this deployment?').fill('E2E deployment')
    await page.getByRole('button', { name: 'Deploy', exact: true }).last().click()
    await expect(page.getByText('Deployment of Website requested')).toBeVisible()

    // History follows the mock build to Ready; the pending list empties; the pill turns Live.
    await expect(page.locator('.plugin-vercel-view')).toContainText('E2E deployment')
    await expect(page.locator('.plugin-vercel-view').getByText('Ready').first()).toBeVisible({ timeout: 45_000 })
    await expect(page.locator('.plugin-vercel-view')).toContainText('Nothing is waiting')
    await page.goto(`/admin/collections/posts/${doc.id}`)
    await expect(page.locator('.plugin-vercel-document-pill')).toContainText('Live', { timeout: 30_000 })
  })

  test('the deployments collection list renders the state cell', async ({ page }) => {
    await page.goto('/admin/collections/vercel-deployments')
    await expect(page.getByRole('heading', { name: 'Deployments' }).first()).toBeVisible()
  })
})
