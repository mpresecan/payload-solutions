/**
 * Site admins (the `admin` role managed by Better Auth's admin plugin): the extra navigation,
 * the in-app user administration at /dashboard/admin/users, and the Payload admin panel that
 * trusts the same session.
 */
import { BASE, adminCredentials, createOrgViaApi, expect, getSessionViaApi, signInViaApi, signUpViaApi, test } from './fixtures'

test.describe('site admin', () => {
  test.beforeEach(async ({ page }) => {
    const { email, password } = adminCredentials()
    await signInViaApi(page, email, password)
    const session = await getSessionViaApi(page)
    expect(session?.user.email).toBe(email)
    // The admin needs an organization like everyone else to enter the dashboard.
    const orgs = await page.request.get(`${BASE}/api/auth/organization/list`, { headers: { origin: BASE } }).then((r) => r.json() as Promise<Array<{ id: string }>>)
    if (orgs.length === 0) await createOrgViaApi(page, 'Admin org')
    else await page.request.post(`${BASE}/api/auth/organization/set-active`, { data: { organizationId: orgs[0]!.id }, headers: { origin: BASE } })
  })

  test('sees the Payload admin link in the sidebar and the user menu', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`)
    const sidebar = page.locator('[data-slot="sidebar"]').first()
    await expect(sidebar.getByRole('link', { name: 'Payload admin' })).toHaveAttribute('href', '/admin')
    await page.getByRole('button', { name: new RegExp(adminCredentials().email) }).click()
    await expect(page.getByRole('menuitem', { name: /payload admin/i })).toBeVisible()
  })

  test('can list users in the in-app admin, including a freshly created one', async ({ page, browser }) => {
    const other = await browser.newContext()
    const otherPage = await other.newPage()
    const fresh = await signUpViaApi(otherPage, { name: 'Fresh User' })
    await other.close()

    await page.goto(`${BASE}/dashboard/admin/users`)
    await expect(page.getByRole('heading', { name: 'Users' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create user' })).toBeVisible()
    await page.getByRole('textbox', { name: /search by email/i }).fill(fresh.email)
    await expect(page.getByRole('row').filter({ hasText: fresh.email })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('row').filter({ hasText: fresh.email })).toContainText(/user/i)
    await expect(page.getByRole('row').filter({ hasText: fresh.email })).toContainText(/active/i)
  })

  test('can ban a user from the in-app admin, and the ban blocks sign-in', async ({ page, browser }) => {
    const other = await browser.newContext()
    const otherPage = await other.newPage()
    const victim = await signUpViaApi(otherPage, { name: 'Ban Me' })
    await other.close()

    await page.goto(`${BASE}/dashboard/admin/users`)
    await page.getByRole('textbox', { name: /search by email/i }).fill(victim.email)
    const row = page.getByRole('row').filter({ hasText: victim.email })
    await expect(row).toBeVisible({ timeout: 30_000 })
    // Opening the row shows the user's details and actions.
    await row.click()
    const panel = page.getByRole('dialog')
    await expect(panel).toBeVisible()
    await panel.getByRole('button', { name: /^ban user$|^ban$/i }).click()
    const confirm = page.getByRole('dialog').last().or(page.getByRole('alertdialog'))
    const reason = confirm.getByRole('textbox').first()
    if (await reason.isVisible().catch(() => false)) await reason.fill('e2e')
    await confirm.getByRole('button', { name: /^ban/i }).last().click()
    await expect(panel.getByRole('button', { name: /unban user/i })).toBeVisible({ timeout: 30_000 })
    await panel.getByRole('button', { name: 'Close' }).click()
    await expect(panel).toBeHidden()
    await expect(row).toContainText(/banned/i, { timeout: 30_000 })

    const banned = await browser.newContext()
    const bannedPage = await banned.newPage()
    await expect(signInViaApi(bannedPage, victim.email)).rejects.toThrow(/BANNED|banned|403/i)
    await banned.close()
  })

  test('opens the Payload admin panel with the same session', async ({ page }) => {
    // The plugin hides its selector unless there is something to choose between: TenantSelectorClient
    // returns null for `options.length <= 1`. beforeEach leaves the admin with a single organization,
    // so on a fresh database this needs a second one before the selector is expected.
    await createOrgViaApi(page, 'Second admin org')

    await page.goto(`${BASE}/admin`)
    await expect(page).not.toHaveURL(/\/admin\/(login|unauthorized)/)
    await expect(page.getByRole('link', { name: /projects/i }).first()).toBeVisible({ timeout: 90_000 })
    // The tenant selector the multi-tenant plugin adds is present for admins.
    await expect(page.getByText('Filter by Tenant').first()).toBeVisible()
  })
})
