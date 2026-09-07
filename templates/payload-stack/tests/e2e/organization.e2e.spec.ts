/**
 * Organization management through Better Auth UI: renaming, inviting people, the invitation
 * appearing for the invitee, changing roles, removing members, leaving, creating a second
 * organization from the switcher, and the danger zone.
 */
import stack from '@/stack.config'

import { BASE, createOrgViaApi, expect, inviteViaApi, listOrganizationsViaApi, signUpViaApi, test, uniqueEmail, type E2EOrg } from './fixtures'

test.describe('organization settings', () => {
  test('renames the active organization and the sidebar follows', async ({ page, member }) => {
    await page.goto(`${BASE}/dashboard/organization/settings`)
    await expect(page.getByRole('heading', { name: 'Organization', exact: true })).toBeVisible()
    const name = page.locator('input[name="name"]').first()
    await expect(name).toHaveValue(member.org.name)
    await name.fill('Renamed Org')
    await page.getByRole('button', { name: /save/i }).first().click()
    await expect(page.getByText(/organization updated/i)).toBeVisible()
    await expect(page.locator('[data-slot="sidebar"]').first().getByText('Renamed Org')).toBeVisible()
    const orgs = await listOrganizationsViaApi(page)
    expect(orgs.find((o) => o.id === member.org.id)?.name).toBe('Renamed Org')
  })

  test('shows the danger zone with leave and delete for the owner', async ({ page, member }) => {
    expect(member.org.id).toBeTruthy()
    await page.goto(`${BASE}/dashboard/organization/settings`)
    await expect(page.getByRole('button', { name: /delete organization/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /leave organization/i })).toBeVisible()
  })

  test('deleting the organization removes it and sends the owner back to onboarding', async ({ page, member }) => {
    await page.goto(`${BASE}/dashboard/organization/settings`)
    await page.getByRole('button', { name: /delete organization/i }).click()
    const dialog = page.getByRole('dialog').or(page.getByRole('alertdialog'))
    await expect(dialog).toBeVisible()
    const confirmInput = dialog.locator('input').first()
    if (await confirmInput.count()) await confirmInput.fill(member.org.slug)
    await dialog.getByRole('button', { name: /delete/i }).last().click()
    await expect.poll(async () => (await listOrganizationsViaApi(page)).map((o) => o.id), { timeout: 30_000 }).not.toContain(member.org.id)
    await page.goto(`${BASE}/dashboard`)
    await page.waitForURL(/\/onboarding/, { timeout: 60_000 })
  })
})

test.describe('people', () => {
  test('lists the owner and invites a member through the dialog', async ({ page, member }) => {
    await page.goto(`${BASE}/dashboard/organization/people`)
    await expect(page.getByText(member.user.email)).toBeVisible()
    await expect(page.getByText(/owner/i).first()).toBeVisible()

    const inviteeEmail = uniqueEmail('invitee')
    await page.getByRole('button', { name: /invite member/i }).first().click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: /email/i }).fill(inviteeEmail)
    // Pick the role explicitly (the dropdown lists every role from stack.config.ts).
    await dialog.getByRole('button', { name: /role/i }).click()
    await expect(page.getByRole('menuitemcheckbox', { name: 'Owner' })).toBeVisible()
    await page.getByRole('menuitemcheckbox', { name: 'Admin' }).click()
    await page.keyboard.press('Escape')
    await dialog.getByRole('button', { name: /invite member/i }).click()
    await expect(page.getByText(/member invited/i)).toBeVisible()
    await expect(page.getByText(inviteeEmail)).toBeVisible()
    await expect(page.getByText(/pending/i).first()).toBeVisible()
  })

  test('an accepted invitation shows the new member, whose role can be changed and who can be removed', async ({ page, member, browser }) => {
    const inviteeEmail = uniqueEmail('member')
    const invitation = await inviteViaApi(page, member.org.id, inviteeEmail)

    const inviteeContext = await browser.newContext()
    const inviteePage = await inviteeContext.newPage()
    await signUpViaApi(inviteePage, { name: 'New Member', email: inviteeEmail })
    await inviteePage.goto(`${BASE}/auth/accept-invitation?invitationId=${invitation.id}`)
    await inviteePage.getByRole('button', { name: /^accept$/i }).click()
    await inviteePage.waitForURL(/\/dashboard/, { timeout: 60_000 })

    await page.goto(`${BASE}/dashboard/organization/people`)
    const members = page.getByLabel('Members', { exact: true })
    const row = members.getByRole('row').filter({ hasText: inviteeEmail })
    await expect(row).toBeVisible()
    await expect(row).toContainText(/member/i)

    // Change role → admin.
    await row.getByRole('button', { name: /change role/i }).click()
    const roleDialog = page.getByRole('dialog', { name: 'Change role' })
    await roleDialog.getByRole('checkbox', { name: 'Admin' }).click()
    await roleDialog.getByRole('button', { name: 'Save changes' }).click()
    await expect(row).toContainText(/admin/i)

    // The member sees the organization in their own dashboard.
    await inviteePage.goto(`${BASE}/dashboard`)
    await expect(inviteePage.getByText(`You are working in ${member.org.name}`)).toBeVisible()

    // Remove.
    await row.getByRole('button', { name: /remove member/i }).click()
    const removeDialog = page.getByRole('dialog').or(page.getByRole('alertdialog'))
    await removeDialog.getByRole('button', { name: /remove/i }).last().click()
    await expect(members.getByRole('row').filter({ hasText: inviteeEmail })).toHaveCount(0)

    // The removed member no longer has an organization.
    await expect.poll(async () => (await listOrganizationsViaApi(inviteePage)).length, { timeout: 30_000 }).toBe(0)
    await inviteePage.goto(`${BASE}/dashboard`)
    await expect(inviteePage).toHaveURL(/\/onboarding/, { timeout: 60_000 })
    await inviteeContext.close()
  })

  test('a plain member cannot see the invite button or the danger zone delete', async ({ page, member, browser }) => {
    const inviteeEmail = uniqueEmail('plain')
    const invitation = await inviteViaApi(page, member.org.id, inviteeEmail)
    const memberContext = await browser.newContext()
    const memberPage = await memberContext.newPage()
    await signUpViaApi(memberPage, { name: 'Plain Member', email: inviteeEmail })
    await memberPage.goto(`${BASE}/auth/accept-invitation?invitationId=${invitation.id}`)
    await memberPage.getByRole('button', { name: /^accept$/i }).click()
    await memberPage.waitForURL(/\/dashboard/, { timeout: 60_000 })

    await memberPage.goto(`${BASE}/dashboard/organization/people`)
    await expect(memberPage.getByText(member.user.email)).toBeVisible()
    await expect(memberPage.getByRole('button', { name: /invite member/i })).toHaveCount(0)
    await expect(memberPage.getByLabel('Members', { exact: true }).getByRole('row').filter({ hasText: inviteeEmail })).toBeVisible()
    await memberPage.goto(`${BASE}/dashboard/organization/settings`)
    await expect(memberPage.getByRole('button', { name: /delete organization/i })).toHaveCount(0)
    await expect(memberPage.getByRole('button', { name: /leave organization/i })).toBeVisible()
    await memberContext.close()
  })

  test('leaving an organization removes access', async ({ page, member, browser }) => {
    const inviteeEmail = uniqueEmail('leaver')
    const invitation = await inviteViaApi(page, member.org.id, inviteeEmail)
    const ctx = await browser.newContext()
    const leaver = await ctx.newPage()
    await signUpViaApi(leaver, { name: 'Leaver', email: inviteeEmail })
    await leaver.goto(`${BASE}/auth/accept-invitation?invitationId=${invitation.id}`)
    await leaver.getByRole('button', { name: /^accept$/i }).click()
    await leaver.waitForURL(/\/dashboard/, { timeout: 60_000 })

    await leaver.goto(`${BASE}/dashboard/organization/settings`)
    await leaver.getByRole('button', { name: /leave organization/i }).click()
    const dialog = leaver.getByRole('dialog').or(leaver.getByRole('alertdialog'))
    await dialog.getByRole('button', { name: /leave/i }).last().click()
    await expect.poll(async () => (await listOrganizationsViaApi(leaver)).length, { timeout: 30_000 }).toBe(0)
    await ctx.close()

    await page.goto(`${BASE}/dashboard/organization/people`)
    await expect(page.getByText(inviteeEmail)).toHaveCount(0)
  })
})

test.describe('organizations settings tab and switcher', () => {
  test('lists the user\'s organizations and creates a new one from the switcher', async ({ page, member }) => {
    await page.goto(`${BASE}/dashboard/settings/organizations`)
    await expect(page.getByLabel('Organizations', { exact: true }).getByText(member.org.name)).toBeVisible()

    const sidebar = page.locator('[data-slot="sidebar"]').first()
    await sidebar.getByRole('button', { name: new RegExp(member.org.name) }).click()
    await page.getByRole('menuitem', { name: /create organization/i }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('input[name="name"]').fill('Switcher Org')
    const slug = dialog.locator('input[name="slug"]')
    if (await slug.count()) await slug.fill(`switcher-${Date.now().toString(36)}`)
    await dialog.getByRole('button', { name: /create/i }).last().click()
    await expect(dialog).toBeHidden({ timeout: 30_000 })
    await expect.poll(async () => (await listOrganizationsViaApi(page)).map((o) => o.name), { timeout: 30_000 }).toEqual(
      expect.arrayContaining([member.org.name, 'Switcher Org']),
    )
    // The switcher offers both organizations.
    await sidebar.getByRole('button', { name: /Switcher Org|E2E Org/ }).click()
    await expect(page.getByRole('menuitem', { name: /Switcher Org/ })).toBeVisible()
  })

  test('the switcher lists every organization and switches the active one', async ({ page, member }) => {
    const second: E2EOrg = await createOrgViaApi(page, 'Other')
    await page.goto(`${BASE}/dashboard`)
    const sidebar = page.locator('[data-slot="sidebar"]').first()
    await expect(sidebar.getByText(second.name)).toBeVisible()
    await sidebar.getByRole('button', { name: new RegExp(second.name) }).click()
    await expect(page.getByRole('menuitem', { name: new RegExp(member.org.name) })).toBeVisible()
    await page.getByRole('menuitem', { name: new RegExp(member.org.name) }).click()
    await expect(sidebar.getByText(member.org.name)).toBeVisible()
    await expect(page.getByText(`You are working in ${member.org.name}`)).toBeVisible({ timeout: 30_000 })
  })
})

test.describe('billing', () => {
  test('the billing page either shows the Stripe UI or explains the missing keys', async ({ page, member }) => {
    test.skip(!stack.features.billing, 'billing is disabled in stack.config.ts')
    expect(member.org.id).toBeTruthy()
    const billingPath = stack.features.billingAttachedTo === 'organization' ? '/dashboard/organization/billing' : '/dashboard/settings/billing'
    await page.goto(`${BASE}${billingPath}`)
    // playwright.config.ts loads .env, so the test sees the same Stripe keys as the dev server.
    const configured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
    if (configured) {
      await expect(page.getByText(/billing is not configured/i)).toHaveCount(0)
      await expect(page.getByText(/plan/i).first()).toBeVisible()
    } else {
      await expect(page.getByText('Billing is not configured')).toBeVisible()
      await expect(page.getByText(/STRIPE_SECRET_KEY=/)).toBeVisible()
      await expect(page.getByText(/STRIPE_WEBHOOK_SECRET=/)).toBeVisible()
    }
  })
})
