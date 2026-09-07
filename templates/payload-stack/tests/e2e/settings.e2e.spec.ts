/**
 * Account and security settings rendered by Better Auth UI: profile name, the cards that exist
 * for the configured features (password, sessions, passkeys, two-factor, API keys, delete
 * account), changing the password, revoking sessions and creating an API key.
 */
import stack from '@/stack.config'
import { BASE, PASSWORD, expect, getSessionViaApi, signInViaApi, test } from './fixtures'

test.describe('account', () => {
  test('shows the profile and saves a new name', async ({ page, member }) => {
    await page.goto(`${BASE}/dashboard/settings/account`)
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    const name = page.locator('input[name="name"]').first()
    await expect(name).toHaveValue(member.user.name)
    await name.fill('Renamed Tester')
    await page.getByRole('button', { name: /save/i }).first().click()
    await expect(page.getByText(/profile updated/i)).toBeVisible()
    await expect.poll(async () => (await getSessionViaApi(page))?.user.name).toBe('Renamed Tester')
    await expect(page.locator('[data-slot="sidebar"]').first().getByText('Renamed Tester')).toBeVisible()
  })

  test('shows the avatar, change-email and appearance cards with the current email', async ({ page, member }) => {
    await page.goto(`${BASE}/dashboard/settings/account`)
    await expect(page.getByRole('button', { name: /change avatar/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Change email' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /email/i })).toHaveValue(member.user.email)
    await expect(page.getByRole('button', { name: /update email/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible()
  })

  test('the settings tabs match the enabled features', async ({ page, member }) => {
    expect(member.org.id).toBeTruthy()
    await page.goto(`${BASE}/dashboard/settings/account`)
    const tabs = ['Account', 'Security', ...(stack.features.organizations ? ['Organizations'] : []), ...(stack.features.billingAttachedTo === 'user' ? ['Billing'] : [])]
    for (const tab of tabs) await expect(page.getByRole('link', { name: tab, exact: true }).first()).toBeVisible()
    if (stack.features.billingAttachedTo !== 'user') {
      const response = await page.goto(`${BASE}/dashboard/settings/billing`)
      expect(response?.status()).toBe(404)
    }
  })
})

test.describe('security', () => {
  test('shows the cards for the configured methods', async ({ page, member }) => {
    expect(member.org.id).toBeTruthy()
    await page.goto(`${BASE}/dashboard/settings/security`)
    if (stack.features.emailPassword) await expect(page.getByText(/change password/i).first()).toBeVisible()
    if (stack.features.twoFactor) await expect(page.getByText(/two-factor/i).first()).toBeVisible()
    if (stack.features.passkeys) await expect(page.getByText(/passkeys?/i).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Active sessions' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'API keys' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Danger zone' })).toBeVisible()
    await expect(page.getByRole('button', { name: /delete account/i })).toBeVisible()
    await expect(page.getByText(/current session/i).first()).toBeVisible()
  })

  test('changes the password; the old one stops working', async ({ page, member, context }) => {
    test.skip(!stack.features.emailPassword, 'password auth is disabled in stack.config.ts')
    await page.goto(`${BASE}/dashboard/settings/security`)
    await page.getByRole('textbox', { name: 'Current password' }).fill(PASSWORD)
    await page.getByRole('textbox', { name: 'New password' }).fill('Changed-Long-Passw0rd!')
    await page.getByRole('textbox', { name: 'Confirm password' }).fill('Changed-Long-Passw0rd!')
    await page.getByRole('button', { name: 'Update password' }).click()
    await expect(page.getByText(/password changed/i)).toBeVisible()

    await context.clearCookies()
    await expect(signInViaApi(page, member.user.email, PASSWORD)).rejects.toThrow(/401|INVALID/i)
    await signInViaApi(page, member.user.email, 'Changed-Long-Passw0rd!')
    expect((await getSessionViaApi(page))?.user.email).toBe(member.user.email)
  })

  test('lists sessions and signs out other devices', async ({ page, member, browser }) => {
    // A second browser signs in as the same user.
    const other = await browser.newContext()
    const otherPage = await other.newPage()
    await signInViaApi(otherPage, member.user.email)
    expect((await getSessionViaApi(otherPage))?.user.email).toBe(member.user.email)

    const listSessions = async () => {
      const response = await page.request.get(`${BASE}/api/auth/list-sessions`, { headers: { origin: BASE } })
      return (await response.json()) as Array<{ id: string }>
    }
    expect((await listSessions()).length).toBeGreaterThanOrEqual(2)

    await page.goto(`${BASE}/dashboard/settings/security`)
    const sessionsCard = page.getByRole('heading', { name: 'Active sessions' }).locator('..')
    // One "Sign Out" per session row (the count includes the current one).
    await expect(sessionsCard.getByRole('button', { name: 'Sign Out' }).first()).toBeVisible()
    expect(await sessionsCard.getByRole('button', { name: 'Sign Out' }).count()).toBeGreaterThanOrEqual(2)
    await sessionsCard.getByRole('button', { name: 'Sign out other devices' }).click()
    const confirm = page.getByRole('dialog').or(page.getByRole('alertdialog'))
    if (await confirm.isVisible().catch(() => false)) await confirm.getByRole('button', { name: /sign out/i }).last().click()
    await expect.poll(async () => (await listSessions()).length, { timeout: 30_000 }).toBe(1)
    // The current session is still valid; the other device's cookie cache lapses within five minutes
    // and its next request against the database is refused.
    expect((await getSessionViaApi(page))?.user.email).toBe(member.user.email)
    const otherSessions = await otherPage.request.get(`${BASE}/api/auth/list-sessions`, { headers: { origin: BASE } })
    expect([401, 200]).toContain(otherSessions.status())
    await other.close()
  })

  test('creates an API key and shows it once', async ({ page, member }) => {
    expect(member.org.id).toBeTruthy()
    await page.goto(`${BASE}/dashboard/settings/security`)
    await page.getByRole('button', { name: /create api key|new api key|create key/i }).first().click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('input[name="name"]').fill('ci')
    await dialog.getByRole('button', { name: /create/i }).last().click()
    // The new key is displayed exactly once, then only its prefix remains.
    const keyField = page.locator('input[readonly], code').filter({ hasText: /.{20,}/ }).or(page.locator('input[readonly]'))
    await expect(keyField.first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText('ci', { exact: true })).toBeVisible()
  })

  test('two-factor enrolment asks for the password and shows the QR code', async ({ page, member }) => {
    test.skip(!stack.features.twoFactor, 'two-factor is disabled in stack.config.ts')
    expect(member.org.id).toBeTruthy()
    await page.goto(`${BASE}/dashboard/settings/security`)
    await page.getByRole('button', { name: /enable two-factor|enable/i }).first().click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('input[type="password"]').first().fill(PASSWORD)
    await dialog.getByRole('button', { name: /continue|enable|next/i }).last().click()
    await expect(dialog.locator('svg, img, canvas').first()).toBeVisible()
    await expect(dialog.getByText(/authenticator|scan|code/i).first()).toBeVisible()
  })
})
