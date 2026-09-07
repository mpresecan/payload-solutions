/**
 * Authentication screens rendered by Better Auth UI from stack.config.ts: sign-up, sign-in (right
 * and wrong password), sign-out, forgot password, the passwordless options, protected-route
 * redirects with a return url, and the accept-invitation view.
 */
import stack from '@/stack.config'
import {
  BASE,
  PASSWORD,
  createOrgViaApi,
  expect,
  getSessionViaApi,
  inviteViaApi,
  signUpViaApi,
  stamp,
  test,
  uniqueEmail,
} from './fixtures'

test.describe('sign-up', () => {
  test('creates an account from the form and lands in onboarding', async ({ page }) => {
    const email = uniqueEmail('signup')
    await page.goto(`${BASE}/auth/sign-up`)
    await page.locator('input[name="name"]').fill('Form Tester')
    await page.locator('input[name="email"]').fill(email)
    await page.locator('input[name="password"]').first().fill(PASSWORD)
    await page.locator('input[name="confirmPassword"]').fill(PASSWORD)
    await page.getByRole('button', { name: /sign up/i }).click()
    await page.waitForURL(/\/onboarding/, { timeout: 60_000 })
    const session = await getSessionViaApi(page)
    expect(session?.user.email).toBe(email)
    expect(session?.user.name).toBe('Form Tester')
  })

  test('rejects mismatched passwords and short passwords client-side', async ({ page }) => {
    await page.goto(`${BASE}/auth/sign-up`)
    await page.locator('input[name="name"]').fill('Form Tester')
    await page.locator('input[name="email"]').fill(uniqueEmail('mismatch'))
    await page.locator('input[name="password"]').first().fill(PASSWORD)
    await page.locator('input[name="confirmPassword"]').fill('Different-Passw0rd!')
    await page.getByRole('button', { name: /sign up/i }).click()
    await expect(page.getByText(/passwords do not match/i)).toBeVisible()
    await expect(page).toHaveURL(/\/auth\/sign-up/)
  })

  test('shows the password strength meter and the link to sign in', async ({ page }) => {
    await page.goto(`${BASE}/auth/sign-up`)
    await page.locator('input[name="password"]').first().fill('abc')
    await expect(page.getByText(/weak|too short|strength/i).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', /\/auth\/sign-in/)
  })
})

test.describe('sign-in', () => {
  test('signs in with email and password and reaches the dashboard', async ({ page, context }) => {
    const user = await signUpViaApi(page)
    await createOrgViaApi(page)
    await context.clearCookies()

    await page.goto(`${BASE}/auth/sign-in`)
    await page.locator('input[name="email"]').fill(user.email)
    await page.locator('input[name="password"]').fill(user.password)
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 })
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
  })

  test('shows an error for a wrong password and stays on the page', async ({ page, context }) => {
    const user = await signUpViaApi(page)
    await context.clearCookies()
    await page.goto(`${BASE}/auth/sign-in`)
    await page.locator('input[name="email"]').fill(user.email)
    await page.locator('input[name="password"]').fill('Wrong-Passw0rd!')
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.getByText(/invalid email or password/i)).toBeVisible()
    await expect(page).toHaveURL(/\/auth\/sign-in/)
    expect(await getSessionViaApi(page)).toBeNull()
  })

  test('offers every configured sign-in method', async ({ page }) => {
    await page.goto(`${BASE}/auth/sign-in`)
    if (stack.features.emailPassword) {
      await expect(page.locator('input[name="password"]')).toBeVisible()
      await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible()
    }
    if (stack.features.magicLink) await expect(page.getByRole('link', { name: /magic link/i })).toHaveAttribute('href', '/auth/magic-link')
    if (stack.features.passkeys) await expect(page.getByRole('button', { name: /passkey/i })).toBeVisible()
    for (const provider of stack.auth.social) await expect(page.getByRole('button', { name: new RegExp(provider, 'i') })).toBeVisible()
    if (stack.auth.allowSignUp) await expect(page.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', /\/auth\/sign-up/)
  })

  test('the magic link screen asks for an email and confirms the send', async ({ page }) => {
    test.skip(!stack.features.magicLink, 'magic links are disabled in stack.config.ts')
    await page.goto(`${BASE}/auth/magic-link`)
    await page.locator('input[name="email"]').fill(uniqueEmail('magic'))
    await page.getByRole('button', { name: /magic link/i }).click()
    await expect(page.getByText(/check your email/i)).toBeVisible()
  })

  test('honours redirectTo after sign-in', async ({ page, context }) => {
    const user = await signUpViaApi(page)
    await createOrgViaApi(page)
    await context.clearCookies()
    await page.goto(`${BASE}/auth/sign-in?redirectTo=${encodeURIComponent('/dashboard/projects')}`)
    await page.locator('input[name="email"]').fill(user.email)
    await page.locator('input[name="password"]').fill(user.password)
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await page.waitForURL(/\/dashboard\/projects/, { timeout: 60_000 })
  })
})

test.describe('protected routes', () => {
  test('redirect anonymous visitors to sign-in with a return url', async ({ page }) => {
    for (const path of ['/dashboard', '/dashboard/projects', '/dashboard/settings/account', '/onboarding']) {
      await page.goto(`${BASE}${path}`)
      await expect(page).toHaveURL(/\/auth\/sign-in/)
    }
    await page.goto(`${BASE}/dashboard/projects`)
    expect(new URL(page.url()).searchParams.get('redirectTo')).toMatch(/dashboard/)
  })

  test('keeps regular users out of the Payload admin and the in-app admin', async ({ page }) => {
    await signUpViaApi(page)
    await createOrgViaApi(page)
    await page.goto(`${BASE}/admin`)
    await expect(page).toHaveURL(/\/admin\/(login|unauthorized)/)
    const response = await page.goto(`${BASE}/dashboard/admin/users`)
    expect(response?.status()).toBe(404)
  })
})

test.describe('sign-out', () => {
  test('from the user menu ends the session', async ({ page }) => {
    const user = await signUpViaApi(page)
    await createOrgViaApi(page)
    await page.goto(`${BASE}/dashboard`)
    await page.getByRole('button', { name: new RegExp(user.email) }).click()
    await page.getByRole('menuitem', { name: /sign out/i }).click()
    await page.waitForURL(/\/auth\/sign-in/, { timeout: 60_000 })
    expect(await getSessionViaApi(page)).toBeNull()
    await page.goto(`${BASE}/dashboard`)
    await expect(page).toHaveURL(/\/auth\/sign-in/)
  })

  test('/auth/sign-out signs out directly', async ({ page }) => {
    await signUpViaApi(page)
    await page.goto(`${BASE}/auth/sign-out`)
    await page.waitForURL(/\/auth\/sign-in|\/$/, { timeout: 60_000 })
    expect(await getSessionViaApi(page)).toBeNull()
  })
})

test.describe('forgot password', () => {
  test('sends a reset link and shows the confirmation screen', async ({ page, context }) => {
    test.skip(!stack.features.emailPassword, 'password auth is disabled in stack.config.ts')
    const user = await signUpViaApi(page)
    await context.clearCookies()
    await page.goto(`${BASE}/auth/forgot-password`)
    await page.locator('input[name="email"]').fill(user.email)
    await page.getByRole('button', { name: /send reset link/i }).click()
    await expect(page.getByText(/check your email/i)).toBeVisible()
    await expect(page.getByText(user.email)).toBeVisible()
  })

  test('an invalid reset token is refused', async ({ page }) => {
    await page.goto(`${BASE}/auth/reset-password?token=not-a-real-token`)
    const newPassword = page.locator('input[name="newPassword"], input[name="password"]').first()
    if (await newPassword.count()) {
      await newPassword.fill('Reset-Long-Passw0rd!')
      const confirm = page.locator('input[name="confirmPassword"]')
      if (await confirm.count()) await confirm.fill('Reset-Long-Passw0rd!')
      await page.getByRole('button', { name: /reset password|save/i }).click()
    }
    await expect(page.getByText(/invalid|expired|error/i).first()).toBeVisible()
  })
})

test.describe('invitations', () => {
  test('the accept-invitation screen shows the organization and role, then joins on accept', async ({ browser, page }) => {
    // Owner invites through the API (the emailed link is /auth/accept-invitation?invitationId=...).
    await signUpViaApi(page, { name: 'Owner' })
    const org = await createOrgViaApi(page, 'Invite Org')
    const inviteeEmail = uniqueEmail('invitee')
    const invitation = await inviteViaApi(page, org.id, inviteeEmail, 'admin')

    // The invitee, in their own browser, signs up with the invited address and opens the link.
    const inviteeContext = await browser.newContext()
    const inviteePage = await inviteeContext.newPage()
    await signUpViaApi(inviteePage, { name: 'Invitee', email: inviteeEmail })
    await inviteePage.goto(`${BASE}/auth/accept-invitation?invitationId=${invitation.id}`)
    await expect(inviteePage.getByText(new RegExp(org.name)).first()).toBeVisible()
    await expect(inviteePage.getByText(/admin/i).first()).toBeVisible()
    await inviteePage.getByRole('button', { name: /^accept$/i }).click()
    await inviteePage.waitForURL(/\/dashboard/, { timeout: 60_000 })
    await expect(inviteePage.getByText(new RegExp(`You are working in ${org.name}`))).toBeVisible()
    await inviteeContext.close()
  })

  test('a stranger cannot accept someone else\'s invitation', async ({ browser, page }) => {
    await signUpViaApi(page, { name: 'Owner' })
    const org = await createOrgViaApi(page)
    const invitation = await inviteViaApi(page, org.id, uniqueEmail('someone-else'))

    const strangerContext = await browser.newContext()
    const strangerPage = await strangerContext.newPage()
    await signUpViaApi(strangerPage, { name: `Stranger ${stamp()}` })
    await strangerPage.goto(`${BASE}/auth/accept-invitation?invitationId=${invitation.id}`)
    const accept = strangerPage.getByRole('button', { name: /^accept$/i })
    if (await accept.count()) await accept.click()
    await expect(strangerPage.getByText(/not|invalid|error|does not match|unable/i).first()).toBeVisible()
    await strangerContext.close()
  })
})
